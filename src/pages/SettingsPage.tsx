import { useState, useMemo } from "react";
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
import { Users, History, Settings, Plus, UserCheck, UserX, Trash2, Download, Eye, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  isAdmin: boolean;
  currentUserId: string | null;
  onDataChange: () => void;
  availableRappresentanti: string[];
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleToggle(u.id)}
                title={u.enabled ? "Disabilita" : "Abilita"}
              >
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
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_${mese}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Storico import ({history.length} mesi)</h3>

      {/* Timeline */}
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
      {/* ABC Thresholds */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Soglie classificazione ABC</h3>
        <p className="text-xs text-muted-foreground">Modifica le soglie STR per la classificazione dei Touchpoint.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Categoria A: STR &gt;</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={thresholds.aMin}
                onChange={e => { setThresholds(t => ({ ...t, aMin: Number(e.target.value) })); setDirty(true); }}
                className="w-24"
                min={0} max={100}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Categoria B: STR ≥</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={thresholds.bMin}
                onChange={e => { setThresholds(t => ({ ...t, bMin: Number(e.target.value) })); setDirty(true); }}
                className="w-24"
                min={0} max={100}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Categoria C: STR &lt; {thresholds.bMin}% o vendite a zero</p>
      </div>

      {/* Rappresentanti mapping */}
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
                <Input
                  placeholder="Nome visualizzato"
                  value={rappMap[r] ?? ""}
                  onChange={e => {
                    setRappMap(m => ({ ...m, [r]: e.target.value }));
                    setDirty(true);
                  }}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={!dirty}>Salva configurazione</Button>
    </div>
  );
}

// ===================== MAIN SETTINGS PAGE =====================
export default function SettingsPage({ isAdmin, currentUserId, onDataChange, availableRappresentanti }: Props) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Impostazioni</h1>
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="gap-2 text-xs sm:text-sm">
            <Users className="w-4 h-4 hidden sm:inline" /> Utenti
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-xs sm:text-sm">
            <History className="w-4 h-4 hidden sm:inline" /> Storico import
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2 text-xs sm:text-sm">
            <Settings className="w-4 h-4 hidden sm:inline" /> Configurazione
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersTab isAdmin={isAdmin} currentUserId={currentUserId} availableRappresentanti={availableRappresentanti} />
        </TabsContent>
        <TabsContent value="history">
          <ImportHistoryTab isAdmin={isAdmin} onDataChange={onDataChange} />
        </TabsContent>
        <TabsContent value="config">
          <ConfigTab isAdmin={isAdmin} availableRappresentanti={availableRappresentanti} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
