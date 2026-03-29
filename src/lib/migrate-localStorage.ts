/**
 * One-time migration: move existing localStorage data to Supabase.
 * Safe to call on every app start — skips if migration already done.
 * Sets "como1907_migrated_v1" in localStorage after successful migration.
 */

import { supabase } from "@/lib/supabase";

const MIGRATION_KEY = "como1907_migrated_v1";

interface LocalMonthData {
  mese: string;
  records: Array<{
    tp_id: string;
    tp_nome: string;
    tp_tipo: string;
    tp_zona: string;
    rappresentante: string;
    venduto_pezzi: number;
    venduto_euro: number;
    giacenza_pezzi: number | null;
    mese: string;
  }>;
  hasGiacenza: boolean;
}

interface LocalStore {
  months: LocalMonthData[];
}

interface LocalSettings {
  abcThresholds?: { aMin: number; bMin: number };
  rappresentantiMap?: Record<string, string>;
  importHistory?: Array<{
    mese: string;
    uploadDate: string;
    tpCount: number;
    totalFatturato: number;
  }>;
}

interface LocalTPData {
  anagrafica?: {
    indirizzo?: string;
    referenteNome?: string;
    referenteTelefono?: string;
    referenteEmail?: string;
    note?: string;
    fromCSV?: boolean;
  };
  visite?: Array<{
    id: string;
    data: string;
    rappresentante: string;
    note: string;
  }>;
}

export async function migrateFromLocalStorage(): Promise<void> {
  // Skip if already migrated
  if (localStorage.getItem(MIGRATION_KEY)) return;

  console.log("[migrate] Starting localStorage → Supabase migration...");

  try {
    // ── 1. Migrate tp_records ────────────────────────────────────────────────
    const dashRaw = localStorage.getItem("como1907_dashboard");
    if (dashRaw) {
      const store = JSON.parse(dashRaw) as LocalStore;
      if (store?.months?.length > 0) {
        for (const month of store.months) {
          // Check if month already exists in Supabase
          const { count } = await supabase
            .from("tp_records")
            .select("*", { count: "exact", head: true })
            .eq("mese", month.mese);

          if ((count ?? 0) > 0) continue; // Skip if already migrated

          const rows = month.records.map(r => ({
            tp_id: r.tp_id,
            tp_nome: r.tp_nome,
            tp_tipo: r.tp_tipo,
            tp_zona: r.tp_zona,
            rappresentante: r.rappresentante,
            venduto_pezzi: r.venduto_pezzi,
            venduto_euro: r.venduto_euro,
            giacenza_pezzi: r.giacenza_pezzi,
            mese: r.mese,
            has_giacenza: month.hasGiacenza,
          }));

          if (rows.length > 0) {
            const { error } = await supabase.from("tp_records").insert(rows);
            if (error) console.error(`[migrate] tp_records ${month.mese}:`, error);
            else console.log(`[migrate] tp_records ${month.mese}: ${rows.length} rows migrated`);
          }
        }
      }
    }

    // ── 2. Migrate settings (ABC thresholds + rappresentanti map + import history) ──
    const settingsRaw = localStorage.getItem("como1907_settings");
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw) as LocalSettings;

      // ABC thresholds
      if (settings?.abcThresholds) {
        const { data: existing } = await supabase
          .from("settings")
          .select("id")
          .is("user_id", null)
          .maybeSingle();

        if (!existing) {
          await supabase.from("settings").insert({
            user_id: null,
            abc_a_min: settings.abcThresholds.aMin,
            abc_b_min: settings.abcThresholds.bMin,
          });
        }
      }

      // Rappresentanti map
      if (settings?.rappresentantiMap) {
        const entries = Object.entries(settings.rappresentantiMap)
          .filter(([, v]) => v.trim() !== "");
        for (const [csv_value, display_name] of entries) {
          await supabase
            .from("rappresentanti_map")
            .upsert({ csv_value, display_name }, { onConflict: "csv_value" });
        }
      }

      // Import history
      if (settings?.importHistory?.length) {
        for (const h of settings.importHistory) {
          await supabase.from("import_history").upsert({
            mese: h.mese,
            upload_date: h.uploadDate,
            tp_count: h.tpCount,
            total_fatturato: h.totalFatturato,
          }, { onConflict: "mese" });
        }
      }
    }

    // ── 3. Migrate tp_anagrafica + tp_visite ─────────────────────────────────
    const tpRaw = localStorage.getItem("como1907_tp_local");
    if (tpRaw) {
      const tpData = JSON.parse(tpRaw) as Record<string, LocalTPData>;
      for (const [tp_id, data] of Object.entries(tpData)) {
        // Anagrafica
        if (data.anagrafica && Object.values(data.anagrafica).some(v => v)) {
          const a = data.anagrafica;
          await supabase.from("tp_anagrafica").upsert({
            tp_id,
            indirizzo: a.indirizzo ?? "",
            referente_nome: a.referenteNome ?? "",
            referente_telefono: a.referenteTelefono ?? "",
            referente_email: a.referenteEmail ?? "",
            note: a.note ?? "",
            from_csv: a.fromCSV ?? false,
          }, { onConflict: "tp_id" });
        }

        // Visite
        if (data.visite?.length) {
          for (const v of data.visite) {
            // Use tp_id + data + note as dedup key (no UUID available from old data)
            const { count } = await supabase
              .from("tp_visite")
              .select("*", { count: "exact", head: true })
              .eq("tp_id", tp_id)
              .eq("data", v.data)
              .eq("note", v.note);

            if ((count ?? 0) === 0) {
              await supabase.from("tp_visite").insert({
                tp_id,
                data: v.data,
                rappresentante: v.rappresentante,
                note: v.note,
              });
            }
          }
        }
      }
    }

    // ── 4. Mark migration as done ──────────────────────────────────────────
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    console.log("[migrate] Migration completed successfully");

  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    // Don't set the migration key — will retry next time
  }
}
