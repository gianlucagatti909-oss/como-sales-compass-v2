import { useMemo } from "react";
import { Link } from "react-router-dom";
import { TPWithMetrics } from "@/types/dashboard";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import { CategoryBadge } from "@/components/MetricBadges";
import EmptyState from "@/components/EmptyState";
import { Trophy, Star } from "lucide-react";

interface Props {
  records: TPWithMetrics[];
  hasGiacenza: boolean;
}

export default function TopPerformerPage({ records, hasGiacenza }: Props) {
  const topFatturato = useMemo(() =>
    [...records].sort((a, b) => b.venduto_euro - a.venduto_euro).slice(0, 10),
  [records]);

  const topSTR = useMemo(() =>
    hasGiacenza
      ? [...records].filter(r => r.str !== null).sort((a, b) => b.str! - a.str!).slice(0, 10)
      : [],
  [records, hasGiacenza]);

  const inBoth = useMemo(() => {
    if (!hasGiacenza) return new Set<string>();
    const fatSet = new Set(topFatturato.map(r => r.tp_id));
    return new Set(topSTR.filter(r => fatSet.has(r.tp_id)).map(r => r.tp_id));
  }, [topFatturato, topSTR, hasGiacenza]);

  if (records.length === 0) return <EmptyState />;

  const renderTable = (items: TPWithMetrics[], type: "fatturato" | "str") => (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground text-xs w-8">#</th>
              <th className="px-4 py-3 font-medium text-muted-foreground text-xs">TP</th>
              <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">
                {type === "fatturato" ? "Fatturato" : "STR"}
              </th>
              {hasGiacenza && <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-center">Cat</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={r.tp_id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${inBoth.has(r.tp_id) ? "bg-primary/5" : ""}`}>
                <td className="px-4 py-3 text-muted-foreground font-mono">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <Link to={`/touchpoints/${r.tp_id}`} className="font-medium hover:text-primary hover:underline underline-offset-2 transition-colors">{r.tp_nome}</Link>
                      <div className="text-xs text-muted-foreground">{r.rappresentante}</div>
                    </div>
                    {inBoth.has(r.tp_id) && <Star className="w-3.5 h-3.5 text-primary fill-primary" />}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium">
                  {type === "fatturato" ? formatCurrency(r.venduto_euro) : formatPercent(r.str)}
                </td>
                {hasGiacenza && <td className="px-4 py-3 text-center"><CategoryBadge cat={r.categoria} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Trophy className="w-5 h-5 text-primary" /> Top Performer
      </h2>
      {inBoth.size > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Star className="w-3 h-3 text-primary fill-primary" /> = presente in entrambe le classifiche
        </p>
      )}

      <div className={`grid gap-6 ${hasGiacenza ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Top 10 per fatturato</h3>
          {renderTable(topFatturato, "fatturato")}
        </div>
        {hasGiacenza && topSTR.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Top 10 per STR</h3>
            {renderTable(topSTR, "str")}
          </div>
        )}
      </div>
    </div>
  );
}
