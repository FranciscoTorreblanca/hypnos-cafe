import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMenuItems, MenuItem } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { Order, useOrders } from "@/hooks/useOrders";
import { usePayments } from "@/hooks/usePayments";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Send, Search, UtensilsCrossed, Receipt, Banknote, CreditCard, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const { createOrder, addItem, removeItem, updateOrderStatus, cancelOrder } = useOrders();
  const { createPayment } = usePayments();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tipAmount, setTipAmount] = useState("0");

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
  };

  const handleMarkServed = async () => {
    if (!order) return;
    await updateOrderStatus.mutateAsync({ id: order.id, status: "served" });
    toast({ title: t("common.success"), description: t("orders.markServed") });
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    await cancelOrder.mutateAsync(order.id);
    toast({ title: t("common.success"), description: t("orders.orderCancelled") });
    onOpenChange(false);
  };

  const handleConfirmPayment = async () => {
    if (!order) return;
    try {
      await createPayment.mutateAsync({
        order_id: order.id,
        amount: order.total,
        tip: parseFloat(tipAmount) || 0,
        payment_method: paymentMethod,
      });
      toast({ title: t("common.success"), description: t("billing.paymentSuccess") });
      setShowPayment(false);
      setTipAmount("0");
      onOpenChange(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const getCatName = (id: string | null) => {
    if (!id) return "";
    const cat = categories.find((c) => c.id === id);
    return cat ? (language === "es" ? cat.name : cat.name_en) : "";
  };

  const orderItems = order?.order_items ?? [];
  // Allow adding items when pending or in_progress (kitchen already working)
  const canAddItems = !order || order.status === "pending" || order.status === "in_progress";
  const canSendToKitchen = order?.status === "pending" && orderItems.length > 0;
  const canMarkServed = order?.status === "ready";
  const canPay = order?.status === "served";
  const isOwnOrder = order?.created_by === user?.id;
  // Waiters can cancel their own orders that aren't ready/served/paid; admins can cancel any order anytime
  const canCancelOrder = order && (
    isAdmin || (isOwnOrder && ["pending", "in_progress"].includes(order.status))
  );
  // Waiter can delete pending items on their own order; admin can delete any item anytime
  const canDeleteItem = (itemStatus: string) =>
    isAdmin || (isOwnOrder && canAddItems && itemStatus === "pending");

  // Per-item status indicators
  const itemStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: t("orders.pending"), className: "bg-amber-100 text-amber-800 border-amber-200" },
      in_progress: { label: t("orders.inProgress"), className: "bg-blue-100 text-blue-800 border-blue-200" },
      ready: { label: t("orders.ready"), className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    };
    const s = map[status] ?? map.pending;
    return <Badge variant="outline" className={`text-[10px] ${s.className}`}>{s.label}</Badge>;
  };

  const statusLabel: Record<string, string> = {
    pending: t("orders.pending"),
    in_progress: t("orders.inProgress"),
    ready: t("orders.ready"),
    served: t("orders.served"),
    paid: t("orders.paid"),
  };

  // Payment view
  if (showPayment && order) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) setShowPayment(false); onOpenChange(v); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("billing.confirmPayment")} — {t("tables.title")} {tableNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              {orderItems.map((oi) => (
                <div key={oi.id} className="flex justify-between text-sm">
                  <span>{oi.quantity}x {language === "es" ? oi.menu_item?.name : oi.menu_item?.name_en}</span>
                  <span className="text-muted-foreground">${(oi.quantity * oi.unit_price).toFixed(0)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span>{t("billing.subtotal")}</span>
              <span className="font-semibold">${order.total.toFixed(0)} MXN</span>
            </div>

            <div className="space-y-2">
              <Label>{t("billing.tip")}</Label>
              <div className="flex gap-2">
                {[0, 10, 15, 20].map((pct) => {
                  const val = Math.round(order.total * pct / 100);
                  return (
                    <Button
                      key={pct}
                      type="button"
                      variant={tipAmount === String(val) && pct > 0 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTipAmount(String(val))}
                    >
                      {pct === 0 ? "$0" : `${pct}%`}
                    </Button>
                  );
                })}
              </div>
              <Input type="number" min="0" value={tipAmount} onChange={(e) => setTipAmount(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>{t("billing.paymentMethod")}</Label>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="cash" id="pay-cash" />
                  <Label htmlFor="pay-cash" className="flex items-center gap-1 cursor-pointer">
                    <Banknote className="h-4 w-4" /> {t("billing.cash")}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="card" id="pay-card" />
                  <Label htmlFor="pay-card" className="flex items-center gap-1 cursor-pointer">
                    <CreditCard className="h-4 w-4" /> {t("billing.card")}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-between font-bold border-t pt-2">
              <span>{t("billing.total")}</span>
              <span>${(order.total + (parseFloat(tipAmount) || 0)).toFixed(0)} MXN</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPayment(false)}>
                {t("common.back")}
              </Button>
              <Button className="flex-1" onClick={handleConfirmPayment} disabled={createPayment.isPending}>
                {t("billing.confirmPayment")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
          {/* Menu items picker */}
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
                    <div key={oi.id} className="flex items-center justify-between text-sm gap-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="truncate">
                            {oi.quantity}x {language === "es" ? oi.menu_item?.name : oi.menu_item?.name_en}
                          </p>
                          {order && order.status !== "pending" && itemStatusBadge(oi.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">${(oi.quantity * oi.unit_price).toFixed(0)}</p>
                      </div>
                      {canDeleteItem(oi.status) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
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
                {order?.status === "in_progress" && orderItems.some((oi) => oi.status === "pending") && (
                  <Button className="w-full gap-2" size="sm" onClick={handleSendToKitchen} variant="outline">
                    <Send className="h-4 w-4" />
                    {t("orders.sendNewItems")}
                  </Button>
                )}
                {canMarkServed && (
                  <Button className="w-full gap-2" size="sm" onClick={handleMarkServed}>
                    <UtensilsCrossed className="h-4 w-4" />
                    {t("orders.markServed")}
                  </Button>
                )}
                {canPay && (
                  <Button className="w-full gap-2" size="sm" onClick={() => setShowPayment(true)}>
                    <Receipt className="h-4 w-4" />
                    {t("billing.payNow")}
                  </Button>
                )}
                {canCancelOrder && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full gap-2" size="sm">
                        <XCircle className="h-4 w-4" />
                        {t("orders.cancelOrder")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("orders.cancelOrder")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("orders.cancelConfirm")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelOrder}>{t("common.confirm")}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
