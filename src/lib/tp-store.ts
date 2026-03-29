/** Supabase-backed persistence for TP-level editable data: anagrafica and visit logs */

import { supabase } from "@/lib/supabase";

export interface TPAnagrafica {
  indirizzo?: string;
  referenteNome?: string;
  referenteTelefono?: string;
  referenteEmail?: string;
  note?: string;
  /** Track if data came from CSV import (vs manual edit) */
  fromCSV?: boolean;
}

export interface TPVisita {
  id: string;
  data: string; // ISO date
  rappresentante: string;
  note: string;
}

export interface TPLocalData {
  anagrafica: TPAnagrafica;
  visite: TPVisita[];
}

export interface AnagraficaImportMeta {
  id: string; // UUID from Supabase
  date: string; // ISO
  tpCount: number;
}

// ─── Anagrafica ───────────────────────────────────────────────────────────────

export async function getTPLocal(tpId: string): Promise<TPLocalData> {
  const [anagraficaResult, visiteResult] = await Promise.all([
    supabase.from("tp_anagrafica").select("*").eq("tp_id", tpId).maybeSingle(),
    supabase.from("tp_visite").select("*").eq("tp_id", tpId).order("data", { ascending: false }),
  ]);

  const anagrafica: TPAnagrafica = {};
  if (anagraficaResult.data) {
    const row = anagraficaResult.data;
    anagrafica.indirizzo = row.indirizzo ?? "";
    anagrafica.referenteNome = row.referente_nome ?? "";
    anagrafica.referenteTelefono = row.referente_telefono ?? "";
    anagrafica.referenteEmail = row.referente_email ?? "";
    anagrafica.note = row.note ?? "";
    anagrafica.fromCSV = row.from_csv ?? false;
  }

  const visite: TPVisita[] = (visiteResult.data ?? []).map(row => ({
    id: row.id as string,
    data: row.data as string,
    rappresentante: row.rappresentante as string,
    note: row.note as string,
  }));

  return { anagrafica, visite };
}

export async function saveTPAnagrafica(tpId: string, anagrafica: TPAnagrafica): Promise<void> {
  const row = {
    tp_id: tpId,
    indirizzo: anagrafica.indirizzo ?? "",
    referente_nome: anagrafica.referenteNome ?? "",
    referente_telefono: anagrafica.referenteTelefono ?? "",
    referente_email: anagrafica.referenteEmail ?? "",
    note: anagrafica.note ?? "",
    from_csv: anagrafica.fromCSV ?? false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("tp_anagrafica")
    .upsert(row, { onConflict: "tp_id" });

  if (error) {
    console.error("[tp-store] saveTPAnagrafica error:", error);
    throw new Error("Errore durante il salvataggio dell'anagrafica");
  }
}

/** Bulk import anagrafica from CSV. Returns counts of updated/new. */
export async function bulkImportAnagrafica(
  rows: { tp_id: string; indirizzo?: string; referente_telefono?: string; referente_email?: string; note?: string }[],
  overwrite: boolean
): Promise<{ updated: number; created: number }> {
  const existingIds = await getExistingAnagraficaIds();
  const existingSet = new Set(existingIds);

  let updated = 0;
  let created = 0;
  const toUpsert = [];

  for (const row of rows) {
    const hasExisting = existingSet.has(row.tp_id);
    if (hasExisting && !overwrite) continue;

    if (hasExisting) updated++;
    else created++;

    // Preserve referenteNome if overwriting
    let referenteNome = "";
    if (hasExisting && overwrite) {
      const { data } = await supabase
        .from("tp_anagrafica")
        .select("referente_nome")
        .eq("tp_id", row.tp_id)
        .maybeSingle();
      referenteNome = data?.referente_nome ?? "";
    }

    toUpsert.push({
      tp_id: row.tp_id,
      indirizzo: row.indirizzo ?? "",
      referente_nome: referenteNome,
      referente_telefono: row.referente_telefono ?? "",
      referente_email: row.referente_email ?? "",
      note: row.note ?? "",
      from_csv: true,
      updated_at: new Date().toISOString(),
    });
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("tp_anagrafica")
      .upsert(toUpsert, { onConflict: "tp_id" });
    if (error) {
      console.error("[tp-store] bulkImportAnagrafica error:", error);
      throw new Error("Errore durante l'import dell'anagrafica");
    }
  }

  return { updated, created };
}

/** Get tp_ids that already have anagrafica data */
export async function getExistingAnagraficaIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("tp_anagrafica")
    .select("tp_id");

  if (error) {
    console.error("[tp-store] getExistingAnagraficaIds error:", error);
    return [];
  }

  return (data ?? []).map(row => row.tp_id as string);
}

// ─── Visite ───────────────────────────────────────────────────────────────────

export async function addTPVisita(tpId: string, visita: Omit<TPVisita, "id">): Promise<TPVisita> {
  const { data, error } = await supabase
    .from("tp_visite")
    .insert({ tp_id: tpId, data: visita.data, rappresentante: visita.rappresentante, note: visita.note })
    .select()
    .single();

  if (error || !data) {
    console.error("[tp-store] addTPVisita error:", error);
    throw new Error("Errore durante il salvataggio della visita");
  }

  return { id: data.id, data: data.data, rappresentante: data.rappresentante, note: data.note };
}

export async function deleteTPVisita(tpId: string, visitaId: string): Promise<void> {
  const { error } = await supabase
    .from("tp_visite")
    .delete()
    .eq("id", visitaId)
    .eq("tp_id", tpId);

  if (error) {
    console.error("[tp-store] deleteTPVisita error:", error);
    throw new Error("Errore durante l'eliminazione della visita");
  }
}

// ─── Anagrafica Import History ────────────────────────────────────────────────

export async function getAnagraficaImportHistory(): Promise<AnagraficaImportMeta[]> {
  const { data, error } = await supabase
    .from("anagrafica_import_history")
    .select("*")
    .order("import_date", { ascending: false });

  if (error) {
    console.error("[tp-store] getAnagraficaImportHistory error:", error);
    return [];
  }

  return (data ?? []).map(row => ({
    id: row.id as string,
    date: row.import_date as string,
    tpCount: Number(row.tp_count),
  }));
}

export async function addAnagraficaImportMeta(meta: Omit<AnagraficaImportMeta, "id">): Promise<void> {
  const { error } = await supabase
    .from("anagrafica_import_history")
    .insert({ import_date: meta.date, tp_count: meta.tpCount });

  if (error) console.error("[tp-store] addAnagraficaImportMeta error:", error);
}

export async function removeAnagraficaImportMeta(id: string): Promise<void> {
  const { error } = await supabase
    .from("anagrafica_import_history")
    .delete()
    .eq("id", id);

  if (error) console.error("[tp-store] removeAnagraficaImportMeta error:", error);
}

// ─── Visit Search ─────────────────────────────────────────────────────────────

export interface VisitSearchResult {
  tpId: string;
  tpNome: string;
  visita: TPVisita;
  matchSnippet: string;
}

/** Search all visit notes across all TPs. Case-insensitive partial match. */
export async function searchAllVisite(query: string, tpNames: Record<string, string>): Promise<VisitSearchResult[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase
    .from("tp_visite")
    .select("*")
    .ilike("note", `%${query}%`)
    .order("data", { ascending: false });

  if (error) {
    console.error("[tp-store] searchAllVisite error:", error);
    return [];
  }

  return (data ?? []).map(row => {
    const note = row.note as string;
    const q = query.toLowerCase();
    const idx = note.toLowerCase().indexOf(q);
    const start = Math.max(0, idx - 30);
    const end = Math.min(note.length, idx + query.length + 30);
    const snippet = (start > 0 ? "…" : "") + note.slice(start, end) + (end < note.length ? "…" : "");

    return {
      tpId: row.tp_id as string,
      tpNome: tpNames[row.tp_id as string] || (row.tp_id as string),
      visita: { id: row.id as string, data: row.data as string, rappresentante: row.rappresentante as string, note },
      matchSnippet: snippet,
    };
  });
}
