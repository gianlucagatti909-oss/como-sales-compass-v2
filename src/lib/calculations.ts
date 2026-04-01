import { TPRecord, TPWithMetrics, ABCCategory, TrendDirection, MonthData } from "@/types/dashboard";

export function calcSTR(venduto: number, giacenza: number | null): number | null {
  if (giacenza === null) return null;
  const denom = venduto + giacenza;
  if (denom === 0) return null;
  return (venduto / denom) * 100;
}

export function calcCategory(str: number | null, venduto_pezzi: number): ABCCategory | null {
  if (str === null) return null;
  if (venduto_pezzi === 0) return "C";
  if (str > 60) return "A";
  if (str >= 40) return "B";
  return "C";
}

export function calcTrend(current: ABCCategory | null, previous: ABCCategory | null): TrendDirection {
  if (!current || !previous) return "nd";
  const order: Record<ABCCategory, number> = { A: 3, B: 2, C: 1 };
  const diff = order[current] - order[previous];
  if (diff > 0) return "up";
  if (diff < 0) return "down";
  return "stable";
}

export function enrichRecords(
  currentMonth: MonthData,
  previousMonth: MonthData | undefined
): TPWithMetrics[] {
  const prevMap = new Map<string, TPRecord>();
  previousMonth?.records.forEach(r => prevMap.set(r.tp_id, r));

  return currentMonth.records.map(r => {
    const str = calcSTR(r.venduto_pezzi, r.giacenza_pezzi);
    const categoria = calcCategory(str, r.venduto_pezzi);
    const prev = prevMap.get(r.tp_id);
    const prevStr = prev ? calcSTR(prev.venduto_pezzi, prev.giacenza_pezzi) : null;
    const prevCat = prev ? calcCategory(prevStr, prev.venduto_pezzi) : null;
    const trend = calcTrend(categoria, prevCat);

    let trend_fatturato: number | null = null;
    if (prev && prev.venduto_euro > 0) {
      trend_fatturato = ((r.venduto_euro - prev.venduto_euro) / prev.venduto_euro) * 100;
    } else if (prev && prev.venduto_euro === 0 && r.venduto_euro > 0) {
      trend_fatturato = 100;
    } else if (prev && prev.venduto_euro === 0 && r.venduto_euro === 0) {
      trend_fatturato = 0;
    }

    return { ...r, str, categoria, trend, trend_fatturato };
  });
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);
}

export function formatPercent(val: number | null): string {
  if (val === null) return "N/D";
  if (!isFinite(val)) return "N/D";
  return `${val.toFixed(1)}%`;
}

export function formatMonth(mese: string): string {
  const [y, m] = mese.split("-");
  const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export function aggregateMultiMonthRecords(
  allMonths: MonthData[],
  selectedMonths: string[]
): { records: TPWithMetrics[]; hasGiacenza: boolean } {
  let hasGiacenza = false;
  const tpMap = new Map<string, { euro: number; pezzi: number; strSum: number; strCount: number; base: TPWithMetrics }>();

  const sorted = [...selectedMonths].sort();
  for (const mese of sorted) {
    const monthData = allMonths.find(m => m.mese === mese);
    if (!monthData) continue;
    if (monthData.hasGiacenza) hasGiacenza = true;
    const monthIdx = allMonths.findIndex(m => m.mese === mese);
    const prev = monthIdx > 0 ? allMonths[monthIdx - 1] : undefined;
    const enriched = enrichRecords(monthData, prev);
    for (const r of enriched) {
      const entry = tpMap.get(r.tp_id);
      if (entry) {
        entry.euro += r.venduto_euro;
        entry.pezzi += r.venduto_pezzi;
        if (r.str !== null) { entry.strSum += r.str; entry.strCount++; }
        entry.base = r;
      } else {
        tpMap.set(r.tp_id, {
          euro: r.venduto_euro,
          pezzi: r.venduto_pezzi,
          strSum: r.str ?? 0,
          strCount: r.str !== null ? 1 : 0,
          base: r,
        });
      }
    }
  }

  const records: TPWithMetrics[] = [...tpMap.values()].map(({ euro, pezzi, strSum, strCount, base }) => ({
    ...base,
    venduto_euro: euro,
    venduto_pezzi: pezzi,
    str: strCount > 0 ? strSum / strCount : null,
  }));

  return { records, hasGiacenza };
}
