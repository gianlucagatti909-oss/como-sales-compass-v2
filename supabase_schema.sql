-- ============================================================
-- Como Sales Compass — Schema Supabase
-- Generato da: analisi completa del codice sorgente
-- ============================================================

-- ============================================================
-- 1. USERS (autenticazione custom)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'rappresentante')),
  display_name  TEXT NOT NULL,
  rappresentante TEXT,          -- valore CSV collegato (solo per role='rappresentante')
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. TP_RECORDS (dati di vendita mensili per touchpoint)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tp_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mese            TEXT NOT NULL,          -- formato YYYY-MM
  tp_id           TEXT NOT NULL,
  tp_nome         TEXT NOT NULL,
  tp_tipo         TEXT NOT NULL,
  tp_zona         TEXT NOT NULL,
  rappresentante  TEXT NOT NULL,
  venduto_pezzi   NUMERIC NOT NULL DEFAULT 0,
  venduto_euro    NUMERIC NOT NULL DEFAULT 0,
  giacenza_pezzi  NUMERIC,                -- NULL se non disponibile
  has_giacenza    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mese, tp_id)
);

CREATE INDEX IF NOT EXISTS idx_tp_records_mese         ON public.tp_records (mese);
CREATE INDEX IF NOT EXISTS idx_tp_records_tp_id        ON public.tp_records (tp_id);
CREATE INDEX IF NOT EXISTS idx_tp_records_rappresentante ON public.tp_records (rappresentante);

-- ============================================================
-- 3. TP_ANAGRAFICA (info anagrafiche di ogni touchpoint)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tp_anagrafica (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tp_id                TEXT NOT NULL UNIQUE,
  indirizzo            TEXT NOT NULL DEFAULT '',
  referente_nome       TEXT NOT NULL DEFAULT '',
  referente_telefono   TEXT NOT NULL DEFAULT '',
  referente_email      TEXT NOT NULL DEFAULT '',
  note                 TEXT NOT NULL DEFAULT '',
  from_csv             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_anagrafica_tp_id ON public.tp_anagrafica (tp_id);

-- ============================================================
-- 4. TP_VISITE (log visite per touchpoint)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tp_visite (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tp_id           TEXT NOT NULL,
  data            DATE NOT NULL,
  rappresentante  TEXT NOT NULL,
  note            TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_visite_tp_id         ON public.tp_visite (tp_id);
CREATE INDEX IF NOT EXISTS idx_tp_visite_rappresentante ON public.tp_visite (rappresentante);
CREATE INDEX IF NOT EXISTS idx_tp_visite_data           ON public.tp_visite (data);

-- Full-text search su note visite
CREATE INDEX IF NOT EXISTS idx_tp_visite_note_fts ON public.tp_visite
  USING GIN (to_tsvector('italian', note));

-- ============================================================
-- 5. SETTINGS (configurazione ABC thresholds)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES public.users(id) ON DELETE CASCADE,
  abc_a_min    NUMERIC NOT NULL DEFAULT 60,   -- soglia STR per categoria A (%)
  abc_b_min    NUMERIC NOT NULL DEFAULT 40,   -- soglia STR per categoria B (%)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Settings globali (user_id NULL = default per tutti)
INSERT INTO public.settings (user_id, abc_a_min, abc_b_min)
VALUES (NULL, 60, 40)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. RAPPRESENTANTI_MAP (mappatura nomi CSV → display name)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rappresentanti_map (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  csv_name     TEXT NOT NULL UNIQUE,   -- valore grezzo dal CSV
  display_name TEXT NOT NULL,          -- nome mostrato in UI
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. IMPORT_HISTORY (storico importazioni CSV vendite)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mese             TEXT NOT NULL UNIQUE,   -- YYYY-MM
  upload_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tp_count         INTEGER NOT NULL DEFAULT 0,
  total_fatturato  NUMERIC NOT NULL DEFAULT 0
);

-- ============================================================
-- 8. ANAGRAFICA_IMPORT_HISTORY (storico importazioni CSV anagrafica)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.anagrafica_import_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tp_count   INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- TRIGGERS: aggiorna updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tp_records_updated_at
  BEFORE UPDATE ON public.tp_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tp_anagrafica_updated_at
  BEFORE UPDATE ON public.tp_anagrafica
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_rappresentanti_map_updated_at
  BEFORE UPDATE ON public.rappresentanti_map
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Abilita RLS su tutte le tabelle
ALTER TABLE public.users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tp_records               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tp_anagrafica            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tp_visite                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rappresentanti_map       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anagrafica_import_history ENABLE ROW LEVEL SECURITY;

-- Per ora: policy permissiva (accesso completo agli utenti autenticati via anon key)
-- Da restringere quando si implementa auth Supabase nativa

CREATE POLICY "allow_all_authenticated" ON public.users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_authenticated" ON public.tp_records
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_authenticated" ON public.tp_anagrafica
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_authenticated" ON public.tp_visite
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_authenticated" ON public.settings
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_authenticated" ON public.rappresentanti_map
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_authenticated" ON public.import_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_authenticated" ON public.anagrafica_import_history
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- UTENTI DEFAULT (da inserire dopo aver creato la tabella)
-- NOTA: in produzione usa bcrypt per le password
-- ============================================================
INSERT INTO public.users (username, password_hash, role, display_name, enabled)
VALUES
  ('admin',                    'admin',  'admin',          'Sales Manager',  TRUE),
  ('gianlucagatti909@gmail.com','admin', 'admin',          'Gianluca Gatti', TRUE)
ON CONFLICT (username) DO NOTHING;
