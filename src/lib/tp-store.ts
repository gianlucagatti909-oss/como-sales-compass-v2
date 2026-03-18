/** Local persistence for TP-level editable data: anagrafica overrides and visit logs */

export interface TPAnagrafica {
  indirizzo?: string;
  referenteNome?: string;
  referenteTelefono?: string;
  referenteEmail?: string;
  note?: string;
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

const STORE_KEY = "como1907_tp_local";

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
