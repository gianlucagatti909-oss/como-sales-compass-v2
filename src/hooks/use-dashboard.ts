import { useState, useCallback, useMemo, useEffect } from "react";
import { DashboardStore, MonthData, TPWithMetrics } from "@/types/dashboard";
import { loadStore, addMonth, getMonthData, getPreviousMonth, getAllMonthsData, monthExists, clearStore, deleteMonth } from "@/lib/store";
import { enrichRecords } from "@/lib/calculations";
import { parseCSV } from "@/lib/csv-parser";
import { addImportMeta, removeImportMeta, clearSettings } from "@/lib/settings-store";

function formatEuro(n: number): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function useDashboard() {
  const [store, setStore] = useState<DashboardStore>({ months: [] });
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Initialize from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    loadStore().then(s => {
      if (cancelled) return;
      setStore(s);
      const months = s.months.map(m => m.mese);
      if (months.length > 0) setSelectedMonth(months[months.length - 1]);
      setLoading(false);
    }).catch(err => {
      console.error("[useDashboard] init error:", err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    const s = await loadStore();
    setStore(s);
    const months = s.months.map(m => m.mese);
    setSelectedMonth(prev => {
      if (months.length > 0 && !months.includes(prev)) return months[months.length - 1];
      if (months.length === 0) return "";
      return prev;
    });
  }, []);

  const uploadCSV = useCallback(async (csvText: string): Promise<{ success: boolean; message: string; needsConfirm?: boolean; mese?: string; summary?: string }> => {
    const result = parseCSV(csvText);
    if (result.errors.length > 0) {
      return { success: false, message: result.errors.join("; ") };
    }
    if (result.records.length === 0) {
      return { success: false, message: "Nessun record valido trovato nel file" };
    }
    if (result.mese && await monthExists(result.mese)) {
      return { success: false, message: `Dati per ${result.mese} già presenti. Sovrascrivere?`, needsConfirm: true, mese: result.mese };
    }

    const newStore = await addMonth(result.records, result.hasGiacenza);
    setStore(newStore);
    setSelectedMonth(result.mese!);

    await addImportMeta({
      mese: result.mese!,
      uploadDate: new Date().toISOString(),
      tpCount: result.records.length,
      totalFatturato: result.totalFatturato,
    });

    const skippedInfo = result.skippedRows > 0 ? ` ${result.skippedRows} righe ignorate.` : "";
    const message = `Caricamento completato.${skippedInfo}`;
    const summary = `${result.records.length} TP caricati · Fatturato totale importato: €${formatEuro(result.totalFatturato)}`;

    if (result.skippedDetails.length > 0) {
      console.warn("Righe scartate:", result.skippedDetails);
    }

    return { success: true, message, summary };
  }, []);

  const confirmUpload = useCallback(async (csvText: string) => {
    const result = parseCSV(csvText);
    if (result.records.length > 0) {
      const newStore = await addMonth(result.records, result.hasGiacenza);
      setStore(newStore);
      setSelectedMonth(result.mese!);

      await addImportMeta({
        mese: result.mese!,
        uploadDate: new Date().toISOString(),
        tpCount: result.records.length,
        totalFatturato: result.totalFatturato,
      });
    }
  }, []);

  const removeMonth = useCallback(async (mese: string) => {
    const newStore = await deleteMonth(mese);
    await removeImportMeta(mese);
    setStore(newStore);
    const months = newStore.months.map(m => m.mese);
    setSelectedMonth(prev => {
      if (months.length > 0 && !months.includes(prev)) return months[months.length - 1];
      if (months.length === 0) return "";
      return prev;
    });
  }, []);

  const currentMonthData: MonthData | undefined = useMemo(
    () => selectedMonth ? store.months.find(m => m.mese === selectedMonth) : undefined,
    [selectedMonth, store]
  );

  const previousMonthData: MonthData | undefined = useMemo(() => {
    if (!selectedMonth) return undefined;
    const idx = store.months.findIndex(m => m.mese === selectedMonth);
    if (idx <= 0) return undefined;
    return store.months[idx - 1];
  }, [selectedMonth, store]);

  const enrichedRecords: TPWithMetrics[] = useMemo(
    () => currentMonthData ? enrichRecords(currentMonthData, previousMonthData) : [],
    [currentMonthData, previousMonthData]
  );

  const hasGiacenza = currentMonthData?.hasGiacenza ?? false;
  const availableMonths = store.months.map(m => m.mese);

  const resetData = useCallback(async () => {
    await Promise.all([clearStore(), clearSettings()]);
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
    allMonths: store.months,
    loading,
    refresh,
    resetData,
    removeMonth,
  };
}
