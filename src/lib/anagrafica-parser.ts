import { TPAnagrafica } from "@/lib/tp-store";

export interface AnagraficaCSVRow {
  tp_id: string;
  tp_nome?: string;
  tp_tipo?: string;
  tp_zona?: string;
  rappresentante?: string;
  indirizzo?: string;
  referente_telefono?: string;
  referente_email?: string;
  note?: string;
}

export interface AnagraficaParseResult {
  rows: AnagraficaCSVRow[];
  skippedRows: number;
  skippedDetails: { line: number; reason: string }[];
  errors: string[];
}

const REQUIRED_COLS = ["tp_id"];
const ALL_COLS = [
  "tp_id", "tp_nome", "tp_tipo", "tp_zona", "rappresentante",
  "indirizzo", "referente_telefono", "referente_email", "note"
];

function detectSeparator(headerLine: string): string {
  return (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length ? ";" : ",";
}

function splitCSVLine(line: string, sep: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'; i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      values.push(current); current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values.map(v => v.trim().replace(/^"|"$/g, ""));
}

export function parseAnagraficaCSV(csvText: string): AnagraficaParseResult {
  // Filter out comment lines starting with #
  const allLines = csvText.trim().split(/\r?\n/);
  const lines = allLines.filter(l => !l.trimStart().startsWith("#"));

  if (lines.length < 2) {
    return { rows: [], skippedRows: 0, skippedDetails: [], errors: ["File CSV vuoto o senza dati"] };
  }

  const sep = detectSeparator(lines[0]);
  const headers = splitCSVLine(lines[0], sep).map(h => h.toLowerCase().replace(/\s+/g, "_"));

  const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
  if (missing.length > 0) {
    return { rows: [], skippedRows: 0, skippedDetails: [], errors: [`Colonna obbligatoria mancante: ${missing.join(", ")}`] };
  }

  const rows: AnagraficaCSVRow[] = [];
  let skippedRows = 0;
  const skippedDetails: { line: number; reason: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = splitCSVLine(line, sep);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });

    const tp_id = row["tp_id"]?.trim();
    if (!tp_id) {
      skippedRows++;
      skippedDetails.push({ line: i + 1, reason: "tp_id mancante" });
      continue;
    }

    rows.push({
      tp_id,
      tp_nome: row["tp_nome"] || undefined,
      tp_tipo: row["tp_tipo"] || undefined,
      tp_zona: row["tp_zona"] || undefined,
      rappresentante: row["rappresentante"] || undefined,
      indirizzo: row["indirizzo"] || undefined,
      referente_telefono: row["referente_telefono"] || undefined,
      referente_email: row["referente_email"] || undefined,
      note: row["note"] || undefined,
    });
  }

  return { rows, skippedRows, skippedDetails, errors: [] };
}

export function generateAnagraficaTemplate(): string {
  const comment = "# Non modificare le intestazioni. tp_id deve corrispondere esattamente ai codici nel CSV vendite.";
  const header = ALL_COLS.join(";");
  const row1 = 'C-000001;"Bar Roma";bar;"Como Centro";"Mario Rossi";"Via Roma 1 - 22100 Como";"+39 031 123456";"info@barroma.it";"Cliente storico"';
  const row2 = 'C-000002;"Hotel Lario";hotel;"Cernobbio";"Luigi Bianchi";"Via Lario 22 - 22012 Cernobbio";"+39 031 654321";"reception@hotellario.it";""';
  return [comment, header, row1, row2].join("\n");
}
