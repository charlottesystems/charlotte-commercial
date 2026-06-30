-- ============================================================
-- CHARLOTTE PARKING — Migration: subscription management
-- Eseguire nel SQL Editor di Supabase
-- ============================================================

-- 1. Aggiungi stripe_customer_id alla tabella accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 2. Crea tabella pending_subscriptions
--    Usata per chi paga dal sito prima di creare l'account app
CREATE TABLE IF NOT EXISTS pending_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT NOT NULL,
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  plan                  TEXT DEFAULT 'pro',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pending_subscriptions_email_unique UNIQUE (email)
);

-- 3. RLS su pending_subscriptions
ALTER TABLE pending_subscriptions ENABLE ROW LEVEL SECURITY;

-- Gli utenti autenticati possono leggere solo la propria riga
CREATE POLICY "pending_read_own" ON pending_subscriptions
  FOR SELECT
  TO authenticated
  USING (email = lower(auth.jwt() ->> 'email'));

-- Solo service role può inserire/aggiornare/cancellare
CREATE POLICY "pending_service_role_write" ON pending_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
