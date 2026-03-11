import { TPRecord, CSVParseResult, SkippedRow } from "@/types/dashboard";

const REQUIRED_COLUMNS = [
  "tp_id", "tp_nome", "tp_tipo", "tp_zona",
  "rappresentante", "venduto_pezzi", "venduto_euro", "mese"
];

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseNumber(val: string | undefined | null): number {
  if (val === undefined || val === null) return 0;
  const s = String(val).trim();
  if (s === "") return 0;
  // Remove €, spaces, quotes, non-breaking spaces
  let cleaned = s.replace(/[€\s\u00A0"']/g, "").trim();
  if (!cleaned) return 0;

  // Detect Italian format: dots as thousands, comma as decimal (e.g. "1.234,56")
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    if (lastComma > lastDot) {
      // Italian: 1.234,56 → 1234.56
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56 → 1234.56
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    // Only comma → decimal separator: 1234,56 → 1234.56
    cleaned = cleaned.replace(",", ".");
  }
  // At this point only dots remain
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function detectSeparator(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  // If more semicolons than commas, use semicolon
  return semicolons > commas ? ";" : ",";
}

function splitCSVLine(line: string, sep: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values.map(v => v.trim().replace(/^"|"$/g, ""));
}

export function parseCSV(csvText: string): CSVParseResult {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { records: [], skippedRows: 0, skippedDetails: [], errors: ["File CSV vuoto o senza dati"], mese: null, hasGiacenza: false, totalFatturato: 0 };
  }

  const sep = detectSeparator(lines[0]);
  const headers = splitCSVLine(lines[0], sep).map(h => h.toLowerCase().replace(/\s+/g, "_"));

  // Check required columns
  const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
  if (missing.length > 0) {
    return {
      records: [], skippedRows: 0, skippedDetails: [],
      errors: [`Colonne obbligatorie mancanti: ${missing.join(", ")}`],
      mese: null, hasGiacenza: false, totalFatturato: 0
    };
  }

  const hasGiacenza = headers.includes("giacenza_pezzi");
  const records: TPRecord[] = [];
  let skippedRows = 0;
  const skippedDetails: SkippedRow[] = [];
  let totalFatturato = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = splitCSVLine(line, sep);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });

    const mese = row["mese"]?.trim();
    if (!mese || !MONTH_REGEX.test(mese)) {
      skippedRows++;
      skippedDetails.push({ line: i + 1, reason: `mese non valido: "${mese || "(vuoto)"}"` });
      continue;
    }

    const venduto_euro = parseNumber(row["venduto_euro"]);
    totalFatturato += venduto_euro;

    records.push({
      tp_id: row["tp_id"] || "",
      tp_nome: row["tp_nome"] || "",
      tp_tipo: row["tp_tipo"] || "",
      tp_zona: row["tp_zona"] || "",
      rappresentante: row["rappresentante"] || "",
      venduto_pezzi: parseNumber(row["venduto_pezzi"]),
      venduto_euro,
      giacenza_pezzi: hasGiacenza ? parseNumber(row["giacenza_pezzi"]) : null,
      mese,
    });
  }

  if (records.length === 0 && skippedRows > 0) {
    return {
      records: [], skippedRows, skippedDetails,
      errors: ["Tutte le righe hanno il campo mese non valido o mancante"],
      mese: null, hasGiacenza: false, totalFatturato: 0
    };
  }

  const mese = records.length > 0 ? records[0].mese : null;
  return { records, skippedRows, skippedDetails, errors: [], mese, hasGiacenza, totalFatturato };
}
