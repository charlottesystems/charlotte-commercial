-- Aggiunge colonna cancels_at per gestire disdetta con accesso fino a fine periodo
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS cancels_at TIMESTAMPTZ;
