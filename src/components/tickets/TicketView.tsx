import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Ticket } from "@/hooks/useTickets";

interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  rfc: string;
  wifi_ssid: string;
  wifi_password: string;
}

interface Props {
  ticket: Ticket;
  business: BusinessInfo;
  reprintCount?: number;
  language?: "es" | "en";
}

const fmtMoney = (n: number) => `$${n.toFixed(2)}`;
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
};

/** Build Wi-Fi QR string per the de-facto Wi-Fi join standard */
const buildWifiPayload = (ssid: string, pass: string) => {
  if (!ssid) return "";
  const esc = (v: string) => v.replace(/([\\;,:"])/g, "\\$1");
  return `WIFI:T:${pass ? "WPA" : "nopass"};S:${esc(ssid)};P:${esc(pass)};;`;
};

export const TicketView = ({ ticket, business, reprintCount = 0, language = "es" }: Props) => {
  const [wifiQr, setWifiQr] = useState<string>("");
  const [invoiceQr, setInvoiceQr] = useState<string>("");

  useEffect(() => {
    const payload = buildWifiPayload(business.wifi_ssid, business.wifi_password);
    if (payload) {
      QRCode.toDataURL(payload, { width: 140, margin: 0 }).then(setWifiQr).catch(() => setWifiQr(""));
    } else {
      setWifiQr("");
    }
  }, [business.wifi_ssid, business.wifi_password]);

  useEffect(() => {
    const url = `${window.location.origin}/factura/${ticket.public_id}`;
    QRCode.toDataURL(url, { width: 140, margin: 0 }).then(setInvoiceQr).catch(() => setInvoiceQr(""));
  }, [ticket.public_id]);

  const t = (es: string, en: string) => (language === "es" ? es : en);
  const snap = ticket.snapshot ?? ({} as any);
  const items = snap.items ?? [];
  const printedAt = new Date().toISOString();
  const isReceipt = ticket.kind === "receipt";

  // Public table identifier: short slice of the ticket public_id (NOT the internal table number).
  const publicTableId = ticket.public_id.slice(0, 6).toUpperCase();
  const methodLabel = ticket.payment_method === "cash"
    ? t("Efectivo", "Cash")
    : ticket.payment_method === "card"
      ? t("Tarjeta", "Card")
      : ticket.payment_method ?? "-";

  // ─── Totals breakdown ────────────────────────────────────────────────────
  // ticket.subtotal already reflects per-item discounts (sum of net line amounts).
  const generalDiscount = snap.general_discount ?? 0;
  const generalDiscountAmount = ticket.subtotal * (generalDiscount / 100);
  const totalAfterGeneralDisc = ticket.subtotal - generalDiscountAmount;

  // IVA breakdown — prices INCLUDE IVA. Reverse-calculate to show subtotal w/o IVA + IVA.
  const taxRate = snap.tax_rate ?? 16;
  const taxFactor = 1 + taxRate / 100;
  const subtotalWithoutTax = totalAfterGeneralDisc / taxFactor;
  const taxAmount = totalAfterGeneralDisc - subtotalWithoutTax;

  return (
    <div className="ticket-print">
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {business.name || "Hypnos Cafe"}
        </div>
        {business.address && <div>{business.address}</div>}
        {business.phone && <div>Tel: {business.phone}</div>}
        {business.rfc && <div>RFC: {business.rfc}</div>}
      </div>

      <div className="ticket-divider" />

      {/* Ticket meta */}
      <div style={{ textAlign: "center", fontWeight: 700 }}>
        {isReceipt
          ? t("NOTA DE CONSUMO", "SALES RECEIPT")
          : t("CUENTA PREVIA — NO PAGADA", "PRE-BILL — UNPAID")}
      </div>
      <div className="ticket-row">
        <span>{t("Folio", "Ref")}:</span>
        <span style={{ fontFamily: "monospace" }}>{ticket.public_id.slice(0, 8).toUpperCase()}</span>
      </div>
      <div className="ticket-row">
        <span>
          {t("Mesa", "Table")}: <strong style={{ fontFamily: "monospace" }}>{publicTableId}</strong>
        </span>
        <span>{snap.waiter_name ? `${t("Mesero", "Waiter")}: ${snap.waiter_name}` : ""}</span>
      </div>
      {isReceipt && (
        <div className="ticket-row">
          <span>{t("Fecha pago", "Paid at")}:</span>
          <span>{fmtDate(ticket.paid_at)}</span>
        </div>
      )}
      <div className="ticket-row">
        <span>{t("Impreso", "Printed")}:</span>
        <span>{fmtDate(printedAt)}</span>
      </div>
      {reprintCount > 0 && (
        <div style={{ textAlign: "center", fontWeight: 700 }}>
          *** {t("REIMPRESIÓN", "REPRINT")} #{reprintCount + 1} ***
        </div>
      )}

      <div className="ticket-divider" />

      {/* Items — combo items grouped under a single combo line */}
      <div className="ticket-row" style={{ fontWeight: 700 }}>
        <span>{t("Cant. Descripción", "Qty Item")}</span>
        <span>{t("Importe", "Amount")}</span>
      </div>
      {(() => {
        const rendered: JSX.Element[] = [];
        const seenGroups = new Set<string>();

        const renderSingle = (it: any, idx: number | string, opts?: { indent?: boolean; hidePrice?: boolean }) => {
          const indent = opts?.indent ? 12 : 0;
          const hidePrice = opts?.hidePrice ?? false;
          const hasPromo = it.promo_price != null && it.original_price != null && it.promo_price < it.original_price;
          const lineGross = it.quantity * it.unit_price;
          const lineNet = lineGross * (1 - (it.discount ?? 0) / 100);
          const originalLine = it.quantity * (it.original_price ?? it.unit_price);
          return (
            <div key={`it-${idx}`} style={{ marginTop: 2 }}>
              <div className="ticket-row">
                <span style={{ flex: 1, paddingLeft: indent, paddingRight: 4 }}>
                  {it.quantity}x {it.name}
                </span>
                <span>{hidePrice ? "" : fmtMoney(lineNet)}</span>
              </div>
              {!hidePrice && hasPromo && (
                <div style={{ fontSize: 10, paddingLeft: indent + 12 }}>
                  {t("Precio normal", "Regular")}:{" "}
                  <span style={{ textDecoration: "line-through" }}>{fmtMoney(it.original_price)}</span>{" "}
                  → {t("Promo", "Promo")} {fmtMoney(it.promo_price)}
                  {it.quantity > 1 && (
                    <> ({t("ahorro", "save")} {fmtMoney(originalLine - lineGross)})</>
                  )}
                </div>
              )}
              {!hidePrice && it.discount > 0 && (
                <div style={{ fontSize: 10, paddingLeft: indent + 12 }}>
                  {t("Descuento", "Discount")} {it.discount}%:{" "}
                  {fmtMoney(lineGross)} − {fmtMoney(lineGross - lineNet)} ={" "}
                  <strong>{fmtMoney(lineNet)}</strong>
                </div>
              )}
              {it.notes && (
                <div style={{ fontSize: 10, paddingLeft: indent + 12, fontStyle: "italic" }}>
                  {it.notes}
                </div>
              )}
            </div>
          );
        };

        items.forEach((it: any, idx: number) => {
          const groupId = it.combo_group_id;
          if (groupId) {
            if (seenGroups.has(groupId)) return;
            seenGroups.add(groupId);
            const groupItems = items.filter((x: any) => x.combo_group_id === groupId);
            const comboQty = it.combo_quantity ?? 1;
            const comboUnit = it.combo_unit_price ?? 0;
            const comboName = it.combo_name ?? t("Combo", "Combo");
            const comboTotal = comboQty * comboUnit;
            rendered.push(
              <div key={`combo-${groupId}`} style={{ marginTop: 4 }}>
                <div className="ticket-row" style={{ fontWeight: 700 }}>
                  <span style={{ flex: 1, paddingRight: 4 }}>
                    {comboQty}x {comboName}
                  </span>
                  <span>{fmtMoney(comboTotal)}</span>
                </div>
                <div style={{ fontSize: 10, paddingLeft: 12, fontStyle: "italic" }}>
                  {t("Incluye", "Includes")}:
                </div>
                {groupItems.map((gi: any, gidx: number) =>
                  renderSingle(gi, `${groupId}-${gidx}`, { indent: true, hidePrice: true })
                )}
              </div>
            );
          } else {
            rendered.push(renderSingle(it, idx));
          }
        });
        return rendered;
      })()}

      <div className="ticket-divider" />

      {/* Totals */}
      <div className="ticket-row">
        <span>{t("Subtotal", "Subtotal")}:</span>
        <span>{fmtMoney(ticket.subtotal)}</span>
      </div>

      {/* General discount on the whole order */}
      {generalDiscount > 0 && (
        <>
          <div className="ticket-row">
            <span>
              {t("Descuento general", "Order discount")} ({generalDiscount}%):
            </span>
            <span>−{fmtMoney(generalDiscountAmount)}</span>
          </div>
          <div className="ticket-row">
            <span>{t("Después de descuento", "After discount")}:</span>
            <span>{fmtMoney(totalAfterGeneralDisc)}</span>
          </div>
        </>
      )}

      {/* IVA breakdown — prices include IVA */}
      <div className="ticket-row" style={{ fontSize: 10, color: "#444" }}>
        <span>{t("Subtotal sin IVA", "Subtotal w/o VAT")}:</span>
        <span>{fmtMoney(subtotalWithoutTax)}</span>
      </div>
      <div className="ticket-row" style={{ fontSize: 10, color: "#444" }}>
        <span>IVA ({taxRate}%):</span>
        <span>{fmtMoney(taxAmount)}</span>
      </div>

      {ticket.tip > 0 && (
        <div className="ticket-row">
          <span>{t("Propina", "Tip")}:</span>
          <span>{fmtMoney(ticket.tip)}</span>
        </div>
      )}
      <div className="ticket-row" style={{ fontWeight: 700, fontSize: 13 }}>
        <span>TOTAL MXN:</span>
        <span>{fmtMoney(ticket.total)}</span>
      </div>
      <div style={{ fontSize: 9, fontStyle: "italic", textAlign: "right" }}>
        {t("Precios con IVA incluido", "Prices include VAT")}
      </div>
      {isReceipt && ticket.payment_method && (() => {
        const breakdown = (snap as any).payments_breakdown as
          | { method: string; amount: number; tip: number }[]
          | undefined;
        if (breakdown && breakdown.length > 1) {
          const labelFor = (m: string) =>
            m === "cash" ? t("Efectivo", "Cash")
            : m === "card" ? t("Tarjeta", "Card")
            : m;
          return (
            <>
              <div className="ticket-row" style={{ fontWeight: 700 }}>
                <span>{t("Pago dividido", "Split payment")}:</span>
                <span />
              </div>
              {breakdown.map((p, i) => (
                <div key={i} style={{ marginLeft: 8 }}>
                  <div className="ticket-row" style={{ fontSize: 11 }}>
                    <span>• {labelFor(p.method)}:</span>
                    <span>{fmtMoney(p.amount + p.tip)}</span>
                  </div>
                  {p.tip > 0 && (
                    <div className="ticket-row" style={{ fontSize: 10, color: "#444", marginLeft: 10 }}>
                      <span>{t("incluye propina", "incl. tip")}:</span>
                      <span>{fmtMoney(p.tip)}</span>
                    </div>
                  )}
                </div>
              ))}
            </>
          );
        }
        return (
          <div className="ticket-row">
            <span>{t("Método", "Method")}:</span>
            <span>{methodLabel}</span>
          </div>
        );
      })()}

      <div className="ticket-divider" />

      {/* Invoice request */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 700 }}>
          {t("¿Necesitas factura?", "Need a tax invoice?")}
        </div>
        <div style={{ fontSize: 10 }}>
          {t(
            "Escanea el QR para solicitar tu CFDI con este folio.",
            "Scan the QR to request your invoice with this folio.",
          )}
        </div>
        {invoiceQr && (
          <img src={invoiceQr} alt="Invoice QR" style={{ width: 120, height: 120, margin: "4px auto" }} />
        )}
        <div style={{ fontSize: 9, fontFamily: "monospace", wordBreak: "break-all" }}>
          {ticket.public_id}
        </div>
      </div>

      {/* WiFi */}
      {business.wifi_ssid && (
        <>
          <div className="ticket-divider" />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700 }}>
              {t("WiFi gratis", "Free WiFi")}
            </div>
            <div style={{ fontSize: 10 }}>
              {t("Red", "SSID")}: {business.wifi_ssid}
            </div>
            {business.wifi_password && (
              <div style={{ fontSize: 10 }}>
                {t("Contraseña", "Password")}: {business.wifi_password}
              </div>
            )}
            {wifiQr && (
              <img src={wifiQr} alt="WiFi QR" style={{ width: 120, height: 120, margin: "4px auto" }} />
            )}
          </div>
        </>
      )}

      <div className="ticket-divider" />
      <div style={{ textAlign: "center", fontSize: 9 }}>
        {t(
          "Esta nota NO es un comprobante fiscal (CFDI).",
          "This receipt is NOT a Mexican tax invoice (CFDI).",
        )}
        <br />
        {t("¡Gracias por tu visita!", "Thank you for your visit!")}
      </div>
    </div>
  );
};
