import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { TPWithMetrics, MonthData } from "@/types/dashboard";
import { enrichRecords, formatCurrency, formatPercent, formatMonth, calcSTR, calcCategory, calcTrend } from "./calculations";
import { getAllMonthsData, getPreviousMonth } from "./store";

// Colors
const COLOR_A: [number, number, number] = [34, 197, 94];   // #22c55e
const COLOR_B: [number, number, number] = [234, 179, 8];   // #eab308
const COLOR_C: [number, number, number] = [239, 68, 68];   // #ef4444
const COLOR_PRIMARY: [number, number, number] = [30, 64, 175];
const COLOR_DARK: [number, number, number] = [30, 30, 30];
const COLOR_GRAY: [number, number, number] = [120, 120, 120];
const COLOR_LIGHT_BG: [number, number, number] = [245, 245, 245];

function catColor(cat: string | null): [number, number, number] {
  if (cat === "A") return COLOR_A;
  if (cat === "B") return COLOR_B;
  if (cat === "C") return COLOR_C;
  return COLOR_GRAY;
}

function trendLabel(t: string): string {
  if (t === "up") return "⬆";
  if (t === "down") return "⬇";
  if (t === "stable") return "→";
  return "—";
}

function addFooter(doc: jsPDF, footerText: string, mese: string) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_GRAY);
    doc.text(`${i} / ${pageCount}`, w / 2, h - 8, { align: "center" });
    doc.text(formatMonth(mese), 14, h - 8);
    doc.text(footerText, w - 14, h - 8, { align: "right" });
  }
}

function addHeader(doc: jsPDF, title: string, mese: string) {
  const w = doc.internal.pageSize.getWidth();
  // Logo placeholder
  doc.setFillColor(...COLOR_PRIMARY);
  doc.roundedRect(14, 10, 40, 14, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("Como 1907", 17, 19);

  // Title
  doc.setTextColor(...COLOR_DARK);
  doc.setFontSize(16);
  doc.text(title, 60, 19);

  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_GRAY);
  doc.text(`Mese: ${formatMonth(mese)}`, 60, 27);
  const now = new Date();
  doc.text(`Generato il ${now.toLocaleDateString("it-IT")}`, w - 14, 27, { align: "right" });

  // Line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 32, w - 14, 32);
}

function addKPIScorecard(doc: jsPDF, y: number, records: TPWithMetrics[], hasGiacenza: boolean): number {
  const w = doc.internal.pageSize.getWidth();
  const cardW = (w - 28 - 12) / 4;
  const fatturato = records.reduce((s, r) => s + r.venduto_euro, 0);
  const strs = records.filter(r => r.str !== null).map(r => r.str!);
  const avgStr = strs.length ? strs.reduce((a, b) => a + b, 0) / strs.length : null;
  const active = records.filter(r => r.venduto_euro > 0).length;
  const dormant = records.filter(r => r.categoria === "C").length;

  const cards = [
    { label: "Fatturato Totale", value: formatCurrency(fatturato), color: COLOR_PRIMARY },
    { label: "STR Medio", value: hasGiacenza ? formatPercent(avgStr) : "N/D", color: COLOR_A },
    { label: "TP Attivi", value: `${active}`, color: COLOR_PRIMARY },
    { label: "TP Dormienti", value: `${dormant}`, color: COLOR_C },
  ];

  cards.forEach((c, i) => {
    const x = 14 + i * (cardW + 4);
    doc.setFillColor(...COLOR_LIGHT_BG);
    doc.roundedRect(x, y, cardW, 22, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_GRAY);
    doc.text(c.label, x + 4, y + 7);
    doc.setFontSize(14);
    doc.setTextColor(...c.color);
    doc.text(c.value, x + 4, y + 18);
  });

  return y + 28;
}

function addBarChart(doc: jsPDF, y: number, data: { nome: string; fatturato: number; categoria: string | null }[], title: string): number {
  if (y > 230) { doc.addPage(); y = 20; }

  doc.setFontSize(11);
  doc.setTextColor(...COLOR_DARK);
  doc.text(title, 14, y);
  y += 6;

  const maxVal = Math.max(...data.map(d => d.fatturato), 1);
  const barH = 5;
  const maxBarW = 120;
  const leftMargin = 70;

  data.forEach((d, i) => {
    const by = y + i * (barH + 2);
    if (by > 270) return; // prevent overflow

    // Name
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_DARK);
    const label = d.nome.length > 28 ? d.nome.slice(0, 26) + "…" : d.nome;
    doc.text(label, leftMargin - 2, by + 4, { align: "right" });

    // Bar
    const bw = Math.max((d.fatturato / maxVal) * maxBarW, 2);
    doc.setFillColor(...catColor(d.categoria));
    doc.roundedRect(leftMargin, by, bw, barH, 1, 1, "F");

    // Value
    doc.setFontSize(6);
    doc.setTextColor(...COLOR_GRAY);
    doc.text(formatCurrency(d.fatturato), leftMargin + bw + 2, by + 4);
  });

  return y + data.length * (barH + 2) + 6;
}

interface RepComparison {
  rappresentante: string;
  tpCount: number;
  fatturato: number;
  strAvg: number | null;
  active: number;
  dormant: number;
  improved: number;
  worsened: number;
  avgFatPerTP: number;
}

function buildRepComparisons(records: TPWithMetrics[]): RepComparison[] {
  const map = new Map<string, TPWithMetrics[]>();
  records.forEach(r => {
    const key = r.rappresentante || "N/D";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  });

  return [...map.entries()].map(([rep, recs]) => {
    const fat = recs.reduce((s, r) => s + r.venduto_euro, 0);
    const strs = recs.filter(r => r.str !== null).map(r => r.str!);
    const avg = strs.length ? strs.reduce((a, b) => a + b, 0) / strs.length : null;
    return {
      rappresentante: rep,
      tpCount: recs.length,
      fatturato: fat,
      strAvg: avg,
      active: recs.filter(r => r.venduto_euro > 0).length,
      dormant: recs.filter(r => r.categoria === "C").length,
      improved: recs.filter(r => r.trend === "up").length,
      worsened: recs.filter(r => r.trend === "down").length,
      avgFatPerTP: recs.length ? fat / recs.length : 0,
    };
  });
}

function getBestHistoricMonth(tpId: string, allMonths: MonthData[]): { mese: string; fatturato: number } | null {
  let best: { mese: string; fatturato: number } | null = null;
  allMonths.forEach(m => {
    const r = m.records.find(rec => rec.tp_id === tpId);
    if (r && (!best || r.venduto_euro > best.fatturato)) {
      best = { mese: m.mese, fatturato: r.venduto_euro };
    }
  });
  return best;
}

export function generateReport(
  records: TPWithMetrics[],
  selectedMonth: string,
  hasGiacenza: boolean,
  filterRep?: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const allMonths = getAllMonthsData();

  const filtered = filterRep ? records.filter(r => r.rappresentante === filterRep) : records;
  const title = filterRep
    ? `Report Mensile — ${filterRep}`
    : "Report Mensile Touchpoint Network";
  const footerText = filterRep
    ? `Como 1907 — Report ${filterRep}`
    : "Como 1907 — Touchpoint Network Report";

  // 1. Header
  addHeader(doc, title, selectedMonth);

  // 2. KPI Scorecard
  let y = addKPIScorecard(doc, 38, filtered, hasGiacenza);

  // 3. Top 20 bar chart
  const top20 = [...filtered].sort((a, b) => b.venduto_euro - a.venduto_euro).slice(0, 20);
  const barData = top20.map(r => ({ nome: r.tp_nome, fatturato: r.venduto_euro, categoria: r.categoria }));
  y = addBarChart(doc, y + 4, barData, filterRep ? "Top 20 TP per Fatturato" : "Top 20 TP per Fatturato Mensile");

  // 4. Top 10 by revenue table
  doc.addPage();
  addHeader(doc, title, selectedMonth);
  const top10Rev = [...filtered].sort((a, b) => b.venduto_euro - a.venduto_euro).slice(0, 10);

  doc.setFontSize(11);
  doc.setTextColor(...COLOR_DARK);
  doc.text("Top 10 TP per Fatturato", 14, 40);

  const revHeaders = filterRep
    ? [["#", "Nome TP", "Tipo", "Fatturato €", "Cat. ABC"]]
    : [["#", "Nome TP", "Tipo", "Rappresentante", "Fatturato €", "Cat. ABC"]];
  const revBody = top10Rev.map((r, i) => {
    const row = [`${i + 1}`, r.tp_nome, r.tp_tipo, ...(filterRep ? [] : [r.rappresentante]), formatCurrency(r.venduto_euro), r.categoria || "N/D"];
    return row;
  });

  autoTable(doc, {
    startY: 44,
    head: revHeaders,
    body: revBody,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255] },
    didParseCell(data) {
      if (data.section === "body") {
        const catIdx = filterRep ? 4 : 5;
        if (data.column.index === catIdx) {
          const val = data.cell.raw as string;
          if (val === "A") data.cell.styles.textColor = COLOR_A;
          else if (val === "B") data.cell.styles.textColor = COLOR_B;
          else if (val === "C") data.cell.styles.textColor = COLOR_C;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  let afterTable = (doc as any).lastAutoTable.finalY + 10;

  // 5. Top 10 by STR
  if (hasGiacenza) {
    const top10Str = [...filtered].filter(r => r.str !== null).sort((a, b) => b.str! - a.str!).slice(0, 10);
    if (afterTable > 220) { doc.addPage(); addHeader(doc, title, selectedMonth); afterTable = 40; }

    doc.setFontSize(11);
    doc.setTextColor(...COLOR_DARK);
    doc.text("Top 10 TP per STR", 14, afterTable);

    const strHeaders = filterRep
      ? [["#", "Nome TP", "Tipo", "STR%", "Cat. ABC"]]
      : [["#", "Nome TP", "Tipo", "Rappresentante", "STR%", "Cat. ABC"]];
    const strBody = top10Str.map((r, i) => {
      return [`${i + 1}`, r.tp_nome, r.tp_tipo, ...(filterRep ? [] : [r.rappresentante]), formatPercent(r.str), r.categoria || "N/D"];
    });

    autoTable(doc, {
      startY: afterTable + 4,
      head: strHeaders,
      body: strBody,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255] },
      didParseCell(data) {
        if (data.section === "body") {
          const catIdx = filterRep ? 4 : 5;
          if (data.column.index === catIdx) {
            const val = data.cell.raw as string;
            if (val === "A") data.cell.styles.textColor = COLOR_A;
            else if (val === "B") data.cell.styles.textColor = COLOR_B;
            else if (val === "C") data.cell.styles.textColor = COLOR_C;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    afterTable = (doc as any).lastAutoTable.finalY + 10;
  } else {
    if (afterTable > 240) { doc.addPage(); addHeader(doc, title, selectedMonth); afterTable = 40; }
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_GRAY);
    doc.text("STR non disponibile — giacenza non caricata", 14, afterTable);
    afterTable += 8;
  }

  // 6. Rep comparison (only for general report)
  if (!filterRep) {
    doc.addPage();
    addHeader(doc, title, selectedMonth);
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_DARK);
    doc.text("Confronto Rappresentanti", 14, 40);

    const repData = buildRepComparisons(filtered);
    autoTable(doc, {
      startY: 44,
      head: [["Rappresentante", "N° TP", "Fatturato €", "STR Medio", "Attivi", "Dormienti", "Migliorati", "Peggiorati", "Fatt. Medio/TP"]],
      body: repData.map(r => [
        r.rappresentante, `${r.tpCount}`, formatCurrency(r.fatturato),
        r.strAvg !== null ? formatPercent(r.strAvg) : "N/D",
        `${r.active}`, `${r.dormant}`, `${r.improved}`, `${r.worsened}`,
        formatCurrency(r.avgFatPerTP),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255], fontSize: 7 },
    });
    afterTable = (doc as any).lastAutoTable.finalY + 10;
  }

  // 7. Dormant TPs (category C)
  const dormant = [...filtered].filter(r => r.categoria === "C").sort((a, b) => {
    const bestA = getBestHistoricMonth(a.tp_id, allMonths);
    const bestB = getBestHistoricMonth(b.tp_id, allMonths);
    return (bestB?.fatturato ?? 0) - (bestA?.fatturato ?? 0);
  });

  if (dormant.length > 0) {
    if (afterTable > 200 || filterRep) { doc.addPage(); addHeader(doc, title, selectedMonth); afterTable = 40; }

    doc.setFontSize(11);
    doc.setTextColor(...COLOR_DARK);
    doc.text(filterRep ? "TP da riattivare — priorità intervento" : "TP Dormienti (Categoria C)", 14, afterTable);

    const dormantHeaders = filterRep
      ? [["Nome TP", "STR Attuale", "Miglior Mese", "Fatturato Miglior Mese", "Trend"]]
      : [["Nome TP", "Rappresentante", "STR Attuale", "Miglior Mese", "Fatturato Miglior Mese", "Trend"]];

    const dormantBody = dormant.slice(0, 30).map(r => {
      const best = getBestHistoricMonth(r.tp_id, allMonths);
      return [
        r.tp_nome,
        ...(filterRep ? [] : [r.rappresentante]),
        formatPercent(r.str),
        best ? formatMonth(best.mese) : "—",
        best ? formatCurrency(best.fatturato) : "—",
        trendLabel(r.trend),
      ];
    });

    autoTable(doc, {
      startY: afterTable + 4,
      head: dormantHeaders,
      body: dormantBody,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: COLOR_C, textColor: [255, 255, 255] },
    });
    afterTable = (doc as any).lastAutoTable.finalY + 10;
  }

  // 8. Improved / Worsened (rep report only)
  if (filterRep) {
    const improved = filtered.filter(r => r.trend === "up");
    const worsened = filtered.filter(r => r.trend === "down");

    if (improved.length > 0 || worsened.length > 0) {
      if (afterTable > 200) { doc.addPage(); addHeader(doc, title, selectedMonth); afterTable = 40; }

      if (improved.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor(...COLOR_A);
        doc.text("⬆ TP Migliorati", 14, afterTable);

        autoTable(doc, {
          startY: afterTable + 4,
          head: [["Nome TP", "Trend", "Fatturato €"]],
          body: improved.map(r => [r.tp_nome, `${r.trend === "up" ? "↑" : ""}`, formatCurrency(r.venduto_euro)]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: COLOR_A, textColor: [255, 255, 255] },
        });
        afterTable = (doc as any).lastAutoTable.finalY + 8;
      }

      if (worsened.length > 0) {
        if (afterTable > 240) { doc.addPage(); addHeader(doc, title, selectedMonth); afterTable = 40; }
        doc.setFontSize(11);
        doc.setTextColor(...COLOR_C);
        doc.text("⬇ TP Peggiorati", 14, afterTable);

        autoTable(doc, {
          startY: afterTable + 4,
          head: [["Nome TP", "Trend", "Fatturato €"]],
          body: worsened.map(r => [r.tp_nome, `${r.trend === "down" ? "↓" : ""}`, formatCurrency(r.venduto_euro)]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: COLOR_C, textColor: [255, 255, 255] },
        });
      }
    }
  }

  // Footer on all pages
  addFooter(doc, footerText, selectedMonth);

  // Save
  const safeName = filterRep ? filterRep.toLowerCase().replace(/\s+/g, "-") : "touchpoint";
  const fileName = filterRep
    ? `report_${safeName}_${selectedMonth}.pdf`
    : `report_touchpoint_${selectedMonth}.pdf`;
  doc.save(fileName);
}
