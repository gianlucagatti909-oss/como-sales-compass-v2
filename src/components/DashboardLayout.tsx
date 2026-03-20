import { ReactNode, useState, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Store, Users, AlertTriangle, Trophy, Upload, Menu, X, Trash2, Settings, LogOut, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatMonth } from "@/lib/calculations";
import { toast } from "sonner";
import { UserRole } from "@/types/auth";
import { TPWithMetrics } from "@/types/dashboard";
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
  onUpload: (csv: string) => UploadResult;
  onConfirmUpload: (csv: string) => void;
  hasGiacenza: boolean;
  onReset: () => void;
  onLogout: () => void;
  userName: string;
  userRole: UserRole;
  isAdmin: boolean;
  records: TPWithMetrics[];
  hasGiacenzaProp: boolean;
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
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text.includes('\uFFFD')) {
        const reader2 = new FileReader();
        reader2.onload = (ev2) => {
          resolve(ev2.target?.result as string);
        };
        reader2.readAsText(file, 'iso-8859-1');
      } else {
        resolve(text);
      }
    };
    reader.readAsText(file, 'utf-8');
  });
}

export default function Layout({
  children, selectedMonth, availableMonths, onMonthChange,
  onUpload, onConfirmUpload, hasGiacenza, onReset, onLogout,
  userName, userRole, isAdmin, records, hasGiacenzaProp
}: LayoutProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [pendingCsv, setPendingCsv] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const navItems = getNavItems(isAdmin);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    const result = onUpload(text);
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
    if (fileRef.current) fileRef.current.value = "";
  }, [onUpload]);

  const handleConfirm = () => {
    onConfirmUpload(pendingCsv);
    setConfirmDialog(false);
    toast.success("Dati sovrascritti con successo");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-border bg-card/50 p-4 gap-1 fixed h-full z-30">
        <div className="flex items-center gap-2 px-3 py-4 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">C</span>
          </div>
          <span className="font-bold text-sm tracking-tight">Como 1907 TP</span>
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
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          {isAdmin && (
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> Carica CSV
            </Button>
          )}
          {isAdmin && availableMonths.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive hover:text-destructive" onClick={onReset}>
              <Trash2 className="w-4 h-4" /> Reset dati
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onLogout}>
            <LogOut className="w-4 h-4" /> Esci
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">C</span>
          </div>
          <span className="font-bold text-sm">Como 1907</span>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-background/95 backdrop-blur pt-16">
          <nav className="flex flex-col gap-1 p-4">
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
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-category-a/10 category-a">
                STR & ABC: Attiva ✅
              </span>
            ) : availableMonths.length > 0 ? (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-category-b/10 category-b">
                STR & ABC: Non disponibile ⚠️
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
    </div>
  );
}
