// ============================================================
// CHARLOTTE PARKING — Edge Function: delete-account-immediate
// Cancella subito abbonamento Stripe + tutti i dati account
// POST (con JWT) → { success: true }
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
  if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })

  try {
    // Carica account
    const { data: account } = await supabase
      .from('accounts')
      .select('id, stripe_subscription_id, stripe_customer_id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!account) return new Response(JSON.stringify({ error: 'account_not_found' }), { status: 404, headers: corsHeaders })

    // 1. Cancella abbonamento Stripe immediatamente
    if (account.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(account.stripe_subscription_id)
        console.log('Stripe subscription cancelled:', account.stripe_subscription_id)
      } catch (e) {
        console.error('Stripe cancel error (ignored):', e.message)
      }
    }

    // 2. Cancella tutti i dati in cascata — se una delete fallisce, ci si ferma
    //    e NON si elimina l'utente auth, per evitare dati orfani senza owner.
    const { data: garages } = await supabase
      .from('garages')
      .select('id')
      .eq('account_id', account.id)

    const garageIds = (garages || []).map((g: any) => g.id)
    const erroriCascata: string[] = []

    const eseguiDelete = async (label: string, p: PromiseLike<{ error: any }>) => {
      const { error } = await p
      if (error) erroriCascata.push(label + ': ' + error.message)
    }

    if (garageIds.length > 0) {
      await eseguiDelete('soste', supabase.from('soste').delete().in('garage_id', garageIds))
      await eseguiDelete('tariffe', supabase.from('tariffe').delete().in('garage_id', garageIds))
      await eseguiDelete('convenzioni', supabase.from('convenzioni').delete().in('garage_id', garageIds))
      await eseguiDelete('prenotazioni', supabase.from('prenotazioni').delete().in('garage_id', garageIds))
      await eseguiDelete('turni', supabase.from('turni').delete().in('garage_id', garageIds))
      await eseguiDelete('push_subscriptions', supabase.from('push_subscriptions').delete().in('garage_id', garageIds))
      await eseguiDelete('categorie_custom', supabase.from('categorie_custom').delete().in('garage_id', garageIds))
      if (erroriCascata.length === 0) {
        await eseguiDelete('garages', supabase.from('garages').delete().eq('account_id', account.id))
      }
    }

    if (erroriCascata.length > 0) {
      console.error('Cascata delete fallita, account non rimosso:', erroriCascata)
      return new Response(JSON.stringify({ error: 'cascade_delete_failed', details: erroriCascata }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await eseguiDelete('operatori', supabase.from('operatori').delete().eq('account_id', account.id))
    if (erroriCascata.length > 0) {
      console.error('Cancellazione operatori fallita, account non rimosso:', erroriCascata)
      return new Response(JSON.stringify({ error: 'cascade_delete_failed', details: erroriCascata }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: accountDelErr } = await supabase.from('accounts').delete().eq('id', account.id)
    if (accountDelErr) {
      console.error('Cancellazione account fallita:', accountDelErr)
      return new Response(JSON.stringify({ error: 'account_delete_failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    await supabase.from('pending_subscriptions').delete().eq('email', user.email!)

    // 3. Elimina utente auth — solo dopo che tutti i dati sono stati rimossi con successo
    await supabase.auth.admin.deleteUser(user.id)

    console.log('Account deleted immediately:', user.id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('delete-account-immediate error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
