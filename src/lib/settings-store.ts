import { DashboardSettings, ImportMeta, ABCThresholds, DEFAULT_THRESHOLDS } from "@/types/settings";

const SETTINGS_KEY = "como1907_settings";

export function loadSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        abcThresholds: s.abcThresholds ?? DEFAULT_THRESHOLDS,
        rappresentantiMap: s.rappresentantiMap ?? {},
        importHistory: s.importHistory ?? [],
      };
    }
  } catch {}
  return { abcThresholds: DEFAULT_THRESHOLDS, rappresentantiMap: {}, importHistory: [] };
}

function saveSettings(s: DashboardSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function saveABCThresholds(t: ABCThresholds): void {
  const s = loadSettings();
  s.abcThresholds = t;
  saveSettings(s);
}

export function getABCThresholds(): ABCThresholds {
  return loadSettings().abcThresholds;
}

export function addImportMeta(meta: ImportMeta): void {
  const s = loadSettings();
  const idx = s.importHistory.findIndex(m => m.mese === meta.mese);
  if (idx >= 0) {
    s.importHistory[idx] = meta;
  } else {
    s.importHistory.push(meta);
    s.importHistory.sort((a, b) => a.mese.localeCompare(b.mese));
  }
  saveSettings(s);
}

export function removeImportMeta(mese: string): void {
  const s = loadSettings();
  s.importHistory = s.importHistory.filter(m => m.mese !== mese);
  saveSettings(s);
}

export function getImportHistory(): ImportMeta[] {
  return loadSettings().importHistory;
}

export function getRappresentantiMap(): Record<string, string> {
  return loadSettings().rappresentantiMap;
}

export function saveRappresentantiMap(map: Record<string, string>): void {
  const s = loadSettings();
  s.rappresentantiMap = map;
  saveSettings(s);
}

export function clearSettings(): void {
  localStorage.removeItem(SETTINGS_KEY);
}
