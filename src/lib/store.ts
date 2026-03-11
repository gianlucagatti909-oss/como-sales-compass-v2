import { DashboardStore, MonthData, TPRecord } from "@/types/dashboard";

const STORAGE_KEY = "como1907_dashboard";

export function loadStore(): DashboardStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { months: [] };
}

export function saveStore(store: DashboardStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function addMonth(records: TPRecord[], hasGiacenza: boolean): DashboardStore {
  const store = loadStore();
  const mese = records[0]?.mese;
  if (!mese) return store;

  const existing = store.months.findIndex(m => m.mese === mese);
  const monthData: MonthData = { mese, records, hasGiacenza };

  if (existing >= 0) {
    store.months[existing] = monthData;
  } else {
    store.months.push(monthData);
    store.months.sort((a, b) => a.mese.localeCompare(b.mese));
  }

  saveStore(store);
  return store;
}

export function monthExists(mese: string): boolean {
  return loadStore().months.some(m => m.mese === mese);
}

export function getAvailableMonths(): string[] {
  return loadStore().months.map(m => m.mese);
}

export function getMonthData(mese: string): MonthData | undefined {
  return loadStore().months.find(m => m.mese === mese);
}

export function getPreviousMonth(mese: string): MonthData | undefined {
  const store = loadStore();
  const idx = store.months.findIndex(m => m.mese === mese);
  if (idx <= 0) return undefined;
  return store.months[idx - 1];
}

export function getAllMonthsData(): MonthData[] {
  return loadStore().months;
}

export function clearStore(): void {
  localStorage.removeItem(STORAGE_KEY);
}
