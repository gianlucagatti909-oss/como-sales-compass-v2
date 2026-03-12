import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TPWithMetrics, MonthData } from "@/types/dashboard";
import { formatCurrency, formatPercent, formatMonth, enrichRecords, calcSTR } from "@/lib/calculations";
import { getAllMonthsData, getPreviousMonth } from "@/lib/store";
import EmptyState from "@/components/EmptyState";
import { DollarSign, Store, TrendingDown, Percent, Package, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, Area, AreaChart
} from "recharts";

interface Props {
  records: TPWithMetrics[];
  hasGiacenza: boolean;
  selectedMonth: string;
}

// Clickable KPI Card
function KPIDashCard({
  title, value, subtitle, icon, trend, onClick, color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number | null; label: string };
  onClick?: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="kpi-card flex flex-col gap-2 text-left w-full cursor-pointer group hover:scale-[1.02] active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        <span className={`p-1.5 rounded-lg bg-primary/10 text-primary`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="flex items-center justify-between">
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        {trend && trend.value !== null && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trend.value > 0 ? "trend-up" : trend.value < 0 ? "trend-down" : "trend-stable"}`}>
            {trend.value > 0 ? <ArrowUpRight className="w-3 h-3" /> : trend.value < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(trend.value).toFixed(1)}% {trend.label}
          </span>
        )}
      </div>
      <div className="h-0.5 w-0 group-hover:w-full bg-primary/30 transition-all duration-300 rounded-full" />
    </button>
  );
}

const chartTooltipStyle = {
  backgroundColor: "hsl(222, 25%, 11%)",
  border: "1px solid hsl(222, 15%, 18%)",
  borderRadius: "8px",
  color: "hsl(210, 20%, 92%)",
};

export default function HomePage({ records, hasGiacenza, selectedMonth }: Props) {
  const navigate = useNavigate();

  if (records.length === 0 && !selectedMonth) {
    return <EmptyState />;
  }

  const allMonths = useMemo(() => getAllMonthsData(), [selectedMonth]);

  // Current metrics
  const totalFatturato = records.reduce((s, r) => s + r.venduto_euro, 0);
  const totalPezzi = records.reduce((s, r) => s + r.venduto_pezzi, 0);
  const avgStr = hasGiacenza
    ? records.filter(r => r.str !== null).reduce((s, r, _, arr) => s + (r.str! / arr.length), 0)
    : null;
  const activeTP = records.filter(r => r.venduto_euro > 0).length;
  const dormientTP = hasGiacenza ? records.filter(r => r.categoria === "C").length : null;

  // Previous month comparison
  const prevMonth = selectedMonth ? getPreviousMonth(selectedMonth) : undefined;
  const prevFatturato = prevMonth ? prevMonth.records.reduce((s, r) => s + r.venduto_euro, 0) : null;
  const prevPezzi = prevMonth ? prevMonth.records.reduce((s, r) => s + r.venduto_pezzi, 0) : null;
  const fatTrend = prevFatturato && prevFatturato > 0 ? ((totalFatturato - prevFatturato) / prevFatturato) * 100 : null;
  const pezziTrend = prevPezzi && prevPezzi > 0 ? ((totalPezzi - prevPezzi) / prevPezzi) * 100 : null;

  // ABC distribution
  const abcData = hasGiacenza ? [
    { name: "A — Alta rotazione", value: records.filter(r => r.categoria === "A").length, fill: "hsl(152, 60%, 45%)" },
    { name: "B — Media", value: records.filter(r => r.categoria === "B").length, fill: "hsl(45, 93%, 50%)" },
    { name: "C — Dormiente", value: records.filter(r => r.categoria === "C").length, fill: "hsl(0, 65%, 55%)" },
  ] : [];

  // Revenue trend (all months)
  const trendData = useMemo(() => allMonths.map(m => {
    const fat = m.records.reduce((s, r) => s + r.venduto_euro, 0);
    const pezzi = m.records.reduce((s, r) => s + r.venduto_pezzi, 0);
    return { mese: formatMonth(m.mese), fatturato: fat, pezzi };
  }), [allMonths]);

  // STR trend (last 6 months) - only if hasGiacenza
  const strTrendData = useMemo(() => {
    if (!hasGiacenza) return [];
    const last6 = allMonths.slice(-6);
    return last6.map((m, idx) => {
      const prev = idx > 0 ? last6[idx - 1] : undefined;
      const enriched = enrichRecords(m, prev);
      const strs = enriched.filter(r => r.str !== null).map(r => r.str!);
      const avgStr = strs.length > 0 ? strs.reduce((a, b) => a + b, 0) / strs.length : 0;
      return { mese: formatMonth(m.mese), str: parseFloat(avgStr.toFixed(1)) };
    });
  }, [allMonths, hasGiacenza]);

  // Top 10 TP by revenue for bar chart
  const top10TP = useMemo(() => {
    return [...records]
      .sort((a, b) => b.venduto_euro - a.venduto_euro)
      .slice(0, 10)
      .map(r => ({
        nome: r.tp_nome.length > 18 ? r.tp_nome.slice(0, 16) + "…" : r.tp_nome,
        fullName: r.tp_nome,
        fatturato: r.venduto_euro,
        id: r.tp_id,
      }));
  }, [records]);

  return (
    <div className="space-y-6">
      {/* Section title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {selectedMonth ? `Dati al ${formatMonth(selectedMonth)}` : "Carica un CSV per iniziare"}
        </p>
      </div>

      {/* KPI Scorecard Grid */}
      <div className={`grid gap-4 grid-cols-2 ${hasGiacenza ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <KPIDashCard
          title="Revenue totale"
          value={formatCurrency(totalFatturato)}
          icon={<DollarSign className="w-4 h-4" />}
          trend={fatTrend !== null ? { value: fatTrend, label: "vs mese prec." } : undefined}
          onClick={() => navigate("/touchpoints?sort=venduto_euro&dir=desc")}
        />
        <KPIDashCard
          title="Pezzi venduti"
          value={totalPezzi.toLocaleString("it-IT")}
          icon={<Package className="w-4 h-4" />}
          trend={pezziTrend !== null ? { value: pezziTrend, label: "vs mese prec." } : undefined}
          onClick={() => navigate("/touchpoints?sort=venduto_pezzi&dir=desc")}
        />
        {hasGiacenza && (
          <KPIDashCard
            title="STR medio rete"
            value={formatPercent(avgStr)}
            icon={<Percent className="w-4 h-4" />}
            subtitle={`${records.filter(r => r.str !== null).length} TP con dati`}
            onClick={() => navigate("/touchpoints?sort=str&dir=desc")}
          />
        )}
        <KPIDashCard
          title="Touchpoint attivi"
          value={activeTP}
          subtitle={`su ${records.length} totali${dormientTP !== null ? ` · ${dormientTP} dormienti` : ""}`}
          icon={<Store className="w-4 h-4" />}
          onClick={() => navigate("/touchpoints")}
        />
      </div>

      {!hasGiacenza && selectedMonth && (
        <div className="glass-card p-4 text-sm text-muted-foreground flex items-center gap-2">
          ⚠️ Carica <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">giacenza_pezzi</code> per abilitare STR, classificazione ABC e relativi grafici.
        </div>
      )}

      {/* Charts Row 1: Revenue bar + Revenue trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top 10 TP by revenue */}
        {top10TP.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Top 10 Touchpoint per Revenue</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top10TP} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 18%)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" width={120} tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  labelFormatter={(label) => {
                    const item = top10TP.find(t => t.nome === label);
                    return item?.fullName || label;
                  }}
                />
                <Bar
                  dataKey="fatturato"
                  fill="hsl(214, 70%, 55%)"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    if (data?.id) navigate(`/touchpoints/${data.id}`);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Revenue trend line */}
        {trendData.length > 1 && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Trend Revenue Mensile</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(214, 70%, 55%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(214, 70%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 18%)" />
                <XAxis dataKey="mese" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                <Area type="monotone" dataKey="fatturato" stroke="hsl(214, 70%, 55%)" strokeWidth={2.5} fill="url(#revGradient)" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {trendData.length <= 1 && top10TP.length > 0 && (
          <div className="glass-card p-5 flex flex-col items-center justify-center text-muted-foreground">
            <p className="text-sm">Carica più mesi per vedere il trend revenue</p>
          </div>
        )}
      </div>

      {/* Charts Row 2: STR trend + ABC Pie */}
      {hasGiacenza && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* STR trend */}
          {strTrendData.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4">Trend STR Medio — Ultimi 6 mesi</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={strTrendData}>
                  <defs>
                    <linearGradient id="strGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(152, 60%, 45%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(152, 60%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 18%)" />
                  <XAxis dataKey="mese" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [`${value}%`, "STR Medio"]} />
                  <Area type="monotone" dataKey="str" stroke="hsl(152, 60%, 45%)" strokeWidth={2.5} fill="url(#strGradient)" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ABC Pie */}
          {abcData.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4">Distribuzione ABC</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={abcData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={55}
                    paddingAngle={3}
                    label={({ name, value }) => `${name.split(" ")[0]}: ${value}`}
                  >
                    {abcData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
