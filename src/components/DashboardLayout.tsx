import { ReactNode, useState, useRef, useCallback, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Store, Users, AlertTriangle, Trophy, Upload, Menu, X, Trash2, Settings, LogOut, FileDown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatMonth } from "@/lib/calculations";
import { toast } from "sonner";
import { UserRole } from "@/types/auth";
import { TPWithMetrics, MonthData } from "@/types/dashboard";
import ExportReportModal from "@/components/ExportReportModal";

interface UploadResult {
  success: boolean;
  message: string;
  needsConfirm?: boolean;
  mese?: string;
  summary?: string;
}

interface LayoutProps {
  children: ReactNode;
  selectedMonth: string;
  availableMonths: string[];
  onMonthChange: (m: string) => void;
  onUpload: (csv: string) => Promise<UploadResult>;
  onConfirmUpload: (csv: string) => Promise<void>;
  hasGiacenza: boolean;
  onReset: () => void;
  onLogout: () => void;
  userName: string;
  userRole: UserRole;
  isAdmin: boolean;
  records: TPWithMetrics[];
  hasGiacenzaProp: boolean;
  allMonths: MonthData[];
}

const getNavItems = (isAdmin: boolean) => {
  const items = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/touchpoints", label: "Touchpoint", icon: Store },
  ];
  if (isAdmin) {
    items.push({ path: "/rappresentanti", label: "Rappresentanti", icon: Users });
  }
  items.push(
    { path: "/priorita", label: "Priorità", icon: AlertTriangle },
    { path: "/top-performer", label: "Top Performer", icon: Trophy },
    { path: "/impostazioni", label: "Impostazioni", icon: Settings },
  );
  return items;
};

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout lettura file")), 10000);
    const reader = new FileReader();
    reader.onload = (ev) => {
      clearTimeout(timeout);
      const text = ev.target?.result as string;
      if (text.includes('\uFFFD')) {
        const reader2 = new FileReader();
        const timeout2 = setTimeout(() => reject(new Error("Timeout lettura file (fallback)")), 10000);
        reader2.onload = (ev2) => {
          clearTimeout(timeout2);
          resolve(ev2.target?.result as string);
        };
        reader2.onerror = () => { clearTimeout(timeout2); reject(new Error("Errore lettura file")); };
        reader2.readAsText(file, 'iso-8859-1');
      } else {
        resolve(text);
      }
    };
    reader.onerror = () => { clearTimeout(timeout); reject(new Error("Errore lettura file")); };
    reader.readAsText(file, 'utf-8');
  });
}

export default function Layout({
  children, selectedMonth, availableMonths, onMonthChange,
  onUpload, onConfirmUpload, hasGiacenza, onReset, onLogout,
  userName, userRole, isAdmin, records, hasGiacenzaProp, allMonths
}: LayoutProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [pendingCsv, setPendingCsv] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const navItems = getNavItems(isAdmin);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await readFileAsText(file);
      const result = await onUpload(text);
      if (result.needsConfirm) {
        setPendingCsv(text);
        setConfirmDialog(true);
      } else if (result.success) {
        toast.success(result.message);
        if (result.summary) {
          toast.info(result.summary, { duration: 8000 });
        }
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore durante la lettura del file");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [onUpload, uploading]);

  // PERF: wrap in useCallback to prevent Dialog from re-rendering when unrelated state changes
  const handleConfirm = useCallback(() => {
    onConfirmUpload(pendingCsv);
    setConfirmDialog(false);
    toast.success("Dati sovrascritti con successo");
  }, [onConfirmUpload, pendingCsv]);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Single hidden file input — shared by sidebar and mobile header */}
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-border bg-card/50 p-4 gap-1 fixed h-full z-30">
        <div className="flex flex-row items-center gap-2 px-3 py-4 mb-4 whitespace-nowrap overflow-hidden">
          <img src="/stemma-como.png" alt="Como 1907" className="h-20 w-auto object-contain shrink-0" />
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          {/* User info */}
          <div className="px-3 py-2 text-xs">
            <div className="font-medium truncate">{userName}</div>
            <div className="text-muted-foreground">{userRole === "admin" ? "Sales Manager" : "Rappresentante"}</div>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> Carica CSV
            </Button>
          )}
          {isAdmin && availableMonths.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" /> Reset dati
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare tutti i dati?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Verranno rimossi tutti i mesi caricati ({availableMonths.length} {availableMonths.length === 1 ? "mese" : "mesi"}). Questa azione è irreversibile.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onReset}
                  >
                    Elimina tutto
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onLogout}>
            <LogOut className="w-4 h-4" /> Esci
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/stemma-como.png" alt="Como 1907" className="h-14 w-auto object-contain shrink-0" />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="ghost" size="icon" aria-label="Carica CSV" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label={mobileOpen ? "Chiudi menu" : "Apri menu"} onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 pt-16" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-background/95 backdrop-blur -z-10" />
          <nav className="flex flex-col gap-1 p-4" onClick={e => e.stopPropagation()}>
            {navItems.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors
                    ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => { onLogout(); setMobileOpen(false); }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <LogOut className="w-5 h-5" />
              Esci ({userName})
            </button>
          </nav>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 lg:ml-60 pt-16 lg:pt-0">
        {/* Top bar */}
        <div className="sticky top-0 lg:top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {availableMonths.length > 0 && (
              <Select value={selectedMonth} onValueChange={onMonthChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Seleziona mese" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(m => (
                    <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasGiacenza ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-category-a/10 category-a">
                <CheckCircle2 className="w-3.5 h-3.5" /> STR & ABC attivi
              </span>
            ) : availableMonths.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-category-b/10 category-b">
                <AlertTriangle className="w-3.5 h-3.5" /> STR & ABC non disponibili
              </span>
            ) : null}
          </div>
          {availableMonths.length > 0 && selectedMonth && (
            <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => setExportOpen(true)}>
              <FileDown className="w-4 h-4" /> Esporta PDF
            </Button>
          )}
        </div>

        <div className="p-4 lg:p-6 animate-fade-in">
          {children}
        </div>
      </main>

      {/* Confirm overwrite dialog */}
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

      <ExportReportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        records={records}
        selectedMonth={selectedMonth}
        hasGiacenza={hasGiacenzaProp}
        allMonths={allMonths}
      />
    </div>
  );
}
