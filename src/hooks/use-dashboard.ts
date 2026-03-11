import { useState, useCallback } from "react";
import { DashboardStore, MonthData, TPWithMetrics } from "@/types/dashboard";
import { loadStore, addMonth, getMonthData, getPreviousMonth, getAllMonthsData, getAvailableMonths, monthExists, clearStore } from "@/lib/store";
import { enrichRecords } from "@/lib/calculations";
import { parseCSV } from "@/lib/csv-parser";

function formatEuro(n: number): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function useDashboard() {
  const [store, setStore] = useState<DashboardStore>(loadStore);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const months = getAvailableMonths();
    return months.length > 0 ? months[months.length - 1] : "";
  });

  const refresh = useCallback(() => {
    setStore(loadStore());
  }, []);

  const uploadCSV = useCallback((csvText: string): { success: boolean; message: string; needsConfirm?: boolean; mese?: string; summary?: string } => {
    const result = parseCSV(csvText);
    if (result.errors.length > 0) {
      return { success: false, message: result.errors.join("; ") };
    }
    if (result.records.length === 0) {
      return { success: false, message: "Nessun record valido trovato nel file" };
    }
    if (result.mese && monthExists(result.mese)) {
      return { success: false, message: `Dati per ${result.mese} già presenti. Sovrascrivere?`, needsConfirm: true, mese: result.mese };
    }
    const newStore = addMonth(result.records, result.hasGiacenza);
    setStore(newStore);
    setSelectedMonth(result.mese!);

    const skippedInfo = result.skippedRows > 0
      ? ` ${result.skippedRows} righe ignorate.`
      : "";
    const message = `Caricamento completato.${skippedInfo}`;
    const summary = `${result.records.length} TP caricati · Fatturato totale importato: €${formatEuro(result.totalFatturato)}`;

    if (result.skippedDetails.length > 0) {
      console.warn("Righe scartate:", result.skippedDetails);
    }

    return { success: true, message, summary };
  }, []);

  const confirmUpload = useCallback((csvText: string) => {
    const result = parseCSV(csvText);
    if (result.records.length > 0) {
      const newStore = addMonth(result.records, result.hasGiacenza);
      setStore(newStore);
      setSelectedMonth(result.mese!);
    }
  }, []);

  const currentMonthData: MonthData | undefined = selectedMonth ? getMonthData(selectedMonth) : undefined;
  const previousMonthData: MonthData | undefined = selectedMonth ? getPreviousMonth(selectedMonth) : undefined;

  const enrichedRecords: TPWithMetrics[] = currentMonthData
    ? enrichRecords(currentMonthData, previousMonthData)
    : [];

  const hasGiacenza = currentMonthData?.hasGiacenza ?? false;
  const availableMonths = store.months.map(m => m.mese);

  const resetData = useCallback(() => {
    clearStore();
    setStore({ months: [] });
    setSelectedMonth("");
  }, []);

  return {
    store,
    selectedMonth,
    setSelectedMonth,
    uploadCSV,
    confirmUpload,
    currentMonthData,
    previousMonthData,
    enrichedRecords,
    hasGiacenza,
    availableMonths,
    allMonths: getAllMonthsData(),
    refresh,
    resetData,
  };
}
