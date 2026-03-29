import { supabase } from "@/lib/supabase";
import { DashboardSettings, ImportMeta, ABCThresholds, DEFAULT_THRESHOLDS } from "@/types/settings";

// ─── ABC Thresholds (settings table, global row with user_id IS NULL) ──────

export async function getABCThresholds(): Promise<ABCThresholds> {
  const { data, error } = await supabase
    .from("settings")
    .select("abc_a_min, abc_b_min")
    .is("user_id", null)
    .maybeSingle();

  if (error) {
    console.error("[settings-store] getABCThresholds error:", error);
    return DEFAULT_THRESHOLDS;
  }

  if (!data) return DEFAULT_THRESHOLDS;
  return { aMin: Number(data.abc_a_min), bMin: Number(data.abc_b_min) };
}

export async function saveABCThresholds(t: ABCThresholds): Promise<void> {
  const existing = await supabase
    .from("settings")
    .select("id")
    .is("user_id", null)
    .maybeSingle();

  if (existing.data) {
    const { error } = await supabase
      .from("settings")
      .update({ abc_a_min: t.aMin, abc_b_min: t.bMin })
      .eq("id", existing.data.id);
    if (error) console.error("[settings-store] saveABCThresholds update error:", error);
  } else {
    const { error } = await supabase
      .from("settings")
      .insert({ user_id: null, abc_a_min: t.aMin, abc_b_min: t.bMin });
    if (error) console.error("[settings-store] saveABCThresholds insert error:", error);
  }
}

// ─── Rappresentanti Map ──────────────────────────────────────────────────────

export async function getRappresentantiMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("rappresentanti_map")
    .select("csv_value, display_name");

  if (error) {
    console.error("[settings-store] getRappresentantiMap error:", error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.csv_value] = row.display_name;
  }
  return map;
}

export async function saveRappresentantiMap(map: Record<string, string>): Promise<void> {
  // Delete all then re-insert (simplest approach for a small map)
  const { error: delError } = await supabase
    .from("rappresentanti_map")
    .delete()
    .neq("csv_value", "");
  if (delError) {
    console.error("[settings-store] saveRappresentantiMap delete error:", delError);
    return;
  }

  const rows = Object.entries(map)
    .filter(([, display]) => display.trim() !== "")
    .map(([csv_value, display_name]) => ({ csv_value, display_name }));

  if (rows.length > 0) {
    const { error } = await supabase.from("rappresentanti_map").insert(rows);
    if (error) console.error("[settings-store] saveRappresentantiMap insert error:", error);
  }
}

// ─── Import History ──────────────────────────────────────────────────────────

export async function getImportHistory(): Promise<ImportMeta[]> {
  const { data, error } = await supabase
    .from("import_history")
    .select("*")
    .order("mese", { ascending: true });

  if (error) {
    console.error("[settings-store] getImportHistory error:", error);
    return [];
  }

  return (data ?? []).map(row => ({
    mese: row.mese as string,
    uploadDate: row.upload_date as string,
    tpCount: Number(row.tp_count),
    totalFatturato: Number(row.total_fatturato),
  }));
}

export async function addImportMeta(meta: ImportMeta): Promise<void> {
  const { error } = await supabase
    .from("import_history")
    .upsert(
      {
        mese: meta.mese,
        upload_date: meta.uploadDate,
        tp_count: meta.tpCount,
        total_fatturato: meta.totalFatturato,
      },
      { onConflict: "mese" }
    );
  if (error) console.error("[settings-store] addImportMeta error:", error);
}

export async function removeImportMeta(mese: string): Promise<void> {
  const { error } = await supabase
    .from("import_history")
    .delete()
    .eq("mese", mese);
  if (error) console.error("[settings-store] removeImportMeta error:", error);
}

// ─── Full settings load (used by some pages) ─────────────────────────────────

export async function loadSettings(): Promise<DashboardSettings> {
  const [abcThresholds, rappresentantiMap, importHistory] = await Promise.all([
    getABCThresholds(),
    getRappresentantiMap(),
    getImportHistory(),
  ]);
  return { abcThresholds, rappresentantiMap, importHistory };
}

export async function clearSettings(): Promise<void> {
  await Promise.all([
    supabase.from("import_history").delete().neq("mese", ""),
    supabase.from("rappresentanti_map").delete().neq("csv_value", ""),
    // Keep settings thresholds as-is (no clear for settings)
  ]);
}
