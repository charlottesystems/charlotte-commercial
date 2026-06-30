// ============================================================
// CHARLOTTE PARKING — Edge Function: create-portal-session
// Genera URL Customer Portal Stripe per utente autenticato
// POST (con JWT) { return_url? } → { url }
// ============================================================

import Stripe from 'https://esm.sh/stripe@13?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verifica JWT utente
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Legge stripe_customer_id dall'account
    const { data: account } = await supabase
      .from('accounts')
      .select('id, stripe_customer_id')
      .eq('owner_id', user.id)
      .maybeSingle()

    let customerId = account?.stripe_customer_id

    if (!customerId) {
      // Cerca in Stripe per email
      const customers = await stripe.customers.list({ email: user.email!, limit: 1 })
      if (!customers.data[0]) {
        return new Response(JSON.stringify({ error: 'no_customer' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      customerId = customers.data[0].id

      // Salva per la prossima volta
      if (account?.id) {
        await supabase
          .from('accounts')
          .update({ stripe_customer_id: customerId })
          .eq('id', account.id)
      }
    }

    const body = await req.json().catch(() => ({}))
    const returnUrl = body.return_url || 'https://charlottesystems.github.io/charlotte-commercial/'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('create-portal-session error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
