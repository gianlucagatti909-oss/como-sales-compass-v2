import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TPWithMetrics } from "@/types/dashboard";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import { CategoryBadge, TrendBadge, TrendIcon } from "@/components/MetricBadges";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronRight, MessageSquareText, CalendarDays, X } from "lucide-react";
import { searchAllVisite, VisitSearchResult } from "@/lib/tp-store";
import EmptyState from "@/components/EmptyState";

interface Props {
  records: TPWithMetrics[];
  hasGiacenza: boolean;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  const lc = text.toLowerCase();
  const qlc = query.toLowerCase();
  let lastIdx = 0;
  let idx = lc.indexOf(qlc);
  while (idx !== -1) {
    if (idx > lastIdx) parts.push(text.slice(lastIdx, idx));
    parts.push(<mark key={idx} className="bg-primary/25 text-foreground rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>);
    lastIdx = idx + query.length;
    idx = lc.indexOf(qlc, lastIdx);
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return <>{parts}</>;
}

export default function TPListPage({ records, hasGiacenza }: Props) {
  const [search, setSearch] = useState("");
  const [filterRapp, setFilterRapp] = useState("all");
  const [filterZona, setFilterZona] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [visitSearch, setVisitSearch] = useState("");
  const [showVisitSearch, setShowVisitSearch] = useState(false);

  // Build tp_id -> name map for visit search
  const tpNames = useMemo(() => {
    const m: Record<string, string> = {};
    records.forEach(r => { m[r.tp_id] = r.tp_nome; });
    return m;
  }, [records]);

  const visitResults = useMemo(() => {
    if (!visitSearch.trim()) return [];
    return searchAllVisite(visitSearch, tpNames);
  }, [visitSearch, tpNames]);

  if (records.length === 0) return <EmptyState />;

  const rappresentanti = [...new Set(records.map(r => r.rappresentante).filter(Boolean))].sort();
  const zone = [...new Set(records.map(r => r.tp_zona).filter(Boolean))].sort();
  const tipi = [...new Set(records.map(r => r.tp_tipo).filter(Boolean))].sort();

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
        <button
          onClick={() => setShowVisitSearch(!showVisitSearch)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${showVisitSearch ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
          title="Cerca nelle note visite"
        >
          <MessageSquareText className="w-4 h-4" /> Note visite
        </button>
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

      {/* Visit notes search panel */}
      {showVisitSearch && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageSquareText className="w-4 h-4" /> Cerca nelle note visite
            </h3>
            <button onClick={() => { setShowVisitSearch(false); setVisitSearch(""); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca parola chiave nelle note (es. maglietta, codice xy62...)"
              value={visitSearch}
              onChange={e => setVisitSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          {visitSearch.trim() && (
            <div className="text-xs text-muted-foreground">
              {visitResults.length} risultat{visitResults.length === 1 ? "o" : "i"} trovat{visitResults.length === 1 ? "o" : "i"}
            </div>
          )}
          {visitResults.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {visitResults.map(r => (
                <Link
                  key={r.visita.id}
                  to={`/touchpoints/${r.tpId}`}
                  className="block glass-card p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">{r.tpNome}</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <CalendarDays className="w-3 h-3" />
                      {new Date(r.visita.data).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">{r.visita.rappresentante}</div>
                  <p className="text-sm">
                    <HighlightText text={r.matchSnippet} query={visitSearch} />
                  </p>
                </Link>
              ))}
            </div>
          )}
          {visitSearch.trim() && visitResults.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              Nessuna nota trovata per "{visitSearch}"
            </div>
          )}
        </div>
      )}

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
