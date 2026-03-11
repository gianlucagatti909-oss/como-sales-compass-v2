import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TPWithMetrics } from "@/types/dashboard";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import { CategoryBadge, TrendBadge, TrendIcon } from "@/components/MetricBadges";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronRight } from "lucide-react";
import EmptyState from "@/components/EmptyState";

interface Props {
  records: TPWithMetrics[];
  hasGiacenza: boolean;
}

export default function TPListPage({ records, hasGiacenza }: Props) {
  const [search, setSearch] = useState("");
  const [filterRapp, setFilterRapp] = useState("all");
  const [filterZona, setFilterZona] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  if (records.length === 0) return <EmptyState />;

  const rappresentanti = [...new Set(records.map(r => r.rappresentante))].sort();
  const zone = [...new Set(records.map(r => r.tp_zona))].sort();
  const tipi = [...new Set(records.map(r => r.tp_tipo))].sort();

  const filtered = records.filter(r => {
    if (search && !r.tp_nome.toLowerCase().includes(search.toLowerCase()) && !r.tp_id.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRapp !== "all" && r.rappresentante !== filterRapp) return false;
    if (filterZona !== "all" && r.tp_zona !== filterZona) return false;
    if (filterTipo !== "all" && r.tp_tipo !== filterTipo) return false;
    if (hasGiacenza && filterCat !== "all" && r.categoria !== filterCat) return false;
    return true;
  }).sort((a, b) => b.venduto_euro - a.venduto_euro);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca TP..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterRapp} onValueChange={setFilterRapp}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Rappresentante" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            {rappresentanti.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterZona} onValueChange={setFilterZona}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Zona" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            {zone.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            {tipi.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasGiacenza && (
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} touchpoint trovati</div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs">TP</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Tipo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Zona</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Rappresentante</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">Fatturato</th>
                {hasGiacenza && <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">STR</th>}
                {hasGiacenza && <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-center">Cat</th>}
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-center">Trend</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.tp_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.tp_nome}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.tp_id}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{r.tp_tipo}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{r.tp_zona}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{r.rappresentante}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(r.venduto_euro)}</td>
                  {hasGiacenza && <td className="px-4 py-3 text-right font-mono">{formatPercent(r.str)}</td>}
                  {hasGiacenza && <td className="px-4 py-3 text-center"><CategoryBadge cat={r.categoria} /></td>}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TrendIcon trend={r.trend} size={14} />
                      <TrendBadge value={r.trend_fatturato} />
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <Link to={`/touchpoints/${r.tp_id}`} className="text-muted-foreground hover:text-foreground">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
