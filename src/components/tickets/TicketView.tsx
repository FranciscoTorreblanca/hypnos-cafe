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
    // Future CFDI invoice request URL — based on ticket public_id only (no internal ids exposed)
    const url = `${window.location.origin}/factura/${ticket.public_id}`;
    QRCode.toDataURL(url, { width: 140, margin: 0 }).then(setInvoiceQr).catch(() => setInvoiceQr(""));
  }, [ticket.public_id]);

  const t = (es: string, en: string) => (language === "es" ? es : en);
  const snap = ticket.snapshot ?? ({} as any);
  const items = snap.items ?? [];
  const printedAt = new Date().toISOString();
  const isReceipt = ticket.kind === "receipt";

  const tableLabel = snap.table_name || `${t("Mesa", "Table")} ${snap.table_number ?? "-"}`;
  const methodLabel = ticket.payment_method === "cash"
    ? t("Efectivo", "Cash")
    : ticket.payment_method === "card"
      ? t("Tarjeta", "Card")
      : ticket.payment_method ?? "-";

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
        <span>{tableLabel}</span>
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

      {/* Items */}
      <div className="ticket-row" style={{ fontWeight: 700 }}>
        <span>{t("Cant. Descripción", "Qty Item")}</span>
        <span>{t("Importe", "Amount")}</span>
      </div>
      {items.map((it: any, idx: number) => {
        const lineGross = it.quantity * it.unit_price;
        const lineNet = lineGross * (1 - (it.discount ?? 0) / 100);
        return (
          <div key={idx} style={{ marginTop: 2 }}>
            <div className="ticket-row">
              <span style={{ flex: 1, paddingRight: 4 }}>
                {it.quantity}x {it.name}
              </span>
              <span>{fmtMoney(lineNet)}</span>
            </div>
            {it.discount > 0 && (
              <div style={{ fontSize: 10, paddingLeft: 12 }}>
                {t("Desc.", "Disc.")} {it.discount}% (−{fmtMoney(lineGross - lineNet)})
              </div>
            )}
            {it.notes && (
              <div style={{ fontSize: 10, paddingLeft: 12, fontStyle: "italic" }}>
                {it.notes}
              </div>
            )}
          </div>
        );
      })}

      <div className="ticket-divider" />

      {/* Totals */}
      <div className="ticket-row">
        <span>{t("Subtotal", "Subtotal")}:</span>
        <span>{fmtMoney(ticket.subtotal)}</span>
      </div>
      {snap.general_discount > 0 && (
        <div className="ticket-row">
          <span>{t("Descuento", "Discount")} ({snap.general_discount}%):</span>
          <span>−{fmtMoney(ticket.subtotal * (snap.general_discount / 100))}</span>
        </div>
      )}
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
      {isReceipt && ticket.payment_method && (
        <div className="ticket-row">
          <span>{t("Método", "Method")}:</span>
          <span>{methodLabel}</span>
        </div>
      )}

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
