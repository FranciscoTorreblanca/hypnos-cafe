import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMenuItems, MenuItem } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { useCombos, ComboWithItems } from "@/hooks/useCombos";
import { Order, useOrders } from "@/hooks/useOrders";
import { usePayments } from "@/hooks/usePayments";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Minus, Trash2, Send, Search, UtensilsCrossed, Receipt,
  Banknote, CreditCard, XCircle, MessageSquare, ShoppingCart, Package, Percent,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber: number;
  tableName?: string;
  order: Order | undefined;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
  discount: number;
}

export const OrderDialog = ({ open, onOpenChange, tableNumber, tableName, order }: Props) => {
  const { t, language } = useLanguage();
  const { data: items = [] } = useMenuItems();
  const { data: categories = [] } = useMenuCategories();
  const { data: combos = [] } = useCombos();
  const { createOrder, addItem, removeItem, updateOrderStatus, cancelOrder, updateItemDiscount } = useOrders();
  const { createPayment } = usePayments();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tipAmount, setTipAmount] = useState("0");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingNotes, setEditingNotes] = useState<string | null>(null); // cart menuItem.id
  const [editingExistingNotes, setEditingExistingNotes] = useState<string | null>(null); // order item id
  const [mobileTab, setMobileTab] = useState<"menu" | "order">("menu");

  // Reset cart when dialog opens/closes
  useEffect(() => {
    if (open) {
      setCart([]);
      setSearch("");
      setActiveCategory("all");
      setShowPayment(false);
      setMobileTab("menu");
      setEditingNotes(null);
      setEditingExistingNotes(null);
    }
  }, [open]);

  const availableItems = useMemo(
    () => items.filter((i) => i.is_available),
    [items]
  );

  const availableCombos = useMemo(
    () => combos.filter((c) => c.is_available),
    [combos]
  );

  const filtered = useMemo(() => {
    if (activeCategory === "combos") return [];
    const q = search.toLowerCase();
    return availableItems.filter((i) => {
      const matchesSearch = !q || i.name.toLowerCase().includes(q) || i.name_en.toLowerCase().includes(q);
      const matchesCat = activeCategory === "all" || i.category_id === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [availableItems, search, activeCategory]);

  const filteredCombos = useMemo(() => {
    if (activeCategory !== "combos" && activeCategory !== "all") return [];
    const q = search.toLowerCase();
    return availableCombos.filter((c) => {
      return !q || c.name.toLowerCase().includes(q) || c.name_en.toLowerCase().includes(q);
    });
  }, [availableCombos, search, activeCategory]);

  const cartTotal = useMemo(
    () => cart.reduce((s, c) => s + c.menuItem.price * c.quantity * (1 - (c.discount ?? 0) / 100), 0),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((s, c) => s + c.quantity, 0),
    [cart]
  );

  const addToCart = useCallback((menuItem: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItem.id === menuItem.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem, quantity: 1, notes: "", discount: 0 }];
    });
  }, []);

  const addComboToCart = useCallback((combo: ComboWithItems) => {
    // Add each fixed item from the combo to the cart
    combo.combo_items.forEach((ci) => {
      const menuItem = items.find((i) => i.id === ci.menu_item_id);
      if (!menuItem) return;
      // Use combo proportional price: combo.price split across items by their original price weight
      const totalOriginalPrice = combo.combo_items.reduce((sum, item) => {
        const mi = items.find((i) => i.id === item.menu_item_id);
        return sum + (mi?.price ?? 0) * item.quantity;
      }, 0);
      const itemPrice = totalOriginalPrice > 0
        ? Math.round((menuItem.price / totalOriginalPrice) * combo.price * 100) / 100
        : combo.price / combo.combo_items.length;

      const comboMenuItem: MenuItem = {
        ...menuItem,
        price: itemPrice,
        name: `${menuItem.name} (${combo.name})`,
        name_en: `${menuItem.name_en || menuItem.name} (${combo.name_en || combo.name})`,
      };

      setCart((prev) => [...prev, { menuItem: comboMenuItem, quantity: ci.quantity, notes: "", discount: 0 }]);
    });
  }, [items]);

  const updateCartQty = useCallback((menuItemId: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((c) =>
        c.menuItem.id === menuItemId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c
      ).filter((c) => c.quantity > 0);
      return updated;
    });
  }, []);

  const updateCartNotes = useCallback((menuItemId: string, notes: string) => {
    setCart((prev) =>
      prev.map((c) => (c.menuItem.id === menuItemId ? { ...c, notes } : c))
    );
  }, []);

  const updateCartDiscount = useCallback((menuItemId: string, discount: number) => {
    setCart((prev) =>
      prev.map((c) => (c.menuItem.id === menuItemId ? { ...c, discount: Math.min(100, Math.max(0, discount)) } : c))
    );
  }, []);

  const removeFromCart = useCallback((menuItemId: string) => {
    setCart((prev) => prev.filter((c) => c.menuItem.id !== menuItemId));
  }, []);

  const handleSubmitCart = async () => {
    if (cart.length === 0) return;
    let orderId = order?.id;
    if (!orderId) {
      const newOrder = await createOrder.mutateAsync(tableNumber);
      orderId = newOrder.id;
    }
    for (const c of cart) {
      await addItem.mutateAsync({
        order_id: orderId,
        menu_item_id: c.menuItem.id,
        quantity: c.quantity,
        unit_price: c.menuItem.price,
        notes: c.notes || undefined,
        discount: c.discount || 0,
      });
    }
    toast({ title: t("common.success"), description: `${cartCount} ${t("orders.itemsAdded")}` });
    setCart([]);
    if (isMobile) setMobileTab("order");
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

  const getName = (item: { name?: string; name_en?: string }) =>
    language === "es" ? item.name : item.name_en;

  const orderItems = order?.order_items ?? [];
  const canAddItems = !order || order.status === "pending" || order.status === "in_progress";
  const canSendToKitchen = order?.status === "pending" && orderItems.length > 0;
  const canMarkServed = order?.status === "ready";
  const canPay = order?.status === "served";
  const isOwnOrder = order?.created_by === user?.id;
  const canCancelOrder = order && (isAdmin || (isOwnOrder && ["pending", "in_progress"].includes(order.status)));
  const canDeleteItem = (itemStatus: string) =>
    isAdmin || (isOwnOrder && canAddItems && itemStatus === "pending");

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

  // ─── Menu picker section ───
  const menuPicker = (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
          autoFocus={!isMobile}
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-2 shrink-0" data-vaul-no-drag>
        <Button
          variant={activeCategory === "all" ? "default" : "outline"}
          size="sm"
          className="h-6 text-[11px] px-2 shrink-0 rounded-full"
          onClick={() => setActiveCategory("all")}
        >
          {language === "es" ? "Todos" : "All"}
        </Button>
        {categories.map((c) => (
          <Button
            key={c.id}
            variant={activeCategory === c.id ? "default" : "outline"}
            size="sm"
            className="h-6 text-[11px] px-2 shrink-0 rounded-full"
            onClick={() => setActiveCategory(c.id)}
          >
            {getName(c)}
          </Button>
        ))}
        {availableCombos.length > 0 && (
          <Button
            variant={activeCategory === "combos" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[11px] px-2 shrink-0 rounded-full"
            onClick={() => setActiveCategory("combos")}
          >
            <Package className="h-3 w-3 mr-1" />
            {language === "es" ? "Combos" : "Combos"}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" data-vaul-no-drag>
        <div className="space-y-0.5 pr-1">
          {/* Combos */}
          {filteredCombos.map((combo) => (
            <button
              key={`combo-${combo.id}`}
              onClick={() => addComboToCart(combo)}
              className="w-full flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 p-2 hover:bg-primary/10 active:bg-primary/15 transition-colors text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate flex items-center gap-1">
                  <Package className="h-3 w-3 text-primary shrink-0" />
                  {getName(combo)}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {combo.combo_items.map((ci) => ci.menu_items?.name).filter(Boolean).join(" + ")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-semibold text-primary">${combo.price.toFixed(0)}</span>
                <Plus className="h-4 w-4 text-primary" />
              </div>
            </button>
          ))}
          {filtered.map((item) => {
            const inCart = cart.find((c) => c.menuItem.id === item.id);
            return (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="w-full flex items-center justify-between rounded-md border p-2 hover:bg-accent active:bg-accent/80 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{getName(item)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {inCart && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-[20px] justify-center">
                      {inCart.quantity}
                    </Badge>
                  )}
                  <span className="text-sm font-semibold">${item.price.toFixed(0)}</span>
                  <Plus className="h-4 w-4 text-primary" />
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && filteredCombos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("common.noResults")}</p>
          )}
        </div>
      </div>
    </div>
  );

  // ─── Cart section (new items to add) ───
  const cartSection = cart.length > 0 && (
    <div className="border rounded-md p-2 space-y-1.5 bg-muted/30">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1">
          <ShoppingCart className="h-3 w-3" /> {t("orders.newItems")} ({cartCount})
        </h4>
        <span className="text-xs font-semibold">${cartTotal.toFixed(0)}</span>
      </div>
      {cart.map((c) => (
        <div key={c.menuItem.id} className="space-y-1">
          <div className="flex items-center gap-1 text-sm">
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartQty(c.menuItem.id, -1)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-5 text-center text-xs font-medium">{c.quantity}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartQty(c.menuItem.id, 1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <span className="flex-1 truncate text-xs">{getName(c.menuItem)}</span>
            {c.discount > 0 && (
              <span className="text-[10px] text-emerald-600 font-medium">-{c.discount}%</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setEditingNotes(editingNotes === c.menuItem.id ? null : c.menuItem.id)}
            >
              <MessageSquare className={`h-3 w-3 ${c.notes ? "text-primary" : "text-muted-foreground"}`} />
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setEditingNotes(editingNotes === `disc-${c.menuItem.id}` ? null : `disc-${c.menuItem.id}`)}
              >
                <Percent className={`h-3 w-3 ${c.discount > 0 ? "text-emerald-600" : "text-muted-foreground"}`} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-destructive"
              onClick={() => removeFromCart(c.menuItem.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          {editingNotes === `disc-${c.menuItem.id}` && isAdmin && (
            <div className="flex items-center gap-1.5 ml-1">
              <Percent className="h-3 w-3 text-muted-foreground shrink-0" />
              <Input
                type="number"
                min="0"
                max="100"
                value={c.discount || ""}
                placeholder="0"
                onChange={(e) => updateCartDiscount(c.menuItem.id, parseInt(e.target.value) || 0)}
                className="h-7 w-20 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          )}
          {editingNotes === c.menuItem.id && (
            <Textarea
              placeholder={t("orders.itemNotes")}
              value={c.notes}
              onChange={(e) => updateCartNotes(c.menuItem.id, e.target.value)}
              className="min-h-[40px] text-xs resize-none"
              rows={1}
            />
          )}
          {c.notes && editingNotes !== c.menuItem.id && (
            <p className="text-[10px] text-muted-foreground italic ml-1">📝 {c.notes}</p>
          )}
        </div>
      ))}
      <Button size="sm" className="w-full gap-1 h-8" onClick={handleSubmitCart} disabled={addItem.isPending || createOrder.isPending}>
        <Plus className="h-3 w-3" /> {t("orders.addToOrder")}
      </Button>
    </div>
  );

  // ─── Current order section ───
  const orderSection = (
    <div className="flex flex-col min-h-0 flex-1">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        {t("orders.currentOrder")}
        {order && <Badge variant="outline" className="text-[10px]">{statusLabel[order.status] ?? order.status}</Badge>}
      </h3>
      {orderItems.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("orders.empty")}</p>
      ) : (
        <div className="flex-1 overflow-y-auto" data-vaul-no-drag>
          <div className="space-y-1.5 pr-1">
            {orderItems.map((oi) => {
              const discountPct = (oi as any).discount ?? 0;
              const lineTotal = oi.quantity * oi.unit_price * (1 - discountPct / 100);
              return (
              <div key={oi.id} className="space-y-0.5">
                <div className="flex items-center justify-between text-sm gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="truncate text-xs">
                        {oi.quantity}x {getName(oi.menu_item)}
                      </p>
                      {discountPct > 0 && (
                        <span className="text-[10px] text-emerald-600 font-medium shrink-0">-{discountPct}%</span>
                      )}
                      {order && order.status !== "pending" && itemStatusBadge(oi.status)}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {discountPct > 0 ? (
                        <><span className="line-through">${(oi.quantity * oi.unit_price).toFixed(0)}</span> <span className="text-emerald-600">${lineTotal.toFixed(0)}</span></>
                      ) : (
                        <>${(oi.quantity * oi.unit_price).toFixed(0)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setEditingExistingNotes(editingExistingNotes === `disc-${oi.id}` ? null : `disc-${oi.id}`)}
                      >
                        <Percent className={`h-3 w-3 ${discountPct > 0 ? "text-emerald-600" : "text-muted-foreground"}`} />
                      </Button>
                    )}
                    {canDeleteItem(oi.status) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveItem(oi.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {editingExistingNotes === `disc-${oi.id}` && isAdmin && order && (
                  <div className="flex items-center gap-1.5 ml-1">
                    <Percent className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={discountPct || ""}
                      placeholder="0"
                      onBlur={(e) => {
                        const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                        updateItemDiscount.mutate({ id: oi.id, discount: val, order_id: order.id });
                        setEditingExistingNotes(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="h-7 w-20 text-xs"
                      autoFocus
                    />
                    <span className="text-[10px] text-muted-foreground">%</span>
                  </div>
                )}
                {oi.notes && (
                  <p className="text-[10px] text-muted-foreground italic ml-1">📝 {oi.notes}</p>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {orderItems.length > 0 && (
        <div className="mt-auto pt-2 border-t space-y-1.5">
          <div className="flex justify-between font-semibold text-sm">
            <span>Total</span>
            <span>${(order?.total ?? 0).toFixed(0)} MXN</span>
          </div>
          {canSendToKitchen && (
            <Button className="w-full gap-1.5" size="sm" onClick={handleSendToKitchen}>
              <Send className="h-3.5 w-3.5" /> {t("orders.sendToKitchen")}
            </Button>
          )}
          {order?.status === "in_progress" && orderItems.some((oi) => oi.status === "pending") && (
            <Button className="w-full gap-1.5" size="sm" onClick={handleSendToKitchen} variant="outline">
              <Send className="h-3.5 w-3.5" /> {t("orders.sendNewItems")}
            </Button>
          )}
          {canMarkServed && (
            <Button className="w-full gap-1.5" size="sm" onClick={handleMarkServed}>
              <UtensilsCrossed className="h-3.5 w-3.5" /> {t("orders.markServed")}
            </Button>
          )}
          {canPay && (
            <Button className="w-full gap-1.5" size="sm" onClick={() => setShowPayment(true)}>
              <Receipt className="h-3.5 w-3.5" /> {t("billing.payNow")}
            </Button>
          )}
          {canCancelOrder && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-1.5" size="sm">
                  <XCircle className="h-3.5 w-3.5" /> {t("orders.cancelOrder")}
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
  );

  // ─── Payment view ───
  const paymentView = (
    <div className="space-y-4 p-1">
      <div className="space-y-1">
        {orderItems.map((oi) => {
          const disc = (oi as any).discount ?? 0;
          const lineTotal = oi.quantity * oi.unit_price * (1 - disc / 100);
          return (
            <div key={oi.id} className="flex justify-between text-sm">
              <span>{oi.quantity}x {getName(oi.menu_item)} {disc > 0 && <span className="text-emerald-600 text-xs">(-{disc}%)</span>}</span>
              <span className="text-muted-foreground">${lineTotal.toFixed(0)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-sm border-t pt-2">
        <span>{t("billing.subtotal")}</span>
        <span className="font-semibold">${order?.total.toFixed(0)} MXN</span>
      </div>
      <div className="space-y-2">
        <Label>{t("billing.tip")}</Label>
        <div className="flex gap-2">
          {[0, 10, 15, 20].map((pct) => {
            const val = Math.round((order?.total ?? 0) * pct / 100);
            return (
              <Button key={pct} type="button" variant={tipAmount === String(val) && pct > 0 ? "default" : "outline"} size="sm" onClick={() => setTipAmount(String(val))}>
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
            <Label htmlFor="pay-cash" className="flex items-center gap-1 cursor-pointer"><Banknote className="h-4 w-4" /> {t("billing.cash")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="card" id="pay-card" />
            <Label htmlFor="pay-card" className="flex items-center gap-1 cursor-pointer"><CreditCard className="h-4 w-4" /> {t("billing.card")}</Label>
          </div>
        </RadioGroup>
      </div>
      <div className="flex justify-between font-bold border-t pt-2">
        <span>{t("billing.total")}</span>
        <span>${((order?.total ?? 0) + (parseFloat(tipAmount) || 0)).toFixed(0)} MXN</span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setShowPayment(false)}>{t("common.back")}</Button>
        <Button className="flex-1" onClick={handleConfirmPayment} disabled={createPayment.isPending}>{t("billing.confirmPayment")}</Button>
      </div>
    </div>
  );

  // ─── Title ───
  const displayName = tableName || `${t("tables.title")} ${tableNumber}`;
  const title = `${displayName} — ${showPayment ? t("billing.confirmPayment") : t("orders.order")}`;

  // ─── MOBILE: Drawer ───
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] flex flex-col overflow-hidden">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2 text-base">
              {title}
              {order && !showPayment && (
                <Badge variant="outline" className="text-[10px]">{statusLabel[order.status] ?? order.status}</Badge>
              )}
            </DrawerTitle>
          </DrawerHeader>

          {showPayment && order ? (
            <div className="flex-1 overflow-y-auto px-4 pb-4" data-vaul-no-drag>{paymentView}</div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 px-4 pb-4">
              {/* Mobile tab toggle */}
              {canAddItems && (
                <div className="flex gap-1 mb-2">
                  <Button
                    variant={mobileTab === "menu" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => setMobileTab("menu")}
                  >
                    {t("nav.menu")}
                    {cartCount > 0 && (
                      <Badge className="ml-1 bg-primary-foreground text-primary text-[10px] h-4 min-w-[16px] justify-center">
                        {cartCount}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    variant={mobileTab === "order" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => setMobileTab("order")}
                  >
                    {t("orders.order")} ({orderItems.length})
                  </Button>
                </div>
              )}

              {mobileTab === "menu" && canAddItems ? (
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {menuPicker}
                  <div className="overflow-y-auto shrink-0 max-h-[40%]" data-vaul-no-drag>
                    {cartSection}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-hidden">
                  {orderSection}
                </div>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  // ─── DESKTOP: Dialog ───
  if (showPayment && order) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) setShowPayment(false); onOpenChange(v); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {paymentView}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            {order && <Badge variant="outline" className="text-xs">{statusLabel[order.status] ?? order.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0">
          {canAddItems && (
            <div className="flex-1 flex flex-col min-h-0">
              {menuPicker}
              {cartSection}
            </div>
          )}
          <div className={`flex flex-col ${canAddItems ? "w-64 border-l pl-4" : "flex-1"}`}>
            {orderSection}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
