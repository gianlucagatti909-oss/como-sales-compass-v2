import { useState, useMemo, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { UserProfile, UserRole } from "@/types/auth";
import { getUsers, addUser, updateUser, toggleUserEnabled } from "@/lib/auth-store";
import { getImportHistory, removeImportMeta, getABCThresholds, saveABCThresholds, getRappresentantiMap, saveRappresentantiMap } from "@/lib/settings-store";
import { deleteMonth, getMonthData } from "@/lib/store";
import { formatMonth, formatCurrency } from "@/lib/calculations";
import { ABCThresholds, ImportMeta } from "@/types/settings";
import { bulkImportAnagrafica, getExistingAnagraficaIds, getAnagraficaImportHistory, addAnagraficaImportMeta, removeAnagraficaImportMeta, AnagraficaImportMeta } from "@/lib/tp-store";
import { parseAnagraficaCSV, generateAnagraficaTemplate } from "@/lib/anagrafica-parser";
import { Users, History, Settings, Plus, UserCheck, UserX, Trash2, Download, Upload, FileSpreadsheet, Database } from "lucide-react";
import { toast } from "sonner";

interface UploadResult {
  success: boolean;
  message: string;
  needsConfirm?: boolean;
  mese?: string;
  summary?: string;
}

interface Props {
  isAdmin: boolean;
  currentUserId: string | null;
  onDataChange: () => void;
  availableRappresentanti: string[];
  onUpload: (csv: string) => UploadResult;
  onConfirmUpload: (csv: string) => void;
}

// ===================== USERS TAB =====================
function UsersTab({ isAdmin, currentUserId, availableRappresentanti }: { isAdmin: boolean; currentUserId: string | null; availableRappresentanti: string[] }) {
  const [users, setUsers] = useState<UserProfile[]>(getUsers);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", displayName: "", role: "rappresentante" as UserRole, rappresentante: "" });

  const refreshUsers = () => setUsers(getUsers());

  const handleAdd = () => {
    try {
      addUser(newUser);
      refreshUsers();
      setShowAdd(false);
      setNewUser({ username: "", password: "", displayName: "", role: "rappresentante", rappresentante: "" });
      toast.success("Utente creato");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggle = (id: string) => {
    toggleUserEnabled(id);
    refreshUsers();
  };

  if (!isAdmin) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground">
        Solo il Sales Manager può gestire gli utenti.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Utenti registrati</h3>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" /> Nuovo utente
        </Button>
      </div>

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className={`glass-card p-4 flex items-center justify-between gap-4 ${!u.enabled ? "opacity-50" : ""}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{u.displayName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {u.role === "admin" ? "Sales Manager" : "Rappresentante"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">@{u.username}</div>
              {u.rappresentante && <div className="text-xs text-muted-foreground mt-0.5">Collegato a: {u.rappresentante}</div>}
            </div>
            {u.id !== "admin-001" && (
              <Button variant="ghost" size="icon" onClick={() => handleToggle(u.id)} title={u.enabled ? "Disabilita" : "Abilita"}>
                {u.enabled ? <UserX className="w-4 h-4 text-destructive" /> : <UserCheck className="w-4 h-4 text-primary" />}
              </Button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo utente</DialogTitle>
            <DialogDescription>Crea un nuovo profilo per accedere alla dashboard.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome visualizzato" value={newUser.displayName} onChange={e => setNewUser(p => ({ ...p, displayName: e.target.value }))} />
            <Input placeholder="Username" value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} />
            <Input type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
            <Select value={newUser.role} onValueChange={(v) => setNewUser(p => ({ ...p, role: v as UserRole }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Sales Manager</SelectItem>
                <SelectItem value="rappresentante">Rappresentante</SelectItem>
              </SelectContent>
            </Select>
            {newUser.role === "rappresentante" && (
              <Select value={newUser.rappresentante} onValueChange={(v) => setNewUser(p => ({ ...p, rappresentante: v }))}>
                <SelectTrigger><SelectValue placeholder="Collega a rappresentante CSV" /></SelectTrigger>
                <SelectContent>
                  {availableRappresentanti.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annulla</Button>
            <Button onClick={handleAdd} disabled={!newUser.username || !newUser.password || !newUser.displayName}>Crea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===================== IMPORT HISTORY TAB =====================
function ImportHistoryTab({ isAdmin, onDataChange }: { isAdmin: boolean; onDataChange: () => void }) {
  const [history, setHistory] = useState<ImportMeta[]>(getImportHistory);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = (mese: string) => {
    deleteMonth(mese);
    removeImportMeta(mese);
    setHistory(getImportHistory());
    setConfirmDelete(null);
    onDataChange();
    toast.success(`Dati di ${formatMonth(mese)} eliminati`);
  };

  const handleExport = (mese: string) => {
    const data = getMonthData(mese);
    if (!data) return;
    const header = "tp_id;tp_nome;tp_tipo;tp_zona;rappresentante;venduto_pezzi;venduto_euro;giacenza_pezzi;mese\n";
    const rows = data.records.map(r =>
      `${r.tp_id};"${r.tp_nome}";${r.tp_tipo};${r.tp_zona};${r.rappresentante};${r.venduto_pezzi};${r.venduto_euro.toFixed(2).replace(".", ",")};${r.giacenza_pezzi ?? ""};${r.mese}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `export_${mese}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Storico import ({history.length} mesi)</h3>

      {history.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {history.map((h, i) => (
              <div key={h.mese} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatMonth(h.mese)}</span>
                </div>
                {i < history.length - 1 && <div className="w-8 h-px bg-border mx-1 mt-[-12px]" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">
          Nessun import registrato. Carica un CSV per iniziare.
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Mese</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Data upload</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">TP</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">Fatturato</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.mese} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{formatMonth(h.mese)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(h.uploadDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-4 py-3 text-right font-mono">{h.tpCount}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(h.totalFatturato)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExport(h.mese)} title="Riesporta CSV">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(h.mese)} title="Elimina">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminare i dati?</DialogTitle>
            <DialogDescription>
              I dati di {confirmDelete ? formatMonth(confirmDelete) : ""} verranno eliminati definitivamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Annulla</Button>
            <Button variant="destructive" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===================== ANAGRAFICA TP TAB =====================
function AnagraficaTPTab({ isAdmin }: { isAdmin: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importHistory, setImportHistory] = useState<AnagraficaImportMeta[]>(getAnagraficaImportHistory);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingRows, setPendingRows] = useState<any[]>([]);
  const [pendingSummary, setPendingSummary] = useState({ total: 0, conflicts: 0, skipped: 0 });

  const readFile = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (text.includes('\uFFFD')) {
          const reader2 = new FileReader();
          reader2.onload = (ev2) => resolve(ev2.target?.result as string);
          reader2.readAsText(file, 'iso-8859-1');
        } else {
          resolve(text);
        }
      };
      reader.readAsText(file, 'utf-8');
    });
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFile(file);
    const result = parseAnagraficaCSV(text);

    if (result.errors.length > 0) {
      toast.error(result.errors[0]);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    if (result.rows.length === 0) {
      toast.error("Nessun TP valido trovato nel file");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    // Check for conflicts
    const existingIds = getExistingAnagraficaIds();
    const conflicts = result.rows.filter(r => existingIds.includes(r.tp_id));

    if (conflicts.length > 0) {
      setPendingRows(result.rows);
      setPendingSummary({ total: result.rows.length, conflicts: conflicts.length, skipped: result.skippedRows });
      setShowConfirm(true);
    } else {
      doImport(result.rows, false, result.skippedRows);
    }

    if (fileRef.current) fileRef.current.value = "";
  }, [readFile]);

  const doImport = (rows: any[], overwrite: boolean, skipped: number) => {
    const { updated, created } = bulkImportAnagrafica(rows, overwrite);
    const skippedCount = overwrite ? 0 : rows.length - updated - created;

    addAnagraficaImportMeta({
      date: new Date().toISOString(),
      tpCount: updated + created,
    });
    setImportHistory(getAnagraficaImportHistory());

    const parts = [];
    if (created > 0) parts.push(`${created} TP nuovi`);
    if (updated > 0) parts.push(`${updated} TP aggiornati`);
    if (skipped > 0) parts.push(`${skipped} righe ignorate`);
    if (skippedCount > 0) parts.push(`${skippedCount} TP già esistenti non sovrascritti`);

    toast.success(`Import completato: ${parts.join(", ")}`);
  };

  const handleConfirmOverwrite = () => {
    doImport(pendingRows, true, pendingSummary.skipped);
    setShowConfirm(false);
    setPendingRows([]);
  };

  const handleConfirmSkip = () => {
    doImport(pendingRows, false, pendingSummary.skipped);
    setShowConfirm(false);
    setPendingRows([]);
  };

  const handleDownloadTemplate = () => {
    const csv = generateAnagraficaTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "template_anagrafica_tp.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteImport = (index: number) => {
    removeAnagraficaImportMeta(index);
    setImportHistory(getAnagraficaImportHistory());
    toast.success("Record import eliminato");
  };

  if (!isAdmin) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground">
        Solo il Sales Manager può gestire l'anagrafica TP.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Anagrafica Touchpoint</h3>
      <p className="text-xs text-muted-foreground">
        Carica un CSV con i dati anagrafici dei TP. Il join con i dati vendite avviene tramite <code className="font-mono bg-muted px-1 rounded">tp_id</code>.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        <Button size="sm" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" /> Carica CSV anagrafica
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={handleDownloadTemplate}>
          <Download className="w-4 h-4" /> Scarica template CSV
        </Button>
      </div>

      {/* Import history */}
      {importHistory.length > 0 && (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Data upload</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">TP importati</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {importHistory.map((h, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(h.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{h.tpCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteImport(i)} title="Elimina">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importHistory.length === 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">
          <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Nessun import anagrafica registrato. Carica un CSV o scarica il template per iniziare.
        </div>
      )}

      {/* Confirm overwrite dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TP già presenti in anagrafica</DialogTitle>
            <DialogDescription>
              {pendingSummary.conflicts} TP su {pendingSummary.total} hanno già dati anagrafici salvati. Vuoi sovrascrivere i dati esistenti?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Annulla</Button>
            <Button variant="secondary" onClick={handleConfirmSkip}>Importa solo nuovi</Button>
            <Button variant="destructive" onClick={handleConfirmOverwrite}>Sovrascrivi tutti</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===================== CONFIG TAB =====================
function ConfigTab({ isAdmin, availableRappresentanti }: { isAdmin: boolean; availableRappresentanti: string[] }) {
  const [thresholds, setThresholds] = useState<ABCThresholds>(getABCThresholds);
  const [rappMap, setRappMap] = useState<Record<string, string>>(getRappresentantiMap);
  const [dirty, setDirty] = useState(false);

  const handleSave = () => {
    saveABCThresholds(thresholds);
    saveRappresentantiMap(rappMap);
    setDirty(false);
    toast.success("Configurazione salvata");
  };

  if (!isAdmin) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground">
        Solo il Sales Manager può modificare la configurazione.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Soglie classificazione ABC</h3>
        <p className="text-xs text-muted-foreground">Modifica le soglie STR per la classificazione dei Touchpoint.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Categoria A: STR &gt;</label>
            <div className="flex items-center gap-2">
              <Input type="number" value={thresholds.aMin} onChange={e => { setThresholds(t => ({ ...t, aMin: Number(e.target.value) })); setDirty(true); }} className="w-24" min={0} max={100} />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Categoria B: STR ≥</label>
            <div className="flex items-center gap-2">
              <Input type="number" value={thresholds.bMin} onChange={e => { setThresholds(t => ({ ...t, bMin: Number(e.target.value) })); setDirty(true); }} className="w-24" min={0} max={100} />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Categoria C: STR &lt; {thresholds.bMin}% o vendite a zero</p>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Nomi rappresentanti</h3>
        <p className="text-xs text-muted-foreground">Associa un nome visualizzato ai valori del campo "rappresentante" nel CSV.</p>
        {availableRappresentanti.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Carica un CSV per visualizzare i rappresentanti disponibili.</p>
        ) : (
          <div className="space-y-2">
            {availableRappresentanti.map(r => (
              <div key={r} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground font-mono min-w-[120px]">{r}</span>
                <span className="text-muted-foreground">→</span>
                <Input placeholder="Nome visualizzato" value={rappMap[r] ?? ""} onChange={e => { setRappMap(m => ({ ...m, [r]: e.target.value })); setDirty(true); }} className="flex-1" />
              </div>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={!dirty}>Salva configurazione</Button>
    </div>
  );
}

// ===================== SALES IMPORT TAB =====================
function SalesImportTab({ isAdmin, onUpload, onConfirmUpload, onDataChange }: { isAdmin: boolean; onUpload: (csv: string) => UploadResult; onConfirmUpload: (csv: string) => void; onDataChange: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [pendingCsv, setPendingCsv] = useState("");

  const readFile = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (text.includes('\uFFFD')) {
          const reader2 = new FileReader();
          reader2.onload = (ev2) => resolve(ev2.target?.result as string);
          reader2.readAsText(file, 'iso-8859-1');
        } else {
          resolve(text);
        }
      };
      reader.readAsText(file, 'utf-8');
    });
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFile(file);
    const result = onUpload(text);
    if (result.needsConfirm) {
      setPendingCsv(text);
      setConfirmDialog(true);
    } else if (result.success) {
      toast.success(result.message);
      if (result.summary) toast.info(result.summary, { duration: 8000 });
      onDataChange();
    } else {
      toast.error(result.message);
    }
    if (fileRef.current) fileRef.current.value = "";
  }, [readFile, onUpload, onDataChange]);

  const handleConfirm = () => {
    onConfirmUpload(pendingCsv);
    setConfirmDialog(false);
    onDataChange();
    toast.success("Dati sovrascritti con successo");
  };

  if (!isAdmin) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground">
        Solo il Sales Manager può importare dati vendite.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Import dati vendite mensili</h3>
      <p className="text-xs text-muted-foreground">
        Carica un CSV con i dati di vendita mensili. Colonne richieste: <code className="font-mono bg-muted px-1 rounded">tp_id, tp_nome, tp_tipo, tp_zona, rappresentante, venduto_pezzi, venduto_euro, mese</code>. 
        Colonna opzionale: <code className="font-mono bg-muted px-1 rounded">giacenza_pezzi</code>.
      </p>

      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        <Button size="sm" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" /> Carica CSV vendite
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={handleDownloadTemplate}>
          <Download className="w-4 h-4" /> Scarica template CSV
        </Button>
      </div>
      <p className="text-xs text-muted-foreground italic">Non sai come formattare il file? Scarica il template.</p>

      <div className="glass-card p-5 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-foreground text-sm">Formato richiesto</p>
        <p>Il file deve contenere una riga per ogni TP con i dati di un singolo mese (formato <code className="font-mono bg-muted px-1 rounded">YYYY-MM</code>).</p>
        <p>Separatore: virgola o punto e virgola (rilevato automaticamente). Encoding: UTF-8 o Latin-1.</p>
        <p>Se il mese è già presente, verrà chiesta conferma prima di sovrascrivere.</p>
      </div>

      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sovrascrivere dati esistenti?</DialogTitle>
            <DialogDescription>
              I dati per questo mese verranno sostituiti con il nuovo file caricato. Questa azione non è reversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleConfirm}>Sovrascrivi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===================== MAIN SETTINGS PAGE =====================
export default function SettingsPage({ isAdmin, currentUserId, onDataChange, availableRappresentanti, onUpload, onConfirmUpload }: Props) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Impostazioni</h1>
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users" className="gap-2 text-xs sm:text-sm">
            <Users className="w-4 h-4 hidden sm:inline" /> Utenti
          </TabsTrigger>
          <TabsTrigger value="sales-import" className="gap-2 text-xs sm:text-sm">
            <Database className="w-4 h-4 hidden sm:inline" /> Vendite
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-xs sm:text-sm">
            <History className="w-4 h-4 hidden sm:inline" /> Storico
          </TabsTrigger>
          <TabsTrigger value="anagrafica" className="gap-2 text-xs sm:text-sm">
            <FileSpreadsheet className="w-4 h-4 hidden sm:inline" /> Anagrafica
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2 text-xs sm:text-sm">
            <Settings className="w-4 h-4 hidden sm:inline" /> Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersTab isAdmin={isAdmin} currentUserId={currentUserId} availableRappresentanti={availableRappresentanti} />
        </TabsContent>
        <TabsContent value="sales-import">
          <SalesImportTab isAdmin={isAdmin} onUpload={onUpload} onConfirmUpload={onConfirmUpload} onDataChange={onDataChange} />
        </TabsContent>
        <TabsContent value="history">
          <ImportHistoryTab isAdmin={isAdmin} onDataChange={onDataChange} />
        </TabsContent>
        <TabsContent value="anagrafica">
          <AnagraficaTPTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="config">
          <ConfigTab isAdmin={isAdmin} availableRappresentanti={availableRappresentanti} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
