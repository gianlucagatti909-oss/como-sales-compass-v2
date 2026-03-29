import { supabase } from "@/lib/supabase";
import { DashboardStore, MonthData, TPRecord } from "@/types/dashboard";

function rowToTPRecord(row: Record<string, unknown>): TPRecord {
  return {
    tp_id: row.tp_id as string,
    tp_nome: row.tp_nome as string,
    tp_tipo: row.tp_tipo as string,
    tp_zona: row.tp_zona as string,
    rappresentante: row.rappresentante as string,
    venduto_pezzi: Number(row.venduto_pezzi),
    venduto_euro: Number(row.venduto_euro),
    giacenza_pezzi: row.giacenza_pezzi != null ? Number(row.giacenza_pezzi) : null,
    mese: row.mese as string,
  };
}

function rowsToMonthData(mese: string, rows: Record<string, unknown>[]): MonthData {
  const records = rows.map(rowToTPRecord);
  const hasGiacenza = (rows[0]?.has_giacenza as boolean) ?? false;
  return { mese, records, hasGiacenza };
}

export async function loadStore(): Promise<DashboardStore> {
  const { data, error } = await supabase
    .from("tp_records")
    .select("*")
    .order("mese", { ascending: true });

  if (error) {
    console.error("[store] loadStore error:", error);
    return { months: [] };
  }

  // Group by mese
  const byMese = new Map<string, Record<string, unknown>[]>();
  for (const row of data ?? []) {
    const key = row.mese as string;
    if (!byMese.has(key)) byMese.set(key, []);
    byMese.get(key)!.push(row as Record<string, unknown>);
  }

  const months: MonthData[] = Array.from(byMese.entries()).map(([mese, rows]) =>
    rowsToMonthData(mese, rows)
  );

  return { months };
}

export async function addMonth(records: TPRecord[], hasGiacenza: boolean): Promise<DashboardStore> {
  const mese = records[0]?.mese;
  if (!mese) return loadStore();

  // Delete existing records for this month first (upsert by mese+tp_id not supported for bulk efficiently)
  const { error: delError } = await supabase
    .from("tp_records")
    .delete()
    .eq("mese", mese);

  if (delError) {
    console.error("[store] addMonth delete error:", delError);
    throw new Error("Errore durante la sovrascrittura dei dati esistenti");
  }

  const rows = records.map(r => ({
    tp_id: r.tp_id,
    tp_nome: r.tp_nome,
    tp_tipo: r.tp_tipo,
    tp_zona: r.tp_zona,
    rappresentante: r.rappresentante,
    venduto_pezzi: r.venduto_pezzi,
    venduto_euro: r.venduto_euro,
    giacenza_pezzi: r.giacenza_pezzi,
    mese: r.mese,
    has_giacenza: hasGiacenza,
  }));

  const { error: insError } = await supabase.from("tp_records").insert(rows);
  if (insError) {
    console.error("[store] addMonth insert error:", insError);
    throw new Error("Errore durante il salvataggio dei dati");
  }

  return loadStore();
}

export async function monthExists(mese: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("tp_records")
    .select("*", { count: "exact", head: true })
    .eq("mese", mese);

  if (error) {
    console.error("[store] monthExists error:", error);
    return false;
  }
  return (count ?? 0) > 0;
}

export async function getAvailableMonths(): Promise<string[]> {
  const store = await loadStore();
  return store.months.map(m => m.mese);
}

export async function getMonthData(mese: string): Promise<MonthData | undefined> {
  const { data, error } = await supabase
    .from("tp_records")
    .select("*")
    .eq("mese", mese);

  if (error || !data || data.length === 0) return undefined;
  return rowsToMonthData(mese, data as Record<string, unknown>[]);
}

export async function getPreviousMonth(mese: string): Promise<MonthData | undefined> {
  const store = await loadStore();
  const idx = store.months.findIndex(m => m.mese === mese);
  if (idx <= 0) return undefined;
  return store.months[idx - 1];
}

export async function getAllMonthsData(): Promise<MonthData[]> {
  const store = await loadStore();
  return store.months;
}

export async function deleteMonth(mese: string): Promise<DashboardStore> {
  const { error } = await supabase.from("tp_records").delete().eq("mese", mese);
  if (error) {
    console.error("[store] deleteMonth error:", error);
    throw new Error("Errore durante l'eliminazione del mese");
  }
  return loadStore();
}

export async function clearStore(): Promise<void> {
  const { error } = await supabase.from("tp_records").delete().neq("mese", "");
  if (error) console.error("[store] clearStore error:", error);
}
