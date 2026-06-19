import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { TillSession, TillXReport } from "@/hooks/useTillSessions";

type Lang = "es" | "en";
type T = (k: string) => string;

const fmtMoney = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0);
  return `$${v.toFixed(2)}`;
};

const fmtDate = (d: string | null | undefined, lang: Lang) =>
  d ? new Date(d).toLocaleString(lang === "es" ? "es-MX" : "en-US") : "—";

interface Args {
  kind: "X" | "Z";
  session: TillSession;
  report: TillXReport | any; // Z uses session.z_report
  businessName?: string;
  lang: Lang;
  t: T;
}

export function generateTillReportPdf({ kind, session, report, businessName, lang, t }: Args) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 50;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(businessName || "", marginX, y);
  y += 20;

  doc.setFontSize(14);
  const title =
    kind === "X"
      ? lang === "es" ? "Reporte X (Corte Parcial)" : "X Report (Partial Cut)"
      : lang === "es" ? "Reporte Z (Cierre de Caja)" : "Z Report (Till Close)";
  doc.text(title, marginX, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `${t("till.generatedAt")}: ${fmtDate(report?.generated_at ?? new Date().toISOString(), lang)}`,
    marginX,
    y
  );
  y += 12;
  doc.text(`${lang === "es" ? "Sesión" : "Session"}: ${session.id}`, marginX, y);
  y += 16;
  doc.setTextColor(0);

  // Session info
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    body: [
      [lang === "es" ? "Abierto" : "Opened", fmtDate(session.opened_at, lang)],
      ...(kind === "Z"
        ? [[lang === "es" ? "Cerrado" : "Closed", fmtDate(session.closed_at, lang)]]
        : []),
      [t("till.openingFloat"), fmtMoney(session.opening_float)],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 160 } },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  // Totals
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(lang === "es" ? "Totales" : "Totals", marginX, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    theme: "striped",
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 10 },
    head: [[lang === "es" ? "Concepto" : "Item", lang === "es" ? "Monto" : "Amount"]],
    body: [
      [t("till.cashPayments"), fmtMoney(report?.cash_payments_total)],
      [`+ ${lang === "es" ? "Entradas" : "Cash in"}`, fmtMoney(report?.cash_in_total)],
      [`− ${lang === "es" ? "Salidas" : "Cash out"}`, fmtMoney(report?.cash_out_total)],
      [t("till.expectedCash"), fmtMoney(report?.expected_cash)],
      [
        lang === "es" ? "Transacciones" : "Transactions",
        String(report?.transactions_count ?? 0),
      ],
    ],
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  // Payments breakdown
  const breakdown: Record<string, { count: number; amount: number; tip: number }> =
    report?.payments_breakdown ?? {};
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(t("till.paymentsBreakdown"), marginX, y);
  y += 4;
  const rows = Object.entries(breakdown).map(([m, v]) => [
    m,
    String(v.count ?? 0),
    fmtMoney(v.amount),
    fmtMoney(v.tip),
  ]);
  autoTable(doc, {
    startY: y,
    theme: "striped",
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 10 },
    head: [[
      lang === "es" ? "Método" : "Method",
      "#",
      lang === "es" ? "Monto" : "Amount",
      lang === "es" ? "Propina" : "Tip",
    ]],
    body: rows.length ? rows : [[t("till.noPaymentsYet"), "", "", ""]],
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  // Z-only: closing details
  if (kind === "Z") {
    const expected = Number(report?.expected_cash ?? session.closing_expected ?? 0);
    const counted = Number(report?.counted ?? session.closing_counted ?? 0);
    const diff = Number(report?.difference ?? session.closing_difference ?? counted - expected);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(lang === "es" ? "Cierre" : "Closing", marginX, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 10 },
      body: [
        [t("till.expectedCash"), fmtMoney(expected)],
        [t("till.countedCash"), fmtMoney(counted)],
        [
          t("till.difference"),
          `${diff > 0 ? "+" : ""}${fmtMoney(diff).replace("$", "$")}`,
        ],
      ],
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 200 } },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 14;

    const denoms: Record<string, number> | null =
      (report?.denominations as any) ?? session.closing_denominations ?? null;
    if (denoms && Object.keys(denoms).length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text(lang === "es" ? "Conteo de denominaciones" : "Denomination count", marginX, y);
      y += 4;
      const dRows = Object.entries(denoms)
        .map(([d, q]) => [d, Number(q), Number(d) * Number(q)])
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([d, q, sub]) => [`$${d}`, String(q), fmtMoney(sub as number)]);
      autoTable(doc, {
        startY: y,
        theme: "striped",
        headStyles: { fillColor: [40, 40, 40] },
        styles: { fontSize: 10 },
        head: [[
          lang === "es" ? "Denominación" : "Denomination",
          lang === "es" ? "Cantidad" : "Qty",
          lang === "es" ? "Subtotal" : "Subtotal",
        ]],
        body: dRows,
        margin: { left: marginX, right: marginX },
      });
      y = (doc as any).lastAutoTable.finalY + 14;
    }

    if (session.closing_notes) {
      doc.setFont("helvetica", "bold");
      doc.text(t("till.closingNotes"), marginX, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(session.closing_notes, pageW - marginX * 2);
      doc.text(lines, marginX, y);
      y += lines.length * 12 + 6;
    }
  }

  if (session.opening_notes && kind === "X") {
    doc.setFont("helvetica", "bold");
    doc.text(lang === "es" ? "Notas de apertura" : "Opening notes", marginX, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(session.opening_notes, pageW - marginX * 2);
    doc.text(lines, marginX, y);
  }

  const fname = `${kind}-report-${new Date(session.opened_at).toISOString().slice(0, 10)}-${session.id.slice(0, 8)}.pdf`;
  doc.save(fname);
}
