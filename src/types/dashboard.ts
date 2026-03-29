export interface TPRecord {
  tp_id: string;
  tp_nome: string;
  tp_tipo: string;
  tp_zona: string;
  rappresentante: string;
  venduto_pezzi: number;
  venduto_euro: number;
  giacenza_pezzi: number | null;
  mese: string; // YYYY-MM
}

export type ABCCategory = "A" | "B" | "C";
export type TrendDirection = "up" | "stable" | "down" | "nd";

export interface TPWithMetrics extends TPRecord {
  str: number | null; // null = N/D
  categoria: ABCCategory | null;
  trend: TrendDirection;
  trend_fatturato: number | null; // % change
}

export interface MonthData {
  mese: string;
  records: TPRecord[];
  hasGiacenza: boolean;
}

export interface DashboardStore {
  months: MonthData[];
}

export interface SkippedRow {
  line: number;
  reason: string;
}

export interface CSVParseResult {
  records: TPRecord[];
  skippedRows: number;
  skippedDetails: SkippedRow[];
  errors: string[];
  mese: string | null;
  hasGiacenza: boolean;
  totalFatturato: number;
}
