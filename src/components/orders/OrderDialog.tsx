import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMenuItems, MenuItem } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { Order, useOrders } from "@/hooks/useOrders";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Send, Search, UtensilsCrossed, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber: number;
  order: Order | undefined;
}

export const OrderDialog = ({ open, onOpenChange, tableNumber, order }: Props) => {
  const { t, language } = useLanguage();
  const { data: items = [] } = useMenuItems();
  const { data: categories = [] } = useMenuCategories();
  const { createOrder, addItem, removeItem, updateOrderStatus } = useOrders();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const availableItems = items.filter((i) => i.is_available);
  const filtered = availableItems.filter((i) => {
    const matchesSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.name_en.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === "all" || i.category_id === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleAddItem = async (menuItem: MenuItem) => {
    let orderId = order?.id;
    if (!orderId) {
      const newOrder = await createOrder.mutateAsync(tableNumber);
      orderId = newOrder.id;
    }
    await addItem.mutateAsync({
      order_id: orderId,
      menu_item_id: menuItem.id,
      quantity: 1,
      unit_price: menuItem.price,
    });
    toast({ title: t("common.success"), description: `${language === "es" ? menuItem.name : menuItem.name_en} ${t("orders.added")}` });
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!order) return;
    await removeItem.mutateAsync({ id: itemId, order_id: order.id });
  };

  const handleSendToKitchen = async () => {
    if (!order) return;
    await updateOrderStatus.mutateAsync({ id: order.id, status: "in_progress" });
    toast({ title: t("common.success"), description: t("orders.sentToKitchen") });
    onOpenChange(false);
  };

  const handleMarkServed = async () => {
    if (!order) return;
    await updateOrderStatus.mutateAsync({ id: order.id, status: "served" });
    toast({ title: t("common.success"), description: t("orders.markServed") });
    onOpenChange(false);
  };

  const getCatName = (id: string | null) => {
    if (!id) return "";
    const cat = categories.find((c) => c.id === id);
    return cat ? (language === "es" ? cat.name : cat.name_en) : "";
  };

  const orderItems = order?.order_items ?? [];
  const canAddItems = !order || order.status === "pending";
  const canSendToKitchen = order?.status === "pending" && orderItems.length > 0;
  const canMarkServed = order?.status === "ready";

  const statusLabel: Record<string, string> = {
    pending: t("orders.pending"),
    in_progress: t("orders.inProgress"),
    ready: t("orders.ready"),
    served: t("orders.served"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>
              {t("tables.title")} {tableNumber} — {t("orders.order")}
            </DialogTitle>
            {order && (
              <Badge variant="outline" className="text-xs">
                {statusLabel[order.status] ?? order.status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
          {/* Menu items picker - only if can add items */}
          {canAddItems && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("common.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                <TabsList className="w-full flex-wrap h-auto">
                  <TabsTrigger value="all" className="text-xs">{language === "es" ? "Todos" : "All"}</TabsTrigger>
                  {categories.map((c) => (
                    <TabsTrigger key={c.id} value={c.id} className="text-xs">
                      {language === "es" ? c.name : c.name_en}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <ScrollArea className="flex-1 mt-2 max-h-[40vh]">
                <div className="space-y-1 pr-2">
                  {filtered.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddItem(item)}
                      className="w-full flex items-center justify-between rounded-md border p-2 hover:bg-accent transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium">{language === "es" ? item.name : item.name_en}</p>
                        <p className="text-xs text-muted-foreground">{getCatName(item.category_id)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">${item.price.toFixed(0)}</span>
                        <Plus className="h-4 w-4 text-primary" />
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">{t("common.noResults")}</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Current order */}
          <div className={`flex flex-col ${canAddItems ? "w-full md:w-64 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4" : "flex-1"}`}>
            <h3 className="text-sm font-semibold mb-2">{t("orders.currentOrder")}</h3>
            {orderItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("orders.empty")}</p>
            ) : (
              <ScrollArea className="flex-1 max-h-[40vh]">
                <div className="space-y-2 pr-2">
                  {orderItems.map((oi) => (
                    <div key={oi.id} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="truncate">
                          {oi.quantity}x {language === "es" ? oi.menu_item?.name : oi.menu_item?.name_en}
                        </p>
                        <p className="text-xs text-muted-foreground">${(oi.quantity * oi.unit_price).toFixed(0)}</p>
                      </div>
                      {canAddItems && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleRemoveItem(oi.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {orderItems.length > 0 && (
              <div className="mt-auto pt-3 border-t space-y-2">
                <div className="flex justify-between font-semibold text-sm">
                  <span>Total</span>
                  <span>${(order?.total ?? 0).toFixed(0)} MXN</span>
                </div>
                {canSendToKitchen && (
                  <Button className="w-full gap-2" size="sm" onClick={handleSendToKitchen}>
                    <Send className="h-4 w-4" />
                    {t("orders.sendToKitchen")}
                  </Button>
                )}
                {canMarkServed && (
                  <Button className="w-full gap-2" size="sm" onClick={handleMarkServed}>
                    <UtensilsCrossed className="h-4 w-4" />
                    {t("orders.markServed")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
