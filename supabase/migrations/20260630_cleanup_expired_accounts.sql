-- ============================================================
-- CHARLOTTE PARKING — Pulizia automatica account scaduti
-- Eseguire nel SQL Editor di Supabase
-- Cancella ogni notte gli account bloccati da più di 30 giorni
-- ============================================================

-- 1. Funzione di pulizia
CREATE OR REPLACE FUNCTION cleanup_expired_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  acc RECORD;
  garage_ids UUID[];
BEGIN
  FOR acc IN
    SELECT id, owner_id
    FROM accounts
    WHERE blocked_at IS NOT NULL
      AND blocked_at < NOW() - INTERVAL '30 days'
  LOOP
    -- Raccoglie gli ID garage di questo account
    SELECT ARRAY(SELECT id FROM garages WHERE account_id = acc.id)
    INTO garage_ids;

    -- Cancella tutti i dati collegati ai garage
    IF array_length(garage_ids, 1) > 0 THEN
      DELETE FROM soste              WHERE garage_id = ANY(garage_ids);
      DELETE FROM tariffe            WHERE garage_id = ANY(garage_ids);
      DELETE FROM convenzioni        WHERE garage_id = ANY(garage_ids);
      DELETE FROM prenotazioni       WHERE garage_id = ANY(garage_ids);
      DELETE FROM turni              WHERE garage_id = ANY(garage_ids);
      DELETE FROM push_subscriptions WHERE garage_id = ANY(garage_ids);

      -- ricavi_esterni: presente se il garage usava piattaforme esterne (Booking.com ecc.)
      BEGIN
        DELETE FROM ricavi_esterni WHERE garage_id = ANY(garage_ids);
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      -- categorie_custom potrebbe non esistere su tutti i db, ignora errore
      BEGIN
        DELETE FROM categorie_custom WHERE garage_id = ANY(garage_ids);
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      DELETE FROM garages WHERE id = ANY(garage_ids);
    END IF;

    -- Cancella operatori, pending_subscriptions e account
    DELETE FROM operatori WHERE account_id = acc.id;

    -- Rimuove eventuali pending_subscriptions rimaste (es. utente pagò ma non si registrò mai)
    DELETE FROM pending_subscriptions WHERE email = (
      SELECT email FROM auth.users WHERE id = acc.owner_id
    );

    DELETE FROM accounts  WHERE id = acc.id;

    -- Cancella utente auth (richiede SECURITY DEFINER + superuser)
    DELETE FROM auth.users WHERE id = acc.owner_id;

    RAISE LOG 'Charlotte cleanup: eliminato account % (owner %)', acc.id, acc.owner_id;
  END LOOP;
END;
$$;

-- 2. Abilita pg_cron (se non già abilitato)
-- In Supabase: Database → Extensions → cerca "pg_cron" → abilita
-- Oppure esegui:
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Schedula la pulizia ogni notte alle 03:00
SELECT cron.schedule(
  'cleanup-expired-accounts',   -- nome job
  '0 3 * * *',                  -- ogni notte alle 03:00
  'SELECT cleanup_expired_accounts()'
);
