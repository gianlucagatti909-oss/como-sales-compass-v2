import { useMemo, useState } from "react";
import { TPWithMetrics, MonthData } from "@/types/dashboard";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import { enrichRecords } from "@/lib/calculations";
import EmptyState from "@/components/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Info } from "lucide-react";

interface Props {
  records: TPWithMetrics[];
  hasGiacenza: boolean;
  allMonths: MonthData[];
  availableMonths: string[];
  selectedMonth: string;
}

interface RappStats {
  nome: string;
  fatturato: number;
  avgStr: number | null;
  tpAttivi: number;
  tpTotali: number;
  tpDormienti: number | null;
  tpMigliorati: number | null;
  tpPeggiorati: number | null;
  fatturatoMedioPerTP: number;
}

type PeriodOption = "current" | "3m" | "6m" | "year" | "all";

function getFilteredMonths(allMonths: MonthData[], availableMonths: string[], selectedMonth: string, period: PeriodOption): MonthData[] {
  if (period === "current") {
    return allMonths.filter(m => m.mese === selectedMonth);
  }

  const sorted = [...availableMonths].sort();
  const currentIdx = sorted.indexOf(selectedMonth);
  if (currentIdx === -1) return allMonths;

  let count: number;
  switch (period) {
    case "3m": count = 3; break;
    case "6m": count = 6; break;
    case "year": count = 12; break;
    case "all": return allMonths;
    default: return allMonths;
  }

  const startIdx = Math.max(0, currentIdx - count + 1);
  const selectedKeys = new Set(sorted.slice(startIdx, currentIdx + 1));
  return allMonths.filter(m => selectedKeys.has(m.mese));
}

function aggregateRecords(months: MonthData[]): { records: TPWithMetrics[]; hasGiacenza: boolean } {
  if (months.length === 0) return { records: [], hasGiacenza: false };
  if (months.length === 1) {
    const prev = undefined; // no previous for single month aggregation
    return { records: enrichRecords(months[0], prev), hasGiacenza: months[0].hasGiacenza };
  }

  // Merge all months: sum venduto, average giacenza, aggregate metrics
  const sorted = [...months].sort((a, b) => a.mese.localeCompare(b.mese));
  const hasGiacenza = sorted.some(m => m.hasGiacenza);

  // Collect all TP IDs across all months
  const tpMap = new Map<string, {
    venduto_euro: number;
    venduto_pezzi: number;
    giacenza_pezzi: number | null;
    giacenza_count: number;
    tp_nome: string;
    tp_tipo: string;
    tp_zona: string;
    rappresentante: string;
    mese: string;
    tp_id: string;
  }>();

  for (const month of sorted) {
    for (const r of month.records) {
      const existing = tpMap.get(r.tp_id);
      if (existing) {
        existing.venduto_euro += r.venduto_euro;
        existing.venduto_pezzi += r.venduto_pezzi;
        if (r.giacenza_pezzi !== null) {
          existing.giacenza_pezzi = (existing.giacenza_pezzi ?? 0) + r.giacenza_pezzi;
          existing.giacenza_count += 1;
        }
      } else {
        tpMap.set(r.tp_id, {
          ...r,
          giacenza_count: r.giacenza_pezzi !== null ? 1 : 0,
        });
      }
    }
  }

  // Build enriched-like records
  const records: TPWithMetrics[] = Array.from(tpMap.values()).map(r => {
    const avgGiacenza = r.giacenza_pezzi !== null && r.giacenza_count > 0
      ? r.giacenza_pezzi / r.giacenza_count
      : null;
    const str = avgGiacenza !== null
      ? (r.venduto_pezzi / (r.venduto_pezzi + avgGiacenza)) * 100
      : null;
    const categoria = str === null ? null
      : r.venduto_pezzi === 0 ? "C" as const
      : str > 60 ? "A" as const
      : str >= 40 ? "B" as const
      : "C" as const;

    return {
      tp_id: r.tp_id,
      tp_nome: r.tp_nome,
      tp_tipo: r.tp_tipo,
      tp_zona: r.tp_zona,
      rappresentante: r.rappresentante,
      venduto_pezzi: r.venduto_pezzi,
      venduto_euro: r.venduto_euro,
      giacenza_pezzi: avgGiacenza !== null ? Math.round(avgGiacenza) : null,
      mese: r.mese,
      str,
      categoria,
      trend: "nd" as const,
      trend_fatturato: null,
    };
  });

  return { records, hasGiacenza };
}

export default function RappresentantiPage({ records, hasGiacenza, allMonths, availableMonths, selectedMonth }: Props) {
  const [period, setPeriod] = useState<PeriodOption>("current");

  const { filteredRecords, filteredHasGiacenza } = useMemo(() => {
    if (period === "current") {
      return { filteredRecords: records, filteredHasGiacenza: hasGiacenza };
    }
    const months = getFilteredMonths(allMonths, availableMonths, selectedMonth, period);
    const { records: agg, hasGiacenza: hg } = aggregateRecords(months);
    return { filteredRecords: agg, filteredHasGiacenza: hg };
  }, [period, records, hasGiacenza, allMonths, availableMonths, selectedMonth]);

  const stats = useMemo(() => {
    if (filteredRecords.length === 0) return [];
    const map = new Map<string, TPWithMetrics[]>();
    filteredRecords.forEach(r => {
      if (!map.has(r.rappresentante)) map.set(r.rappresentante, []);
      map.get(r.rappresentante)!.push(r);
    });

    return Array.from(map.entries()).map(([nome, tps]): RappStats => {
      const fatturato = tps.reduce((s, t) => s + t.venduto_euro, 0);
      const tpAttivi = tps.filter(t => t.venduto_euro > 0).length;
      const strs = filteredHasGiacenza ? tps.filter(t => t.str !== null).map(t => t.str!) : [];
      const avgStr = strs.length > 0 ? strs.reduce((a, b) => a + b, 0) / strs.length : null;
      const tpDormienti = filteredHasGiacenza ? tps.filter(t => t.categoria === "C").length : null;
      const tpMigliorati = filteredHasGiacenza ? tps.filter(t => t.trend === "up").length : null;
      const tpPeggiorati = filteredHasGiacenza ? tps.filter(t => t.trend === "down").length : null;

      return {
        nome, fatturato, avgStr, tpAttivi, tpTotali: tps.length,
        tpDormienti, tpMigliorati, tpPeggiorati,
        fatturatoMedioPerTP: tps.length > 0 ? fatturato / tps.length : 0,
      };
    }).sort((a, b) => b.fatturato - a.fatturato);
  }, [filteredRecords, filteredHasGiacenza]);

  if (records.length === 0) return <EmptyState />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-bold">Confronto Rappresentanti</h2>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mese corrente</SelectItem>
            <SelectItem value="3m">Ultimi 3 mesi</SelectItem>
            <SelectItem value="6m">Ultimi 6 mesi</SelectItem>
            <SelectItem value="year">Anno</SelectItem>
            <SelectItem value="all">Tutto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredHasGiacenza && (
        <Accordion type="single" collapsible className="glass-card">
          <AccordionItem value="legend" className="border-none">
            <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Info className="h-4 w-4" />
                Legenda metriche
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid gap-3 text-sm">
                <div>
                  <span className="font-semibold">STR (Sell-Through Rate)</span>
                  <p className="text-muted-foreground">pezzi venduti / (pezzi venduti + giacenza) × 100. Indica la velocità di vendita del punto vendita.</p>
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-category-a/15 category-a text-xs font-bold">A</span>
                    <span className="text-muted-foreground">STR &gt; 60% — Punto vendita ad alta rotazione</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-category-b/15 category-b text-xs font-bold">B</span>
                    <span className="text-muted-foreground">STR tra 40% e 60% — Punto vendita nella media</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-category-c/15 category-c text-xs font-bold">C</span>
                    <span className="text-muted-foreground">STR &lt; 40% o vendite a zero — Punto vendita dormiente</span>
                  </div>
                </div>
                <div>
                  <span className="font-semibold">Trend</span>
                  <p className="text-muted-foreground">Confronto della categoria del mese corrente rispetto al mese precedente (↑ migliorato, ↓ peggiorato, → stabile).</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {stats.map(s => (
          <div key={s.nome} className="glass-card p-5 space-y-3">
            <h3 className="font-semibold text-base">{s.nome}</h3>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div className="text-muted-foreground">Fatturato totale</div>
              <div className="font-mono font-medium text-right">{formatCurrency(s.fatturato)}</div>
              {filteredHasGiacenza && s.avgStr !== null && (
                <>
                  <div className="text-muted-foreground">STR medio</div>
                  <div className="font-mono text-right">{formatPercent(s.avgStr)}</div>
                </>
              )}
              <div className="text-muted-foreground">TP attivi</div>
              <div className="text-right">{s.tpAttivi} / {s.tpTotali}</div>
              {filteredHasGiacenza && s.tpDormienti !== null && (
                <>
                  <div className="text-muted-foreground">TP dormienti</div>
                  <div className="text-right category-c font-medium">{s.tpDormienti}</div>
                </>
              )}
              {filteredHasGiacenza && s.tpMigliorati !== null && (
                <>
                  <div className="text-muted-foreground">TP migliorati</div>
                  <div className="text-right trend-up font-medium">{s.tpMigliorati}</div>
                </>
              )}
              {filteredHasGiacenza && s.tpPeggiorati !== null && (
                <>
                  <div className="text-muted-foreground">TP peggiorati</div>
                  <div className="text-right trend-down font-medium">{s.tpPeggiorati}</div>
                </>
              )}
              <div className="text-muted-foreground">Fatt. medio/TP</div>
              <div className="font-mono text-right">{formatCurrency(s.fatturatoMedioPerTP)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
