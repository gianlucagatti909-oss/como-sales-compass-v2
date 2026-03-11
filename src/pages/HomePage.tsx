import { useMemo } from "react";
import { TPWithMetrics } from "@/types/dashboard";
import { formatCurrency, formatPercent, formatMonth } from "@/lib/calculations";
import { enrichRecords } from "@/lib/calculations";
import { getAllMonthsData, getPreviousMonth } from "@/lib/store";
import KPICard from "@/components/KPICard";
import { CategoryBadge, TrendIcon } from "@/components/MetricBadges";
import EmptyState from "@/components/EmptyState";
import { DollarSign, Store, TrendingDown, Percent } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

interface Props {
  records: TPWithMetrics[];
  hasGiacenza: boolean;
  selectedMonth: string;
}

export default function HomePage({ records, hasGiacenza, selectedMonth }: Props) {
  if (records.length === 0 && !selectedMonth) {
    return <EmptyState />;
  }

  const totalFatturato = records.reduce((s, r) => s + r.venduto_euro, 0);
  const avgStr = hasGiacenza
    ? records.filter(r => r.str !== null).reduce((s, r, _, arr) => s + (r.str! / arr.length), 0)
    : null;
  const activeTP = records.filter(r => r.venduto_euro > 0).length;
  const dormientTP = hasGiacenza ? records.filter(r => r.categoria === "C").length : null;

  const abcData = hasGiacenza ? [
    { name: "A", value: records.filter(r => r.categoria === "A").length, fill: "hsl(152, 60%, 45%)" },
    { name: "B", value: records.filter(r => r.categoria === "B").length, fill: "hsl(45, 93%, 50%)" },
    { name: "C", value: records.filter(r => r.categoria === "C").length, fill: "hsl(0, 65%, 55%)" },
  ] : [];

  const allMonths = getAllMonthsData();
  const trendData = allMonths.map(m => {
    const fat = m.records.reduce((s, r) => s + r.venduto_euro, 0);
    return { mese: formatMonth(m.mese), fatturato: fat };
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className={`grid gap-4 ${hasGiacenza ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3"}`}>
        <KPICard title="Fatturato mese" value={formatCurrency(totalFatturato)} icon={<DollarSign className="w-4 h-4" />} />
        {hasGiacenza && (
          <KPICard title="STR medio rete" value={formatPercent(avgStr)} icon={<Percent className="w-4 h-4" />} />
        )}
        <KPICard title="TP attivi" value={activeTP} subtitle={`su ${records.length} totali`} icon={<Store className="w-4 h-4" />} />
        {hasGiacenza && dormientTP !== null && (
          <KPICard title="TP dormienti (C)" value={dormientTP} icon={<TrendingDown className="w-4 h-4" />} />
        )}
      </div>

      {!hasGiacenza && selectedMonth && (
        <div className="glass-card p-4 text-sm text-muted-foreground flex items-center gap-2">
          ⚠️ Carica <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">giacenza_pezzi</code> per abilitare la classificazione completa (STR & ABC).
        </div>
      )}

      <div className={`grid gap-4 ${hasGiacenza ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
        {/* ABC Pie */}
        {hasGiacenza && abcData.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Distribuzione ABC</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={abcData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                  {abcData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(222, 25%, 11%)", border: "1px solid hsl(222, 15%, 18%)", borderRadius: "8px", color: "hsl(210, 20%, 92%)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Trend line */}
        {trendData.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Trend fatturato mensile</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 18%)" />
                <XAxis dataKey="mese" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(222, 25%, 11%)", border: "1px solid hsl(222, 15%, 18%)", borderRadius: "8px", color: "hsl(210, 20%, 92%)" }}
                  formatter={(value: number) => [formatCurrency(value), "Fatturato"]}
                />
                <Line type="monotone" dataKey="fatturato" stroke="hsl(214, 70%, 55%)" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
