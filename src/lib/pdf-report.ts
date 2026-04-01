import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { TPWithMetrics, MonthData } from "@/types/dashboard";
import { formatCurrency, formatPercent, formatMonth } from "./calculations";
import { TPAnagrafica } from "@/lib/store";

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

function addFooter(doc: jsPDF, footerText: string, meseLabel: string) {
  const pageCount = (doc as any).internal?.getNumberOfPages?.() ?? 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_GRAY);
    doc.text(`${i} / ${pageCount}`, w / 2, h - 8, { align: "center" });
    doc.text(meseLabel, 14, h - 8);
    doc.text(footerText, w - 14, h - 8, { align: "right" });
  }
}

function addHeader(doc: jsPDF, title: string, meseLabel: string) {
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
  doc.text(`Periodo: ${meseLabel}`, 60, 27);
  const now = new Date();
  doc.text(`Generato il ${now.toLocaleDateString("it-IT")}`, w - 14, 27, { align: "right" });

  // Line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 32, w - 14, 32);
}

function addKPIScorecard(doc: jsPDF, y: number, records: TPWithMetrics[], tpAnagraficaCount: number): number {
  const w = doc.internal.pageSize.getWidth();
  const cardW = (w - 28 - 12) / 4;
  const fatturato = records.reduce((s, r) => s + r.venduto_euro, 0);
  const active = records.filter(r => r.venduto_euro > 0).length;
  const dormant = tpAnagraficaCount - active;
  const avgFatPerTP = active > 0 ? fatturato / active : 0;

  const cards = [
    { label: "Fatturato Totale", value: formatCurrency(fatturato), color: COLOR_PRIMARY },
    { label: "Fatt. Medio/TP", value: formatCurrency(avgFatPerTP), color: COLOR_A },
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

function drawPieSlice(
  doc: jsPDF,
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
  color: [number, number, number]
) {
  const span = endAngle - startAngle;
  if (Math.abs(span) < 0.001) return;
  doc.setFillColor(...color);
  const k = (doc as any).internal.scaleFactor;
  const pageH = doc.internal.pageSize.getHeight();
  const toX = (x: number) => x * k;
  const toY = (y: number) => (pageH - y) * k;
  const steps = Math.max(24, Math.ceil(Math.abs(span) * 12));
  const parts: string[] = [];
  parts.push(`${toX(cx).toFixed(3)} ${toY(cy).toFixed(3)} m`);
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + span * (i / steps);
    parts.push(`${toX(cx + r * Math.cos(a)).toFixed(3)} ${toY(cy + r * Math.sin(a)).toFixed(3)} l`);
  }
  parts.push('h f');
  (doc as any).internal.write(parts.join(' '));
}

function addActiveInactivePie(
  doc: jsPDF, y: number,
  activeCount: number, inactiveCount: number,
  title: string
): number {
  const total = activeCount + inactiveCount;
  if (total === 0) return y;

  doc.setFontSize(11);
  doc.setTextColor(...COLOR_DARK);
  doc.text(title, 14, y);
  y += 6;

  const cx = 55;
  const cy = y + 30;
  const r = 28;
  const start = -Math.PI / 2;
  const mid = start + (activeCount / total) * 2 * Math.PI;
  const end = start + 2 * Math.PI;

  drawPieSlice(doc, cx, cy, r, start, mid, COLOR_A);
  if (inactiveCount > 0) drawPieSlice(doc, cx, cy, r, mid, end, COLOR_C);

  // Thin white separator line
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(cx, cy, cx + r * Math.cos(start), cy + r * Math.sin(start));
  if (inactiveCount > 0) doc.line(cx, cy, cx + r * Math.cos(mid), cy + r * Math.sin(mid));
  doc.setLineWidth(0.2);

  // Legend
  const lx = cx + r + 12;
  const activePct = ((activeCount / total) * 100).toFixed(1);
  const inactivePct = ((inactiveCount / total) * 100).toFixed(1);

  doc.setFillColor(...COLOR_A);
  doc.roundedRect(lx, cy - 18, 5, 5, 1, 1, "F");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_DARK);
  doc.text(`Attivi: ${activeCount} (${activePct}%)`, lx + 7, cy - 14);

  doc.setFillColor(...COLOR_C);
  doc.roundedRect(lx, cy - 8, 5, 5, 1, 1, "F");
  doc.text(`Inattivi: ${inactiveCount} (${inactivePct}%)`, lx + 7, cy - 4);

  doc.setFillColor(...COLOR_GRAY);
  doc.roundedRect(lx, cy + 2, 5, 5, 1, 1, "F");
  doc.setTextColor(...COLOR_GRAY);
  doc.text(`Totale anagrafica: ${total}`, lx + 7, cy + 6);

  return cy + r + 8;
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
    if (r && (!best || r.venduto_euro > best.fatturato || (r.venduto_euro === best.fatturato && m.mese > best.mese))) {
      best = { mese: m.mese, fatturato: r.venduto_euro };
    }
  });
  return best;
}

function buildMeseLabel(selectedMonth: string | string[]): string {
  if (typeof selectedMonth === "string") return formatMonth(selectedMonth);
  if (selectedMonth.length === 0) return "";
  if (selectedMonth.length === 1) return formatMonth(selectedMonth[0]);
  const sorted = [...selectedMonth].sort();
  return `${formatMonth(sorted[0])} — ${formatMonth(sorted[sorted.length - 1])}`;
}

export function generateReport(
  records: TPWithMetrics[],
  selectedMonth: string | string[],
  hasGiacenza: boolean,
  allMonths: MonthData[],
  tpAnagrafica: TPAnagrafica[],
  filterRep?: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const filtered = filterRep ? records.filter(r => r.rappresentante === filterRep) : records;
  const title = filterRep
    ? `Report Mensile — ${filterRep}`
    : "Report Mensile Touchpoint Network";
  const footerText = filterRep
    ? `Como 1907 — Report ${filterRep}`
    : "Como 1907 — Touchpoint Network Report";
  const meseLabel = buildMeseLabel(selectedMonth);

  // Determine the primary mese string for footer/historic lookups (last month)
  const primaryMese = typeof selectedMonth === "string"
    ? selectedMonth
    : [...selectedMonth].sort().pop() ?? "";

  // 1. Header
  addHeader(doc, title, meseLabel);

  // 2. KPI Scorecard
  const anaFiltered = filterRep
    ? tpAnagrafica.filter(tp => tp.rappresentante === filterRep)
    : tpAnagrafica;
  let y = addKPIScorecard(doc, 38, filtered, anaFiltered.length);

  // 3. Top 20 bar chart
  const top20 = [...filtered].sort((a, b) => b.venduto_euro - a.venduto_euro).slice(0, 20);
  const barData = top20.map(r => ({ nome: r.tp_nome, fatturato: r.venduto_euro, categoria: r.categoria }));
  y = addBarChart(doc, y + 4, barData, filterRep ? "Top 20 TP per Fatturato" : "Top 20 TP per Fatturato");

  // 4. Top 10 by revenue table
  doc.addPage();
  addHeader(doc, title, meseLabel);
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
          const val = String(data.cell.raw ?? "");
          if (val === "A") data.cell.styles.textColor = COLOR_A;
          else if (val === "B") data.cell.styles.textColor = COLOR_B;
          else if (val === "C") data.cell.styles.textColor = COLOR_C;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  let afterTable = ((doc as any).lastAutoTable?.finalY ?? 40) + 10;

  // 5. Rep comparison (only for general report)
  if (!filterRep) {
    doc.addPage();
    addHeader(doc, title, meseLabel);
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
    afterTable = ((doc as any).lastAutoTable?.finalY ?? 40) + 10;
  }

  // 6. Dormant TPs (category C)
  const dormant = [...filtered].filter(r => r.categoria === "C").sort((a, b) => {
    const bestA = getBestHistoricMonth(a.tp_id, allMonths);
    const bestB = getBestHistoricMonth(b.tp_id, allMonths);
    return (bestB?.fatturato ?? 0) - (bestA?.fatturato ?? 0);
  });

  if (dormant.length > 0) {
    if (afterTable > 200 || filterRep) { doc.addPage(); addHeader(doc, title, meseLabel); afterTable = 40; }

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
    afterTable = ((doc as any).lastAutoTable?.finalY ?? 40) + 10;
  }

  // 7. TP Inattivi (in anagrafica but no sales in period)
  const activeIds = new Set(filtered.filter(r => r.venduto_euro > 0).map(r => r.tp_id));
  const inactiveTP = anaFiltered.filter(tp => !activeIds.has(tp.tp_id));

  if (inactiveTP.length > 0 || anaFiltered.length > 0) {
    if (afterTable > 150) { doc.addPage(); addHeader(doc, title, meseLabel); afterTable = 40; }

    const activeCount = anaFiltered.length - inactiveTP.length;
    afterTable = addActiveInactivePie(doc, afterTable, activeCount, inactiveTP.length, "TP Attivi vs Inattivi nel periodo");
  }

  if (inactiveTP.length > 0) {
    if (afterTable > 200) { doc.addPage(); addHeader(doc, title, meseLabel); afterTable = 40; }

    doc.setFontSize(11);
    doc.setTextColor(...COLOR_DARK);
    doc.text(`TP Inattivi nel periodo — ${inactiveTP.length} su ${anaFiltered.length}`, 14, afterTable);

    const inactiveHeaders = filterRep
      ? [["Codice TP", "Nome TP"]]
      : [["Codice TP", "Nome TP", "Rappresentante"]];
    const inactiveBody = inactiveTP.map(tp => filterRep
      ? [tp.tp_id, tp.tp_nome]
      : [tp.tp_id, tp.tp_nome, tp.rappresentante || "N/D"]
    );

    autoTable(doc, {
      startY: afterTable + 4,
      head: inactiveHeaders,
      body: inactiveBody,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: COLOR_GRAY, textColor: [255, 255, 255] },
    });
    afterTable = ((doc as any).lastAutoTable?.finalY ?? 40) + 10;
  }

  // 8. Improved / Worsened (rep report only)
  if (filterRep) {
    const improved = filtered.filter(r => r.trend === "up");
    const worsened = filtered.filter(r => r.trend === "down");

    if (improved.length > 0 || worsened.length > 0) {
      if (afterTable > 200) { doc.addPage(); addHeader(doc, title, meseLabel); afterTable = 40; }

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
        afterTable = ((doc as any).lastAutoTable?.finalY ?? 40) + 8;
      }

      if (worsened.length > 0) {
        if (afterTable > 240) { doc.addPage(); addHeader(doc, title, meseLabel); afterTable = 40; }
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
  addFooter(doc, footerText, meseLabel);

  // Save
  const safeName = filterRep ? filterRep.toLowerCase().replace(/\s+/g, "-") : "touchpoint";
  const safeMonth = typeof selectedMonth === "string"
    ? selectedMonth
    : [...selectedMonth].sort().join("_");
  const fileName = filterRep
    ? `report_${safeName}_${safeMonth}.pdf`
    : `report_touchpoint_${safeMonth}.pdf`;
  doc.save(fileName);
}
