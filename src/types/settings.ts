export interface ABCThresholds {
  aMin: number; // STR > aMin = A (default 60)
  bMin: number; // STR >= bMin = B (default 40)
}

export interface ImportMeta {
  mese: string;
  uploadDate: string; // ISO string
  tpCount: number;
  totalFatturato: number;
}

export interface DashboardSettings {
  abcThresholds: ABCThresholds;
  rappresentantiMap: Record<string, string>; // csv value -> display name
  importHistory: ImportMeta[];
}

export const DEFAULT_THRESHOLDS: ABCThresholds = { aMin: 60, bMin: 40 };
