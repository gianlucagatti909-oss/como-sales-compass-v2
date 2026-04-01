import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, User } from "lucide-react";
import { TPWithMetrics, MonthData } from "@/types/dashboard";
import { generateReport } from "@/lib/pdf-report";
import { TPAnagrafica } from "@/lib/store";
import { aggregateMultiMonthRecords, formatMonth } from "@/lib/calculations";
import { toast } from "sonner";
import { useMemo, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: TPWithMetrics[];
  selectedMonth: string;
  hasGiacenza: boolean;
  allMonths: MonthData[];
  tpAnagrafica: TPAnagrafica[];
}

type Mode = "single" | "multi";

export default function ExportReportModal({
  open, onOpenChange, records, selectedMonth, hasGiacenza, allMonths, tpAnagrafica,
}: Props) {
  const [mode, setMode] = useState<Mode>("single");
  const [multiSelectedMonths, setMultiSelectedMonths] = useState<string[]>([]);

  const rappresentanti = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.rappresentante?.trim()) set.add(r.rappresentante.trim()); });
    return [...set].sort();
  }, [records]);

  const availableMonths = useMemo(() => allMonths.map(m => m.mese).sort(), [allMonths]);

  const toggleMonth = (mese: string) => {
    setMultiSelectedMonths(prev =>
      prev.includes(mese) ? prev.filter(m => m !== mese) : [...prev, mese]
    );
  };

  const handleExport = (filterRep?: string) => {
    try {
      if (mode === "multi") {
        if (multiSelectedMonths.length === 0) {
          toast.error("Seleziona almeno un mese");
          return;
        }
        const { records: aggRecords, hasGiacenza: aggHasGiacenza } = aggregateMultiMonthRecords(allMonths, multiSelectedMonths);
        generateReport(aggRecords, multiSelectedMonths, aggHasGiacenza, allMonths, tpAnagrafica, filterRep);
      } else {
        generateReport(records, selectedMonth, hasGiacenza, allMonths, tpAnagrafica, filterRep);
      }
      toast.success(`Report ${filterRep || "generale"} scaricato`);
      onOpenChange(false);
    } catch (e) {
      toast.error("Errore nella generazione del report");
      console.error(e);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setMode("single");
      setMultiSelectedMonths([]);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Esporta Report PDF</DialogTitle>
          <DialogDescription>
            {mode === "single"
              ? `Mese selezionato: ${selectedMonth ? formatMonth(selectedMonth) : "—"}`
              : `${multiSelectedMonths.length} mese/i selezionati`}
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2 rounded-lg border border-border p-1">
          <button
            className={`flex-1 text-sm py-1.5 rounded-md transition-colors font-medium ${mode === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setMode("single")}
          >
            Singolo mese
          </button>
          <button
            className={`flex-1 text-sm py-1.5 rounded-md transition-colors font-medium ${mode === "multi" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setMode("multi")}
          >
            Più mesi
          </button>
        </div>

        {/* Multi-month selector */}
        {mode === "multi" && (
          <div className="border border-border rounded-lg p-3 max-h-40 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {availableMonths.map(mese => (
                <label key={mese} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={multiSelectedMonths.includes(mese)}
                    onCheckedChange={() => toggleMonth(mese)}
                  />
                  {formatMonth(mese)}
                </label>
              ))}
              {availableMonths.length === 0 && (
                <span className="text-xs text-muted-foreground">Nessun mese disponibile</span>
              )}
            </div>
          </div>
        )}

        {/* Export buttons */}
        <div className="flex flex-col gap-3 pt-1">
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
