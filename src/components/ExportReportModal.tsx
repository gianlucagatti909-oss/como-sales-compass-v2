import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, User } from "lucide-react";
import { TPWithMetrics } from "@/types/dashboard";
import { generateReport } from "@/lib/pdf-report";
import { toast } from "sonner";
import { useMemo } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: TPWithMetrics[];
  selectedMonth: string;
  hasGiacenza: boolean;
}

export default function ExportReportModal({ open, onOpenChange, records, selectedMonth, hasGiacenza }: Props) {
  const rappresentanti = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.rappresentante?.trim()) set.add(r.rappresentante.trim()); });
    return [...set].sort();
  }, [records]);

  const handleExport = (filterRep?: string) => {
    try {
      generateReport(records, selectedMonth, hasGiacenza, filterRep);
      toast.success(`Report ${filterRep || "generale"} scaricato`);
      onOpenChange(false);
    } catch (e) {
      toast.error("Errore nella generazione del report");
      console.error(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Esporta Report PDF</DialogTitle>
          <DialogDescription>
            Seleziona il tipo di report da scaricare per {selectedMonth ? selectedMonth : "il mese selezionato"}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={() => handleExport()}
          >
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div className="text-left">
              <div className="font-medium">📄 Report Generale</div>
              <div className="text-xs text-muted-foreground">Tutti i TP e tutti i rappresentanti</div>
            </div>
          </Button>
          {rappresentanti.map(rep => (
            <Button
              key={rep}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => handleExport(rep)}
            >
              <User className="w-5 h-5 text-primary shrink-0" />
              <div className="text-left">
                <div className="font-medium">👤 Report {rep}</div>
                <div className="text-xs text-muted-foreground">Solo i TP di {rep}</div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
