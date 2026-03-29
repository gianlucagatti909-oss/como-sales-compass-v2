import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate, Navigate } from "react-router-dom";
import { MonthData } from "@/types/dashboard";
import { calcSTR, calcCategory, calcTrend, formatCurrency, formatPercent, formatMonth } from "@/lib/calculations";
import { CategoryBadge, TrendIcon, TrendBadge } from "@/components/MetricBadges";
import { getTPLocal, saveTPAnagrafica, addTPVisita, deleteTPVisita, TPAnagrafica, TPVisita } from "@/lib/tp-store";
import { ArrowLeft, Save, Plus, Trash2, Download, MapPin, User, Phone, Mail, FileText, AlertTriangle, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";

export default function TPDetailPage({ hasGiacenza, allMonths }: { hasGiacenza: boolean; allMonths: MonthData[] }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Local TP data loaded async on mount
  const [anagrafica, setAnagrafica] = useState<TPAnagrafica>({});
  const [visite, setVisite] = useState<TPVisita[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [visitNote, setVisitNote] = useState("");
  const [visitRapp, setVisitRapp] = useState("");

  useEffect(() => {
    if (!id) return;
    setLocalLoading(true);
    getTPLocal(id).then(data => {
      setAnagrafica(data.anagrafica);
      setVisite(data.visite);
      setLocalLoading(false);
    }).catch(() => setLocalLoading(false));
  }, [id]);

  // Build history from allMonths prop (no async needed — already in React state)
  const history = useMemo(() => allMonths.map(m => {
    const rec = m.records.find(r => r.tp_id === id);
    if (!rec) return { mese: m.mese, meseLabel: formatMonth(m.mese), fatturato: null, pezzi: null, giacenza: null, str: null, categoria: null, record: null };
    const str = calcSTR(rec.venduto_pezzi, rec.giacenza_pezzi);
    const cat = calcCategory(str, rec.venduto_pezzi);
    return { mese: m.mese, meseLabel: formatMonth(m.mese), fatturato: rec.venduto_euro, pezzi: rec.venduto_pezzi, giacenza: rec.giacenza_pezzi, str, categoria: cat, record: rec };
  }), [allMonths, id]);

  const latest = useMemo(() => [...history].reverse().find(h => h.record !== null), [history]);
  const prevEntry = useMemo(() => {
    if (!latest) return null;
    const idx = history.findIndex(h => h.mese === latest.mese);
    for (let i = idx - 1; i >= 0; i--) {
      if (history[i].record) return history[i];
    }
    return null;
  }, [history, latest]);

  const hasRecentData = useMemo(() => {
    const sorted = allMonths.map(m => m.mese).sort();
    const last2 = sorted.slice(-2);
    return last2.some(mese => history.find(h => h.mese === mese && h.record !== null));
  }, [allMonths, history]);

  // Guard: id must be defined
  if (!id) return <Navigate to="/touchpoints" replace />;

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

  // Network averages
  const allLatestRecords = allMonths.find(m => m.mese === latest.mese)?.records ?? [];
  const avgFatturato = allLatestRecords.length > 0
    ? allLatestRecords.reduce((s, r) => s + r.venduto_euro, 0) / allLatestRecords.length : 0;
  const avgSTR = hasGiacenza && allLatestRecords.length > 0
    ? (() => {
        const valid = allLatestRecords.map(r => calcSTR(r.venduto_pezzi, r.giacenza_pezzi)).filter(s => s !== null) as number[];
        return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
      })() : null;

  // Trend calculations
  const fatDiff = prevEntry?.fatturato != null && prevEntry.fatturato > 0
    ? ((tp.venduto_euro - prevEntry.fatturato) / prevEntry.fatturato) * 100
    : prevEntry?.fatturato === 0 && tp.venduto_euro === 0
    ? 0
    : prevEntry?.fatturato === 0 && tp.venduto_euro > 0
    ? 100
    : null;
  const strDiff = latest.str !== null && prevEntry?.str !== null && prevEntry?.str !== undefined
    ? latest.str - prevEntry.str : null;

  // Sparkline data (last 6 months)
  const sparkData = history.filter(h => h.fatturato !== null).slice(-6);

  // Save anagrafica
  const handleSaveAnagrafica = async () => {
    try {
      await saveTPAnagrafica(id!, anagrafica);
      toast.success("Anagrafica salvata");
    } catch {
      toast.error("Errore durante il salvataggio dell'anagrafica");
    }
  };

  // Add visit
  const handleAddVisit = async () => {
    if (!visitNote.trim()) { toast.error("Inserisci una nota"); return; }
    try {
      const v = await addTPVisita(id!, { data: visitDate, rappresentante: visitRapp || tp.rappresentante, note: visitNote });
      setVisite([v, ...visite]);
      setShowVisitForm(false);
      setVisitNote("");
      setVisitRapp("");
      toast.success("Visita aggiunta");
    } catch {
      toast.error("Errore durante il salvataggio della visita");
    }
  };

  const handleDeleteVisit = async (vid: string) => {
    try {
      await deleteTPVisita(id!, vid);
      setVisite(visite.filter(v => v.id !== vid));
      toast.success("Visita eliminata");
    } catch {
      toast.error("Errore durante l'eliminazione della visita");
    }
  };

  // Export CSV for this TP
  const handleExportCSV = () => {
    const headers = ["Mese", "Venduto Pezzi", "Fatturato €", hasGiacenza ? "Giacenza" : "", hasGiacenza ? "STR%" : "", hasGiacenza ? "Categoria" : ""]
      .filter(Boolean).join(";");
    const rows = history.filter(h => h.record).map(h =>
      [h.meseLabel, h.pezzi, h.fatturato?.toFixed(2), hasGiacenza ? h.giacenza : "", hasGiacenza ? (h.str?.toFixed(1) ?? "N/D") : "", hasGiacenza ? (h.categoria ?? "") : ""]
        .filter((_, i) => hasGiacenza || (i !== 3 && i !== 4 && i !== 5)).join(";")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tp.tp_nome.replace(/\s+/g, "_")}_storico.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const fatVsAvg = avgFatturato > 0 ? ((tp.venduto_euro - avgFatturato) / avgFatturato) * 100 : null;
  const strVsAvg = avgSTR !== null && latest.str !== null ? latest.str - avgSTR : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Indietro
        </button>
        {!hasRecentData && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="w-3 h-3" /> Nessun dato recente
          </span>
        )}
      </div>

      {/* Title card */}
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{tp.tp_nome}</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{tp.tp_id}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span>{tp.tp_tipo}</span>
              <span>{tp.tp_zona}</span>
              <span>{tp.rappresentante}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasGiacenza && <CategoryBadge cat={latest.categoria} />}
            {hasGiacenza && latest.categoria && prevEntry?.categoria && (
              <TrendIcon trend={calcTrend(latest.categoria, prevEntry.categoria)} size={18} />
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
          <TabsTrigger value="visite">Visite</TabsTrigger>
          <TabsTrigger value="storico">Storico</TabsTrigger>
        </TabsList>

        {/* ===== PERFORMANCE ===== */}
        <TabsContent value="performance" className="space-y-4">
          {/* KPI row */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KPIBlock label="Fatturato" value={formatCurrency(tp.venduto_euro)} trend={fatDiff} />
            <KPIBlock label="Pezzi venduti" value={tp.venduto_pezzi.toString()} />
            {hasGiacenza && <KPIBlock label="STR" value={formatPercent(latest.str)} trend={strDiff} suffix="pp" />}
            {hasGiacenza && (
              <div className="glass-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Categoria ABC</div>
                <div className="flex items-center gap-2">
                  <CategoryBadge cat={latest.categoria} />
                  {prevEntry?.categoria && prevEntry.categoria !== latest.categoria && (
                    <span className="text-xs text-muted-foreground">da {prevEntry.categoria}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Network comparison */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Confronto media rete</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              {fatVsAvg !== null && (
                <div>
                  <span className="text-muted-foreground">Fatturato: </span>
                  <span className={fatVsAvg >= 0 ? "text-[hsl(var(--trend-up))] font-medium" : "text-[hsl(var(--trend-down))] font-medium"}>
                    {fatVsAvg >= 0 ? "+" : ""}{fatVsAvg.toFixed(1)}% vs media
                  </span>
                </div>
              )}
              {strVsAvg !== null && (
                <div>
                  <span className="text-muted-foreground">STR: </span>
                  <span className={strVsAvg >= 0 ? "text-[hsl(var(--trend-up))] font-medium" : "text-[hsl(var(--trend-down))] font-medium"}>
                    {strVsAvg >= 0 ? "+" : ""}{strVsAvg.toFixed(1)}pp vs media
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sparklines */}
          {sparkData.length > 1 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="glass-card p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fatturato ultimi 6 mesi</h3>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={sparkData} margin={{ bottom: 0 }}>
                    <XAxis dataKey="meseLabel" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      formatter={(v: number) => [formatCurrency(v), "Fatturato"]} labelFormatter={(l) => l} />
                    <Line type="monotone" dataKey="fatturato" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--chart-1))" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {hasGiacenza && sparkData.some(s => s.str !== null) && (
                <div className="glass-card p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">STR ultimi 6 mesi</h3>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={sparkData} margin={{ bottom: 0 }}>
                      <XAxis dataKey="meseLabel" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(v: number) => [formatPercent(v), "STR"]} labelFormatter={(l) => l} />
                      <Line type="monotone" dataKey="str" stroke="hsl(var(--category-a))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--category-a))" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ===== ANAGRAFICA ===== */}
        <TabsContent value="anagrafica" className="space-y-4">
          {localLoading ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">Caricamento anagrafica...</div>
          ) : (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold">Informazioni TP</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Indirizzo</label>
                  <Input value={anagrafica.indirizzo ?? ""} onChange={e => setAnagrafica({ ...anagrafica, indirizzo: e.target.value })} placeholder="Via, Città..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Nome referente</label>
                  <Input value={anagrafica.referenteNome ?? ""} onChange={e => setAnagrafica({ ...anagrafica, referenteNome: e.target.value })} placeholder="Nome e cognome" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Telefono</label>
                  <Input value={anagrafica.referenteTelefono ?? ""} onChange={e => setAnagrafica({ ...anagrafica, referenteTelefono: e.target.value })} placeholder="+39..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
                  <Input value={anagrafica.referenteEmail ?? ""} onChange={e => setAnagrafica({ ...anagrafica, referenteEmail: e.target.value })} placeholder="email@..." />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> Note generali</label>
                <Textarea value={anagrafica.note ?? ""} onChange={e => setAnagrafica({ ...anagrafica, note: e.target.value })} placeholder="Note sul touchpoint..." rows={3} />
              </div>
              <Button size="sm" onClick={handleSaveAnagrafica} className="gap-2">
                <Save className="w-4 h-4" /> Salva anagrafica
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ===== VISITE ===== */}
        <TabsContent value="visite" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Storico visite</h3>
            <Button size="sm" variant="outline" onClick={() => setShowVisitForm(true)} className="gap-1">
              <Plus className="w-4 h-4" /> Aggiungi visita
            </Button>
          </div>

          {localLoading ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">Caricamento visite...</div>
          ) : visite.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">
              Nessuna visita registrata
            </div>
          ) : (
            <div className="space-y-2">
              {visite.map((v, i) => (
                <div key={v.id} className={`glass-card p-4 ${i === 0 ? "ring-1 ring-primary/30" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <CalendarDays className="w-3 h-3" />
                        {new Date(v.data).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                        <span className="font-medium text-foreground">{v.rappresentante}</span>
                        {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Ultima</span>}
                      </div>
                      <p className="text-sm">{v.note}</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button aria-label="Elimina visita" className="text-muted-foreground hover:text-destructive shrink-0 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminare questa visita?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Visita del {new Date(v.data).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })} — {v.rappresentante}. L'azione non è reversibile.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteVisit(v.id)}
                          >
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add visit dialog */}
          <Dialog open={showVisitForm} onOpenChange={setShowVisitForm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuova visita</DialogTitle>
                <DialogDescription>Registra una visita per {tp.tp_nome}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Data</label>
                  <Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Rappresentante</label>
                  <Input value={visitRapp} onChange={e => setVisitRapp(e.target.value)} placeholder={tp.rappresentante} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Note</label>
                  <Textarea value={visitNote} onChange={e => setVisitNote(e.target.value)} placeholder="Descrivi la visita..." rows={4} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowVisitForm(false)}>Annulla</Button>
                <Button onClick={handleAddVisit}>Salva visita</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== STORICO MENSILE ===== */}
        <TabsContent value="storico" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Storico mensile completo</h3>
            <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1">
              <Download className="w-4 h-4" /> Esporta CSV
            </Button>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Mese</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">Pezzi</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">Fatturato</th>
                    {hasGiacenza && <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">Giacenza</th>}
                    {hasGiacenza && <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">STR%</th>}
                    {hasGiacenza && <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-center">Cat</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map(h => (
                    <tr key={h.mese} className="border-b border-border/50">
                      <td className="px-4 py-2.5 text-muted-foreground">{h.meseLabel}</td>
                      {h.record ? (
                        <>
                          <td className="px-4 py-2.5 text-right font-mono">{h.pezzi}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCurrency(h.fatturato!)}</td>
                          {hasGiacenza && <td className="px-4 py-2.5 text-right font-mono">{h.giacenza ?? "—"}</td>}
                          {hasGiacenza && <td className="px-4 py-2.5 text-right font-mono">{formatPercent(h.str)}</td>}
                          {hasGiacenza && <td className="px-4 py-2.5 text-center"><CategoryBadge cat={h.categoria} /></td>}
                        </>
                      ) : (
                        <td colSpan={hasGiacenza ? 5 : 2} className="px-4 py-2.5 text-muted-foreground text-xs italic text-center">Nessun dato</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Small KPI block used in Performance tab */
function KPIBlock({ label, value, trend, suffix = "%" }: { label: string; value: string; trend?: number | null; suffix?: string }) {
  return (
    <div className="glass-card p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-bold font-mono">{value}</div>
      {trend !== null && trend !== undefined && (
        <div className={`text-xs font-medium mt-0.5 ${trend >= 0 ? "text-[hsl(var(--trend-up))]" : "text-[hsl(var(--trend-down))]"}`}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}{suffix} vs mese prec.
        </div>
      )}
    </div>
  );
}
