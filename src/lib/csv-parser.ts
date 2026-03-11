import { TPRecord, CSVParseResult } from "@/types/dashboard";

const REQUIRED_COLUMNS = [
  "tp_id", "tp_nome", "tp_tipo", "tp_zona",
  "rappresentante", "venduto_pezzi", "venduto_euro", "mese"
];

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseNumber(val: string | undefined | null): number {
  if (!val || val.trim() === "") return 0;
  // Remove €, spaces, and quotes
  let cleaned = val.replace(/[€\s"']/g, "").trim();
  if (!cleaned) return 0;
  // Detect Italian format: dots as thousands, comma as decimal (e.g. "1.234,56")
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // If comma comes after the last dot → Italian format: remove dots, replace comma
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // dots after comma → unlikely, but treat comma as thousands
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    // Only comma → decimal separator
    cleaned = cleaned.replace(",", ".");
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function parseCSV(csvText: string): CSVParseResult {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { records: [], skippedRows: 0, errors: ["File CSV vuoto o senza dati"], mese: null, hasGiacenza: false };
  }

  // Detect separator
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ""));

  // Check required columns
  const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
  if (missing.length > 0) {
    return {
      records: [], skippedRows: 0,
      errors: [`Colonne obbligatorie mancanti: ${missing.join(", ")}`],
      mese: null, hasGiacenza: false
    };
  }

  const hasGiacenza = headers.includes("giacenza_pezzi");
  const records: TPRecord[] = [];
  let skippedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

    const mese = row["mese"]?.trim();
    if (!mese || !MONTH_REGEX.test(mese)) {
      skippedRows++;
      continue;
    }

    records.push({
      tp_id: row["tp_id"] || "",
      tp_nome: row["tp_nome"] || "",
      tp_tipo: row["tp_tipo"] || "",
      tp_zona: row["tp_zona"] || "",
      rappresentante: row["rappresentante"] || "",
      venduto_pezzi: parseNumber(row["venduto_pezzi"]),
      venduto_euro: parseNumber(row["venduto_euro"]),
      giacenza_pezzi: hasGiacenza ? parseNumber(row["giacenza_pezzi"]) : null,
      mese,
    });
  }

  if (records.length === 0 && skippedRows > 0) {
    return {
      records: [], skippedRows,
      errors: ["Tutte le righe hanno il campo mese non valido o mancante"],
      mese: null, hasGiacenza: false
    };
  }

  const mese = records.length > 0 ? records[0].mese : null;
  return { records, skippedRows, errors: [], mese, hasGiacenza };
}
