import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Order, OrderItem, useOrders } from "@/hooks/useOrders";
import { applyLineDiscount } from "@/lib/discounts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, SplitSquareHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  /** Called with the new sub-order id after a successful split. */
  onSplit?: (newOrderId: string) => void;
}

export const SplitOrderDialog = ({ open, onOpenChange, order, onSplit }: Props) => {
  const { t, language } = useLanguage();
  const { splitOrder } = useOrders();
  const { toast } = useToast();
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const items = order.order_items ?? [];

  useEffect(() => {
    if (open) setSelections({});
  }, [open, order.id]);

  const setQty = (item: OrderItem, qty: number) => {
    const clamped = Math.max(0, Math.min(item.quantity, qty));
    setSelections((prev) => {
      const next = { ...prev };
      if (clamped === 0) delete next[item.id];
      else next[item.id] = clamped;
      return next;
    });
  };

  const selectedTotal = useMemo(() => {
    return items.reduce((s, it) => {
      const q = selections[it.id] ?? 0;
      if (!q) return s;
      return s + applyLineDiscount(q * it.unit_price, it.discount ?? 0, it.discount_amount ?? 0);
    }, 0);
  }, [items, selections]);

  const remainingTotal = useMemo(() => {
    return items.reduce((s, it) => {
      const q = it.quantity - (selections[it.id] ?? 0);
      if (q <= 0) return s;
      return s + applyLineDiscount(q * it.unit_price, it.discount ?? 0, it.discount_amount ?? 0);
    }, 0);
  }, [items, selections]);

  const totalSelectedCount = Object.values(selections).reduce((s, v) => s + v, 0);
  const remainingCount = items.reduce(
    (s, it) => s + (it.quantity - (selections[it.id] ?? 0)),
    0,
  );

  const handleSplit = async () => {
    if (totalSelectedCount === 0) {
      toast({ title: t("orders.splitNoItems"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const newId = await splitOrder(
        order,
        Object.entries(selections).map(([item_id, qty]) => ({ item_id, qty })),
      );
      toast({ title: t("common.success"), description: t("orders.splitCreated") });
      onSplit?.(newId);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: t("common.error"), description: e?.message ?? "", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SplitSquareHorizontal className="h-4 w-4" />
            {t("orders.splitOrder")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("orders.splitDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1" data-vaul-no-drag>
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              {t("orders.empty")}
            </p>
          )}
          {items.map((it) => {
            const name = language === "es" ? it.menu_item?.name : it.menu_item?.name_en;
            const q = selections[it.id] ?? 0;
            return (
              <div
                key={it.id}
                className="flex items-center gap-2 rounded border p-2 text-xs bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{name || "—"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {language === "es" ? "Total" : "Total"}: {it.quantity} · ${it.unit_price.toFixed(0)} c/u
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => setQty(it, q - 1)}
                    disabled={q <= 0 || submitting}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-mono text-xs">
                    {q}/{it.quantity}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => setQty(it, q + 1)}
                    disabled={q >= it.quantity || submitting}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t pt-2 space-y-1 text-xs shrink-0">
          <div className="flex justify-between">
            <span>
              <Badge variant="secondary" className="text-[10px] mr-1">
                {t("orders.subOrder")}
              </Badge>
              {totalSelectedCount} {language === "es" ? "items" : "items"}
            </span>
            <span className="font-semibold">${selectedTotal.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>
              <Badge variant="outline" className="text-[10px] mr-1">
                {language === "es" ? "Restante" : "Remaining"}
              </Badge>
              {remainingCount} {language === "es" ? "items" : "items"}
            </span>
            <span>${remainingTotal.toFixed(0)}</span>
          </div>
        </div>

        <DialogFooter className="flex flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            className="flex-1 gap-1.5"
            onClick={handleSplit}
            disabled={totalSelectedCount === 0 || submitting}
          >
            <SplitSquareHorizontal className="h-3.5 w-3.5" />
            {t("orders.split")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
