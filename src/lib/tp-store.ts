/** Local persistence for TP-level editable data: anagrafica overrides and visit logs */

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
  date: string; // ISO
  tpCount: number;
}

const STORE_KEY = "como1907_tp_local";
const IMPORT_HISTORY_KEY = "como1907_anagrafica_imports";

function loadAll(): Record<string, TPLocalData> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveAll(data: Record<string, TPLocalData>): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function ensureTP(all: Record<string, TPLocalData>, tpId: string): TPLocalData {
  if (!all[tpId]) {
    all[tpId] = { anagrafica: {}, visite: [] };
  }
  return all[tpId];
}

export function getTPLocal(tpId: string): TPLocalData {
  const all = loadAll();
  return all[tpId] ?? { anagrafica: {}, visite: [] };
}

export function saveTPAnagrafica(tpId: string, anagrafica: TPAnagrafica): void {
  const all = loadAll();
  ensureTP(all, tpId);
  all[tpId].anagrafica = anagrafica;
  saveAll(all);
}

/** Bulk import anagrafica from CSV. Returns counts of updated/new. */
export function bulkImportAnagrafica(
  rows: { tp_id: string; indirizzo?: string; referente_telefono?: string; referente_email?: string; note?: string }[],
  overwrite: boolean
): { updated: number; created: number } {
  const all = loadAll();
  let updated = 0;
  let created = 0;

  for (const row of rows) {
    const existing = all[row.tp_id];
    const hasExisting = existing && Object.values(existing.anagrafica).some(v => v);

    if (hasExisting && !overwrite) continue;

    if (hasExisting) updated++;
    else created++;

    ensureTP(all, row.tp_id);
    all[row.tp_id].anagrafica = {
      indirizzo: row.indirizzo ?? "",
      referenteNome: "", // Not in CSV - kept from existing if any
      referenteTelefono: row.referente_telefono ?? "",
      referenteEmail: row.referente_email ?? "",
      note: row.note ?? "",
      fromCSV: true,
    };
    // Preserve existing referenteNome if we're overwriting
    if (hasExisting && existing.anagrafica.referenteNome) {
      all[row.tp_id].anagrafica.referenteNome = existing.anagrafica.referenteNome;
    }
  }

  saveAll(all);
  return { updated, created };
}

/** Get tp_ids that already have anagrafica data */
export function getExistingAnagraficaIds(): string[] {
  const all = loadAll();
  return Object.keys(all).filter(id => {
    const a = all[id].anagrafica;
    return a && Object.values(a).some(v => v);
  });
}

export function addTPVisita(tpId: string, visita: Omit<TPVisita, "id">): TPVisita {
  const all = loadAll();
  ensureTP(all, tpId);
  const newVisita: TPVisita = { ...visita, id: `v-${Date.now()}` };
  all[tpId].visite.unshift(newVisita);
  saveAll(all);
  return newVisita;
}

export function deleteTPVisita(tpId: string, visitaId: string): void {
  const all = loadAll();
  if (!all[tpId]) return;
  all[tpId].visite = all[tpId].visite.filter(v => v.id !== visitaId);
  saveAll(all);
}

// Anagrafica import history
export function getAnagraficaImportHistory(): AnagraficaImportMeta[] {
  try {
    const raw = localStorage.getItem(IMPORT_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function addAnagraficaImportMeta(meta: AnagraficaImportMeta): void {
  const history = getAnagraficaImportHistory();
  history.push(meta);
  localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(history));
}

export function removeAnagraficaImportMeta(index: number): void {
  const history = getAnagraficaImportHistory();
  history.splice(index, 1);
  localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(history));
}

export interface VisitSearchResult {
  tpId: string;
  tpNome: string;
  visita: TPVisita;
  matchSnippet: string;
}

/** Search all visit notes across all TPs. Case-insensitive partial match. */
export function searchAllVisite(query: string, tpNames: Record<string, string>): VisitSearchResult[] {
  if (!query.trim()) return [];
  const all = loadAll();
  const q = query.toLowerCase();
  const results: VisitSearchResult[] = [];

  for (const [tpId, data] of Object.entries(all)) {
    for (const visita of data.visite) {
      const noteLC = visita.note.toLowerCase();
      const idx = noteLC.indexOf(q);
      if (idx === -1) continue;

      const start = Math.max(0, idx - 30);
      const end = Math.min(visita.note.length, idx + query.length + 30);
      const snippet = (start > 0 ? "…" : "") + visita.note.slice(start, end) + (end < visita.note.length ? "…" : "");

      results.push({
        tpId,
        tpNome: tpNames[tpId] || tpId,
        visita,
        matchSnippet: snippet,
      });
    }
  }

  results.sort((a, b) => b.visita.data.localeCompare(a.visita.data));
  return results;
}
