import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { TicketView } from "@/components/tickets/TicketView";
import { Ticket, useTickets, useTicketPrints } from "@/hooks/useTickets";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export const PrintTicketDialog = ({ open, onOpenChange, ticket }: Props) => {
  const { language, t } = useLanguage();
  const { logPrint } = useTickets();
  const { data: prints = [] } = useTicketPrints(ticket?.id);
  const { toast } = useToast();
  const [business, setBusiness] = useState({
    name: "",
    address: "",
    phone: "",
    rfc: "",
    wifi_ssid: "",
    wifi_password: "",
  });

  useEffect(() => {
    if (!open) return;
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
    })();
  }, [open]);

  const handlePrint = async () => {
    if (!ticket) return;
    try {
      await logPrint.mutateAsync(ticket.id);
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
        </DialogHeader>
        {ticket && (
          <>
            <div className="ticket-print-root flex justify-center bg-muted/40 rounded-md p-2 print:bg-white print:p-0">
              <TicketView
                ticket={ticket}
                business={business}
                reprintCount={prints.length}
                language={language}
              />
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" /> {t("common.close")}
              </Button>
              <Button className="flex-1 gap-2" onClick={handlePrint}>
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
