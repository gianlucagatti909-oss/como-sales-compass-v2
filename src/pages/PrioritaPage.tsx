import { useMemo } from "react";
import { TPWithMetrics } from "@/types/dashboard";
import { getAllMonthsData } from "@/lib/store";
import { formatCurrency, formatPercent, formatMonth } from "@/lib/calculations";
import { CategoryBadge, TrendIcon } from "@/components/MetricBadges";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Props {
  records: TPWithMetrics[];
  hasGiacenza: boolean;
  selectedMonth: string;
}

export default function PrioritaPage({ records, hasGiacenza, selectedMonth }: Props) {
  const allMonths = getAllMonthsData();

  const priorityList = useMemo(() => {
    if (!hasGiacenza) return [];
    const catC = records.filter(r => r.categoria === "C");
    return catC.map(r => {
      const bestMonth = allMonths.reduce<{ mese: string; fatturato: number }>((best, m) => {
        const rec = m.records.find(x => x.tp_id === r.tp_id);
        if (rec && rec.venduto_euro > best.fatturato) {
          return { mese: m.mese, fatturato: rec.venduto_euro };
        }
        return best;
      }, { mese: "", fatturato: 0 });
      return { ...r, bestMese: bestMonth.mese, bestFatturato: bestMonth.fatturato };
    }).sort((a, b) => b.bestFatturato - a.bestFatturato);
  }, [records, allMonths, hasGiacenza]);

  if (!hasGiacenza) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-lg font-bold">Vista non disponibile</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          La lista priorità interventi richiede il campo <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">giacenza_pezzi</code> nel CSV.
        </p>
      </div>
    );
  }

  const exportCSV = () => {
    const header = "tp_id,tp_nome,rappresentante,zona,str_attuale,miglior_mese,miglior_fatturato,trend\n";
    const rows = priorityList.map(r =>
      `${r.tp_id},"${r.tp_nome}",${r.rappresentante},${r.tp_zona},${formatPercent(r.str)},${r.bestMese ? formatMonth(r.bestMese) : "N/D"},${r.bestFatturato},${r.trend}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `priorita_${selectedMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Priorità interventi</h2>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="w-4 h-4" /> Esporta CSV
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">TP in categoria C, ordinati per fatturato potenziale (miglior mese storico).</p>

      {priorityList.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">Nessun TP in categoria C. 🎉</div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">TP</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Rappresentante</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Zona</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">STR attuale</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">Miglior mese</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">Fatt. potenziale</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-center">Trend</th>
                </tr>
              </thead>
              <tbody>
                {priorityList.map(r => (
                  <tr key={r.tp_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.tp_nome}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.tp_id}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{r.rappresentante}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{r.tp_zona}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatPercent(r.str)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.bestMese ? formatMonth(r.bestMese) : "N/D"}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(r.bestFatturato)}</td>
                    <td className="px-4 py-3 text-center"><TrendIcon trend={r.trend} size={14} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
