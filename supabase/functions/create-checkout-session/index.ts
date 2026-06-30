// ============================================================
// CHARLOTTE PARKING — Edge Function: create-checkout-session
// Crea una Stripe Checkout Session con email pre-compilata
// POST { email, success_url?, cancel_url? } → { url }
// ============================================================

import Stripe from 'https://esm.sh/stripe@13?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const PRICE_ID = 'price_1Tnn2LL72l2Ox0vs0JpUrUgj'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, success_url, cancel_url } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cerca o crea il customer Stripe per questa email
    const existing = await stripe.customers.list({ email, limit: 1 })
    let customerId = existing.data[0]?.id

    if (!customerId) {
      const customer = await stripe.customers.create({ email })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      subscription_data: { trial_period_days: 30 },
      success_url: success_url || 'https://charlotteparking.it/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancel_url || 'https://charlotteparking.it/#prezzi',
      metadata: { email },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('create-checkout-session error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
