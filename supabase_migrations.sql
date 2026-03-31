-- Migration 001: Fix UNIQUE constraint for global settings row
-- PostgreSQL UNIQUE does not prevent multiple NULL values — add a partial index
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_global
  ON settings ((user_id IS NULL))
  WHERE user_id IS NULL;

-- Migration 002: Seed hashed passwords for default admin users
-- bcrypt hash for "admin" at cost factor 10
UPDATE users
SET password_hash = '$2b$10$z4wcguT0fsF.kkkXaP76mecLhtgNzy9iM.MehawJUelliHvJLPgR.'
WHERE username IN ('admin', 'gianlucagatti909@gmail.com');

-- Migration 003: Add geolocation columns to tp_anagrafica for map view
ALTER TABLE public.tp_anagrafica
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC;
