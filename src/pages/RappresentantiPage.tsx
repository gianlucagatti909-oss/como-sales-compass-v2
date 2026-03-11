import { useMemo } from "react";
import { TPWithMetrics } from "@/types/dashboard";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import EmptyState from "@/components/EmptyState";

interface Props {
  records: TPWithMetrics[];
  hasGiacenza: boolean;
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

export default function RappresentantiPage({ records, hasGiacenza }: Props) {
  if (records.length === 0) return <EmptyState />;

  const stats = useMemo(() => {
    const map = new Map<string, TPWithMetrics[]>();
    records.forEach(r => {
      if (!map.has(r.rappresentante)) map.set(r.rappresentante, []);
      map.get(r.rappresentante)!.push(r);
    });

    return Array.from(map.entries()).map(([nome, tps]): RappStats => {
      const fatturato = tps.reduce((s, t) => s + t.venduto_euro, 0);
      const tpAttivi = tps.filter(t => t.venduto_euro > 0).length;
      const strs = hasGiacenza ? tps.filter(t => t.str !== null).map(t => t.str!) : [];
      const avgStr = strs.length > 0 ? strs.reduce((a, b) => a + b, 0) / strs.length : null;
      const tpDormienti = hasGiacenza ? tps.filter(t => t.categoria === "C").length : null;
      const tpMigliorati = hasGiacenza ? tps.filter(t => t.trend === "up").length : null;
      const tpPeggiorati = hasGiacenza ? tps.filter(t => t.trend === "down").length : null;

      return {
        nome, fatturato, avgStr, tpAttivi, tpTotali: tps.length,
        tpDormienti, tpMigliorati, tpPeggiorati,
        fatturatoMedioPerTP: tps.length > 0 ? fatturato / tps.length : 0,
      };
    }).sort((a, b) => b.fatturato - a.fatturato);
  }, [records, hasGiacenza]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Confronto Rappresentanti</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {stats.map(s => (
          <div key={s.nome} className="glass-card p-5 space-y-3">
            <h3 className="font-semibold text-base">{s.nome}</h3>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div className="text-muted-foreground">Fatturato totale</div>
              <div className="font-mono font-medium text-right">{formatCurrency(s.fatturato)}</div>
              {hasGiacenza && s.avgStr !== null && (
                <>
                  <div className="text-muted-foreground">STR medio</div>
                  <div className="font-mono text-right">{formatPercent(s.avgStr)}</div>
                </>
              )}
              <div className="text-muted-foreground">TP attivi</div>
              <div className="text-right">{s.tpAttivi} / {s.tpTotali}</div>
              {hasGiacenza && s.tpDormienti !== null && (
                <>
                  <div className="text-muted-foreground">TP dormienti</div>
                  <div className="text-right category-c font-medium">{s.tpDormienti}</div>
                </>
              )}
              {hasGiacenza && s.tpMigliorati !== null && (
                <>
                  <div className="text-muted-foreground">TP migliorati</div>
                  <div className="text-right trend-up font-medium">{s.tpMigliorati}</div>
                </>
              )}
              {hasGiacenza && s.tpPeggiorati !== null && (
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
