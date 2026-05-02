import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, RefreshCw } from "lucide-react";
import { TicketView } from "@/components/tickets/TicketView";
import { Ticket, useTickets, useTicketPrints } from "@/hooks/useTickets";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { buildTicketSnapshot } from "@/utils/ticketSnapshot";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket | null;
}

const SETTINGS_KEYS = [
  "restaurant_name",
  "business_address",
  "business_phone",
  "business_rfc",
  "wifi_ssid",
  "wifi_password",
];

/**
 * Pull the latest order state and rebuild a fresh snapshot + totals + payment metadata.
 * Returns a patch suitable for `refreshTicket` so the ticket always reflects the current order.
 */
async function buildFreshTicketPatch(ticket: Ticket, language: "es" | "en") {
  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, table_number, status, total, general_discount, created_by, updated_at,
      order_items(*, menu_items(name, name_en), combos(name, name_en)),
      payments(id, amount, tip, payment_method, created_at)
    `)
    .eq("id", ticket.order_id)
    .maybeSingle();
  if (!order) return null;

  let waiterName: string | undefined;
  if (order.created_by) {
    const { data: prof } = await supabase
      .from("profiles").select("full_name").eq("id", order.created_by).maybeSingle();
    waiterName = prof?.full_name ?? undefined;
  }

  const snapshot = await buildTicketSnapshot({
    table_number: order.table_number,
    table_name: ticket.snapshot?.table_name,
    waiter_name: waiterName,
    general_discount: order.general_discount ?? 0,
    language,
    items: (order.order_items ?? []) as any,
  });

  const gd = order.general_discount ?? 0;
  const subtotal = Number(order.total ?? 0);
  const totalAfterDisc = gd > 0 ? subtotal * (1 - gd / 100) : subtotal;
  const allPayments = (order.payments ?? []) as any[];
  const isPaid = order.status === "paid" && allPayments.length > 0;

  // Aggregate across (potentially multiple) payment rows for split payments
  const totalTip = allPayments.reduce((s, p) => s + Number(p.tip ?? 0), 0);
  const distinctMethods = new Set(allPayments.map((p) => p.payment_method));
  const isSplit = distinctMethods.size > 1;
  const firstPayment = allPayments[0];

  if (isSplit) {
    (snapshot as any).payments_breakdown = allPayments
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((p) => ({
        method: p.payment_method,
        amount: Number(p.amount ?? 0),
        tip: Number(p.tip ?? 0),
      }));
  }

  return {
    id: ticket.id,
    snapshot,
    subtotal,
    tip: isPaid ? totalTip : 0,
    total: isPaid ? totalAfterDisc + totalTip : totalAfterDisc,
    payment_id: firstPayment?.id ?? null,
    payment_method: isPaid
      ? (isSplit ? "split" : (firstPayment?.payment_method ?? null))
      : null,
    paid_at: isPaid ? (firstPayment?.created_at ?? order.updated_at) : null,
    kind: (isPaid ? "receipt" : "pre_payment") as "receipt" | "pre_payment",
  };
}

export const PrintTicketDialog = ({ open, onOpenChange, ticket }: Props) => {
  const { language, t } = useLanguage();
  const { logPrint, refreshTicket } = useTickets();
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(ticket);
  const { data: prints = [] } = useTicketPrints(currentTicket?.id);
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [business, setBusiness] = useState({
    name: "",
    address: "",
    phone: "",
    rfc: "",
    wifi_ssid: "",
    wifi_password: "",
  });

  // Sync local copy when prop changes
  useEffect(() => {
    setCurrentTicket(ticket);
  }, [ticket?.id]);

  const refreshFromOrder = async (silent = false) => {
    if (!ticket) return;
    setRefreshing(true);
    try {
      const patch = await buildFreshTicketPatch(ticket, language);
      if (!patch) return;
      const updated = await refreshTicket.mutateAsync(patch);
      setCurrentTicket(updated);
      if (!silent) toast({ title: t("tickets.refreshed") });
    } catch {
      if (!silent) toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!open || !ticket) return;
    (async () => {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("key, value")
        .in("key", SETTINGS_KEYS);
      const map: Record<string, string> = {};
      (data ?? []).forEach((s: any) => (map[s.key] = s.value));
      setBusiness({
        name: map.restaurant_name ?? "",
        address: map.business_address ?? "",
        phone: map.business_phone ?? "",
        rfc: map.business_rfc ?? "",
        wifi_ssid: map.wifi_ssid ?? "",
        wifi_password: map.wifi_password ?? "",
      });
      // Always refresh ticket from current order state when the dialog opens.
      await refreshFromOrder(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket?.id]);

  const handlePrint = async () => {
    if (!currentTicket) return;
    try {
      await logPrint.mutateAsync(currentTicket.id);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
    document.body.classList.add("printing-ticket");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("printing-ticket"), 500);
    }, 50);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("tickets.preview")}</DialogTitle>
          <DialogDescription className="sr-only">{t("tickets.preview")}</DialogDescription>
        </DialogHeader>
        {currentTicket && (
          <>
            <div className="ticket-print-root flex justify-center bg-muted/40 rounded-md p-2 print:bg-white print:p-0">
              <TicketView
                ticket={currentTicket}
                business={business}
                reprintCount={prints.length}
                language={language}
              />
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" className="gap-2" onClick={() => refreshFromOrder(false)} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" /> {t("common.close")}
              </Button>
              <Button className="flex-1 gap-2" onClick={handlePrint} disabled={refreshing}>
                <Printer className="h-4 w-4" />
                {prints.length > 0 ? t("tickets.reprint") : t("tickets.print")}
              </Button>
            </div>
            {prints.length > 0 && (
              <p className="text-xs text-muted-foreground text-center print:hidden">
                {t("tickets.printedTimes")}: {prints.length}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
