// ============================================================
// CHARLOTTE PARKING — Edge Function: stripe-webhook
// Gestisce eventi Stripe: pagamenti, cancellazioni abbonamento
// Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import Stripe from 'https://esm.sh/stripe@13?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    console.error('Webhook signature error:', err)
    return new Response('Webhook Error', { status: 400 })
  }

  console.log('Stripe event:', event.type)

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'invoice.payment_succeeded'
  ) {
    await handlePaymentSuccess(event)
  } else if (event.type === 'customer.subscription.deleted') {
    await handleSubscriptionDeleted(event)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── Attiva abbonamento ────────────────────────────────────────

async function handlePaymentSuccess(event: Stripe.Event) {
  let email: string | null = null
  let customerId: string | null = null
  let subscriptionId: string | null = null
  let plan = 'pro'

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    email = session.customer_email || session.metadata?.email || null
    customerId = typeof session.customer === 'string' ? session.customer : null
    subscriptionId = typeof session.subscription === 'string' ? session.subscription : null

    // Recupera email dal customer se manca
    if (!email && customerId) {
      const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
      email = customer.email || null
    }
  } else {
    // invoice.payment_succeeded
    const invoice = event.data.object as Stripe.Invoice
    customerId = typeof invoice.customer === 'string' ? invoice.customer : null
    subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null

    if (customerId) {
      const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
      email = customer.email || null
    }
  }

  if (!email) {
    console.error('No email found in event')
    return
  }

  // Determina piano da subscription
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const amount = sub.items.data[0]?.price?.unit_amount || 0
    plan = amount >= 9900 ? 'enterprise' : amount >= 5900 ? 'pro_plus' : 'pro'
  }

  console.log('Activating subscription for:', email, 'plan:', plan)

  // Cerca utente in Supabase
  const { data: usersPage } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const user = usersPage?.users?.find((u) => u.email?.toLowerCase() === email!.toLowerCase())

  if (user) {
    // Utente trovato → attiva abbonamento
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 30)

    const { error } = await supabase
      .from('accounts')
      .update({
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        blocked_at: null,
        plan,
        trial_ends_at: trialEnd.toISOString(),
      })
      .eq('owner_id', user.id)

    if (error) {
      console.error('Error updating account:', error)
    } else {
      console.log('Account activated for user:', user.id)
      // Rimuovi eventuale pending
      await supabase.from('pending_subscriptions').delete().eq('email', email.toLowerCase())
    }
  } else {
    // Utente non ancora registrato → salva in pending_subscriptions
    console.log('User not found, saving to pending_subscriptions:', email)
    await supabase.from('pending_subscriptions').upsert(
      {
        email: email.toLowerCase(),
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan,
      },
      { onConflict: 'email' }
    )
  }
}

// ── Cancella abbonamento ──────────────────────────────────────

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : null

  if (!customerId) return

  const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
  const email = customer.email

  if (!email) return

  console.log('Cancelling subscription for:', email)

  const { data: usersPage } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const user = usersPage?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (user) {
    await supabase
      .from('accounts')
      .update({
        stripe_subscription_id: null,
        blocked_at: new Date().toISOString(),
      })
      .eq('owner_id', user.id)

    console.log('Subscription cancelled for user:', user.id)
  }

  // Rimuovi anche pending se esisteva
  await supabase.from('pending_subscriptions').delete().eq('email', email.toLowerCase())
}
