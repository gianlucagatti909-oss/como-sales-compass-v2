import { useParams, Link } from "react-router-dom";
import { getAllMonthsData, getPreviousMonth } from "@/lib/store";
import { enrichRecords, formatCurrency, formatPercent, formatMonth, calcSTR, calcCategory } from "@/lib/calculations";
import { CategoryBadge, TrendIcon } from "@/components/MetricBadges";
import { ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function TPDetailPage({ hasGiacenza }: { hasGiacenza: boolean }) {
  const { id } = useParams<{ id: string }>();
  const allMonths = getAllMonthsData();

  const history = allMonths.map(m => {
    const rec = m.records.find(r => r.tp_id === id);
    if (!rec) return { mese: m.mese, meseLabel: formatMonth(m.mese), fatturato: null, str: null, categoria: null };
    const str = calcSTR(rec.venduto_pezzi, rec.giacenza_pezzi);
    const cat = calcCategory(str, rec.venduto_pezzi);
    return { mese: m.mese, meseLabel: formatMonth(m.mese), fatturato: rec.venduto_euro, str, categoria: cat, record: rec };
  });

  const latest = [...history].reverse().find(h => h.fatturato !== null);
  if (!latest?.record) {
    return (
      <div className="space-y-4">
        <Link to="/touchpoints" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Torna alla lista
        </Link>
        <p className="text-muted-foreground">Touchpoint non trovato.</p>
      </div>
    );
  }

  const tp = latest.record;
  const chartData = history.filter(h => h.fatturato !== null);

  return (
    <div className="space-y-6">
      <Link to="/touchpoints" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Torna alla lista
      </Link>

      <div className="glass-card p-6">
        <h1 className="text-xl font-bold">{tp.tp_nome}</h1>
        <p className="text-sm text-muted-foreground font-mono">{tp.tp_id}</p>
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div><span className="text-muted-foreground">Tipo:</span> {tp.tp_tipo}</div>
          <div><span className="text-muted-foreground">Zona:</span> {tp.tp_zona}</div>
          <div><span className="text-muted-foreground">Rappresentante:</span> {tp.rappresentante}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Storico fatturato</h3>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 18%)" />
                <XAxis dataKey="meseLabel" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} tickFormatter={v => `€${v}`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(222, 25%, 11%)", border: "1px solid hsl(222, 15%, 18%)", borderRadius: "8px", color: "hsl(210, 20%, 92%)" }} formatter={(v: number) => [formatCurrency(v), "Fatturato"]} />
                <Line type="monotone" dataKey="fatturato" stroke="hsl(214, 70%, 55%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Dati disponibili per un solo mese.</p>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Dettaglio mesi</h3>
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {history.map(h => (
              <div key={h.mese} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                <span className="text-muted-foreground">{h.meseLabel}</span>
                {h.fatturato !== null ? (
                  <div className="flex items-center gap-3">
                    <span className="font-mono">{formatCurrency(h.fatturato!)}</span>
                    {hasGiacenza && <span className="font-mono text-xs">{formatPercent(h.str)}</span>}
                    {hasGiacenza && <CategoryBadge cat={h.categoria} />}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs italic">Nessun dato</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
