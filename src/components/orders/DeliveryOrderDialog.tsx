import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Bike, Trash2, CheckCircle2, Loader2, Plus, Minus, XCircle } from "lucide-react";

import { useOrders, type Order } from "@/hooks/useOrders";
import { useMenuItems, getEffectivePrice } from "@/hooks/useMenuItems";
import { useDeliveryPlatforms, useMenuItemPlatformPrices } from "@/hooks/useDeliveryPlatforms";
import { usePayments } from "@/hooks/usePayments";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order?: Order | null;
  /** When creating a new delivery order, an optional pre-selected platform. */
  defaultPlatformId?: string | null;
}

export const DeliveryOrderDialog = ({ open, onOpenChange, order, defaultPlatformId }: Props) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { data: platforms = [] } = useDeliveryPlatforms();
  const { data: menuItems = [] } = useMenuItems();
  const { createDeliveryOrder, updateDeliveryStatus, addItem, removeItem, cancelOrder } = useOrders();
  const { createPayment } = usePayments();

  const isNew = !order;
  const platformId = order?.delivery_platform_id ?? defaultPlatformId ?? platforms[0]?.id ?? "";
  const platform = platforms.find((p) => p.id === platformId);
  const { data: platformPrices = [] } = useMenuItemPlatformPrices(platformId || null);
  const priceMap = useMemo(() => {
    const m = new Map<string, { price: number; is_available: boolean }>();
    platformPrices.forEach((p) => m.set(p.menu_item_id, { price: Number(p.price), is_available: p.is_available }));
    return m;
  }, [platformPrices]);

  const [selPlatform, setSelPlatform] = useState(platformId);
  const [externalRef, setExternalRef] = useState(order?.external_ref ?? "");
  const [paying, setPaying] = useState(false);
  const [search, setSearch] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSide, setCancelSide] = useState<"platform" | "internal">("platform");


  useEffect(() => {
    if (open) {
      setSelPlatform(order?.delivery_platform_id ?? defaultPlatformId ?? platforms[0]?.id ?? "");
      setExternalRef(order?.external_ref ?? "");
      setSearch("");
    }
  }, [open, order?.id, defaultPlatformId, platforms]);

  const items = order?.order_items ?? [];
  const grossTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const commissionPct = platform?.commission_pct ?? 0;
  const commission = (grossTotal * commissionPct) / 100;
  const net = grossTotal - commission;

  const handleCreate = async () => {
    if (!selPlatform) {
      toast({ title: language === "es" ? "Selecciona una plataforma" : "Select a platform", variant: "destructive" });
      return;
    }
    try {
      await createDeliveryOrder({ delivery_platform_id: selPlatform, external_ref: externalRef.trim() || null });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: e?.message ?? "Error", variant: "destructive" });
    }
  };

  const handleAdd = (menuItemId: string) => {
    if (!order) return;
    const mi = menuItems.find((m) => m.id === menuItemId);
    if (!mi) return;
    const override = priceMap.get(menuItemId);
    const unit_price = override ? override.price : getEffectivePrice(mi);
    addItem.mutate({ order_id: order.id, menu_item_id: menuItemId, quantity: 1, unit_price });
  };

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuItems
      .filter((m) => m.is_available !== false)
      .filter((m) => {
        const platformInfo = priceMap.get(m.id);
        // If a platform menu exists for this item, respect its availability flag.
        if (platformInfo && !platformInfo.is_available) return false;
        return true;
      })
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.name_en ?? "").toLowerCase().includes(q));
  }, [menuItems, priceMap, search]);

  const handleMarkReady = () => {
    if (!order) return;
    updateDeliveryStatus.mutate({ id: order.id, delivery_status: "ready" });
  };

  const handleMarkDelivered = async () => {
    if (!order || !platform) return;
    setPaying(true);
    try {
      await createPayment.mutateAsync({
        order_id: order.id,
        parts: [{
          amount: grossTotal,
          tip: 0,
          payment_method: "delivery",
          delivery_platform_id: platform.id,
        }],
      });
      await updateDeliveryStatus.mutateAsync({ id: order.id, delivery_status: "delivered" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: e?.message ?? "Error", variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    const txt = cancelReason.trim();
    if (!txt) {
      toast({ title: language === "es" ? "Indica un motivo" : "Provide a reason", variant: "destructive" });
      return;
    }
    const prefix = cancelSide === "platform"
      ? (language === "es" ? "Cancelada por plataforma" : "Cancelled by platform")
      : (language === "es" ? "Cancelada internamente" : "Cancelled internally");
    try {
      await cancelOrder.mutateAsync({ id: order.id, reason: `[${prefix}] ${txt}` });
      toast({ title: language === "es" ? "Delivery cancelado" : "Delivery cancelled" });
      setCancelOpen(false);
      setCancelReason("");
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: e?.message ?? "Error", variant: "destructive" });
    }
  };


  const statusLabel = (s?: string | null) => {
    if (s === "accepted") return language === "es" ? "Aceptada" : "Accepted";
    if (s === "ready") return language === "es" ? "Lista" : "Ready";
    if (s === "delivered") return language === "es" ? "Entregada" : "Delivered";
    return s ?? "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bike className="h-4 w-4 text-primary" />
            {isNew
              ? language === "es" ? "Nueva orden de delivery" : "New delivery order"
              : `${platform?.name ?? "Delivery"} · ${order?.external_ref ?? order?.id.slice(0, 6)}`}
            {order?.delivery_status && (
              <Badge variant="outline" className="ml-2">{statusLabel(order.delivery_status)}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isNew ? (
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{language === "es" ? "Plataforma" : "Platform"}</Label>
              <Select value={selPlatform} onValueChange={setSelPlatform}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {platforms.filter((p) => p.is_active).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.commission_pct}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{language === "es" ? "Referencia externa (opcional)" : "External reference (optional)"}</Label>
              <Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="RAPPI-12345" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleCreate} disabled={!selPlatform || platforms.length === 0}>
                {language === "es" ? "Crear orden" : "Create order"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {/* Items list */}
            <div className="rounded-md border divide-y max-h-48 overflow-auto">
              {items.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {language === "es" ? "Sin items" : "No items"}
                </div>
              ) : items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                  <Badge variant="secondary" className="shrink-0 w-7 justify-center">{it.quantity}×</Badge>
                  <span className="flex-1 truncate">{language === "es" ? it.menu_item?.name : (it.menu_item?.name_en || it.menu_item?.name)}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">${(it.quantity * it.unit_price).toFixed(0)}</span>
                  {order?.delivery_status === "accepted" && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => removeItem.mutate({ id: it.id, order_id: order.id })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Add items (only while accepted) */}
            {order?.delivery_status === "accepted" && (
              <div className="space-y-2">
                <Input
                  placeholder={language === "es" ? "Buscar item…" : "Search item…"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9"
                />
                <ScrollArea className="h-56 rounded-md border">
                  <div className="divide-y">
                    {filteredMenu.map((m) => {
                      const override = priceMap.get(m.id);
                      const unit = override ? override.price : getEffectivePrice(m);
                      const hasOverride = !!override;
                      return (
                        <button
                          key={m.id}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-accent text-left"
                          onClick={() => handleAdd(m.id)}
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="flex-1 truncate">{language === "es" ? m.name : (m.name_en || m.name)}</span>
                          <span className={cn("tabular-nums text-xs", hasOverride && "text-primary font-medium")}>
                            ${unit.toFixed(0)}
                          </span>
                          {hasOverride && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{platform?.name}</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Separator />

            {/* Totals + commission */}
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">{language === "es" ? "Bruto" : "Gross"}</span><span className="tabular-nums">${grossTotal.toFixed(0)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>{language === "es" ? "Comisión" : "Commission"} ({commissionPct}%)</span><span className="tabular-nums">-${commission.toFixed(0)}</span></div>
              <div className="flex justify-between font-semibold"><span>{language === "es" ? "Neto a recibir" : "Net payout"}</span><span className="tabular-nums">${net.toFixed(0)}</span></div>
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              {order?.delivery_status === "accepted" && items.length > 0 && (
                <Button onClick={handleMarkReady} disabled={updateDeliveryStatus.isPending}>
                  {language === "es" ? "Marcar como lista" : "Mark as ready"}
                </Button>
              )}
              {order?.delivery_status === "ready" && (
                <Button onClick={handleMarkDelivered} disabled={paying}>
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  {language === "es" ? "Marcar como entregada" : "Mark as delivered"}
                </Button>
              )}
              <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
