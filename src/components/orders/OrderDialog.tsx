import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { groupOrderItems } from "@/utils/groupOrderItems";
import { useMenuItems, MenuItem, getEffectivePrice } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { useCombos, ComboWithItems } from "@/hooks/useCombos";
import { Order, useOrders } from "@/hooks/useOrders";
import { usePayments } from "@/hooks/usePayments";
import { useTickets, Ticket } from "@/hooks/useTickets";
import { PrintTicketDialog } from "@/components/tickets/PrintTicketDialog";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTableNames } from "@/hooks/useTableNames";
import { supabase } from "@/integrations/supabase/client";
import { applyLineDiscount, applyGeneralDiscount } from "@/lib/discounts";
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
  Banknote, CreditCard, XCircle, MessageSquare, ShoppingCart, Package, Percent, DollarSign, Pencil, CheckCircle, Clock, Printer,
} from "lucide-react";
import { ComboChoiceDialog } from "@/components/orders/ComboChoiceDialog";
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
  discountAmount: number;
  comboId?: string;
  comboGroupId?: string;
}

export const OrderDialog = ({ open, onOpenChange, tableNumber, tableName, order }: Props) => {
  const { t, language } = useLanguage();
  const { data: items = [] } = useMenuItems();
  const { data: categories = [] } = useMenuCategories();
  const { data: combos = [] } = useCombos();
  const { createOrder, addItemsBulk, removeItem, updateOrderStatus, cancelOrder, updateItemDiscount, updateItemDiscountAmount, updateItemStatus, updateGeneralDiscount, updateGeneralDiscountAmount } = useOrders();
  const { createPayment } = usePayments();
  const { createTicket } = useTickets();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const searchRef = useRef<HTMLInputElement>(null);
  const { tableNames, updateNames } = useTableNames();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tipAmount, setTipAmount] = useState("0");
  const [cashDenoms, setCashDenoms] = useState<Record<number, number>>({});
  const [cashManual, setCashManual] = useState("");
  const cashReceived = Object.entries(cashDenoms).reduce((sum, [d, count]) => sum + Number(d) * count, 0) + (parseFloat(cashManual) || 0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingExistingNotes, setEditingExistingNotes] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"menu" | "order">("menu");
  const [editingTableName, setEditingTableName] = useState(false);
  const [localTableName, setLocalTableName] = useState("");
  const [comboChoiceOpen, setComboChoiceOpen] = useState(false);
  const [prePaymentTicket, setPrePaymentTicket] = useState<Ticket | null>(null);
  const [prePaymentOpen, setPrePaymentOpen] = useState(false);
  const [selectedCombo, setSelectedCombo] = useState<ComboWithItems | null>(null);
  const [editingGeneralDiscount, setEditingGeneralDiscount] = useState(false);

  const dismissMobileKeyboard = useCallback(() => {
    if (!isMobile) return;
    searchRef.current?.blur();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.setTimeout(() => window.scrollTo(0, 0), 50);
    window.setTimeout(() => window.scrollTo(0, 0), 250);
  }, [isMobile]);

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
      setEditingTableName(false);
      setLocalTableName(tableName || "");
    }
  }, [open, tableName]);

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
    () => cart.reduce((s, c) => {
      const gross = getEffectivePrice(c.menuItem) * c.quantity;
      const afterPct = gross * (1 - (c.discount ?? 0) / 100);
      return s + Math.max(0, afterPct - (c.discountAmount ?? 0));
    }, 0),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((s, c) => s + c.quantity, 0),
    [cart]
  );

  const addToCart = useCallback((menuItem: MenuItem) => {
    dismissMobileKeyboard();
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItem.id === menuItem.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem, quantity: 1, notes: "", discount: 0, discountAmount: 0 }];
    });
  }, [dismissMobileKeyboard]);

  const handleComboClick = useCallback((combo: ComboWithItems) => {
    dismissMobileKeyboard();
    if (combo.combo_choice_groups && combo.combo_choice_groups.length > 0) {
      setSelectedCombo(combo);
      setComboChoiceOpen(true);
    } else {
      addComboToCart(combo, []);
    }
  }, [dismissMobileKeyboard]);

  const addComboToCart = useCallback((combo: ComboWithItems, selectedChoices: { groupLabel: string; menuItem: MenuItem }[]) => {
    // Generate a unique group id for this combo instance
    const comboGroupId = crypto.randomUUID();
    
    // All items in combo: fixed + selected choices
    const allComboItems: { menuItem: MenuItem; quantity: number }[] = [];
    
    combo.combo_items.forEach((ci) => {
      const menuItem = items.find((i) => i.id === ci.menu_item_id);
      if (menuItem) allComboItems.push({ menuItem, quantity: ci.quantity });
    });
    
    selectedChoices.forEach((choice) => {
      allComboItems.push({ menuItem: choice.menuItem, quantity: 1 });
    });

    // Calculate total original price for proportional pricing
    const totalOriginalPrice = allComboItems.reduce((sum, { menuItem, quantity }) => sum + getEffectivePrice(menuItem) * quantity, 0);

    allComboItems.forEach(({ menuItem, quantity }) => {
      const itemPrice = totalOriginalPrice > 0
        ? Math.round((getEffectivePrice(menuItem) * quantity / totalOriginalPrice) * combo.price * 100) / 100 / quantity
        : combo.price / allComboItems.length;

      const comboMenuItem: MenuItem = {
        ...menuItem,
        price: itemPrice,
        name: menuItem.name,
        name_en: menuItem.name_en || menuItem.name,
      };

      setCart((prev) => [...prev, { menuItem: comboMenuItem, quantity, notes: "", discount: 0, discountAmount: 0, comboId: combo.id, comboGroupId }]);
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

  const updateCartDiscountAmount = useCallback((menuItemId: string, amount: number) => {
    setCart((prev) =>
      prev.map((c) => (c.menuItem.id === menuItemId ? { ...c, discountAmount: Math.max(0, amount) } : c))
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
    await addItemsBulk.mutateAsync({
      order_id: orderId,
      items: cart.map((c) => ({
        menu_item_id: c.menuItem.id,
        quantity: c.quantity,
        unit_price: getEffectivePrice(c.menuItem),
        notes: c.notes || undefined,
        discount: c.discount || 0,
        discount_amount: c.discountAmount || 0,
        combo_id: c.comboId,
        combo_group_id: c.comboGroupId,
      })),
    });
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


  const handleCancelOrder = async () => {
    if (!order) return;
    await cancelOrder.mutateAsync(order.id);
    toast({ title: t("common.success"), description: t("orders.orderCancelled") });
    onOpenChange(false);
  };

  const handleConfirmPayment = async () => {
    if (!order) return;
    try {
      const gd = order.general_discount ?? 0;
      const gda = (order as any).general_discount_amount ?? 0;
      const finalAmount = Math.max(0, order.total * (1 - gd / 100) - gda);
      await createPayment.mutateAsync({
        order_id: order.id,
        parts: [{
          amount: Math.round(finalAmount * 100) / 100,
          tip: parseFloat(tipAmount) || 0,
          payment_method: paymentMethod,
        }],
      });
      toast({ title: t("common.success"), description: t("billing.paymentSuccess") });
      setShowPayment(false);
      setTipAmount("0");
      setCashDenoms({});
      setCashManual("");
      onOpenChange(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const getName = (item: { name?: string; name_en?: string }) =>
    language === "es" ? item.name : item.name_en;

  const orderItems = order?.order_items ?? [];
  const canAddItems = !order || ["pending", "in_progress", "ready", "served"].includes(order.status);
  const canSendToKitchen = order?.status === "pending" && orderItems.length > 0;
  const canPay = order && ["in_progress", "ready", "served"].includes(order.status);
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
      <div className="relative mb-2 shrink-0">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
          autoFocus={!isMobile}
          enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
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

      <div
        className="flex-1 overflow-y-auto"
        data-vaul-no-drag
        onTouchStart={() => {
          // Dismiss keyboard when scrolling results on mobile
          if (document.activeElement instanceof HTMLInputElement) {
            document.activeElement.blur();
          }
        }}
      >
        <div className="space-y-0.5 pr-1">
          {/* Combos */}
          {filteredCombos.map((combo) => (
            <button
              key={`combo-${combo.id}`}
              type="button"
              onPointerDown={dismissMobileKeyboard}
              onClick={() => handleComboClick(combo)}
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
                type="button"
                onPointerDown={dismissMobileKeyboard}
                onClick={() => addToCart(item)}
                className="w-full flex items-center justify-between rounded-md border p-2 hover:bg-accent active:bg-accent/80 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{getName(item)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.inventory_count != null && (
                    <Badge variant="outline" className={`text-[10px] h-5 ${item.inventory_count <= 0 ? "border-destructive text-destructive font-bold" : item.inventory_count <= 3 ? "border-amber-500 text-amber-600" : "text-muted-foreground"}`}>
                      {item.inventory_count <= 0 ? "⚠ 0" : item.inventory_count}
                    </Badge>
                  )}
                  {inCart && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-[20px] justify-center">
                      {inCart.quantity}
                    </Badge>
                  )}
                  <span className="text-sm font-semibold">${getEffectivePrice(item).toFixed(0)}</span>
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
      {(() => {
        // Group cart items by comboGroupId
        const comboCartGroups = new Map<string, { comboName: string; items: CartItem[] }>();
        const singles: CartItem[] = [];
        const orderedEntries: Array<{ type: "single"; item: CartItem } | { type: "combo"; groupId: string }> = [];
        const usedGroups = new Set<string>();

        for (const c of cart) {
          if (c.comboGroupId) {
            if (!comboCartGroups.has(c.comboGroupId)) {
              const combo = combos.find((cb) => cb.id === c.comboId);
              comboCartGroups.set(c.comboGroupId, {
                comboName: language === "es" ? (combo?.name ?? "Combo") : (combo?.name_en || combo?.name || "Combo"),
                items: [],
              });
            }
            comboCartGroups.get(c.comboGroupId)!.items.push(c);
            if (!usedGroups.has(c.comboGroupId)) {
              usedGroups.add(c.comboGroupId);
              orderedEntries.push({ type: "combo", groupId: c.comboGroupId });
            }
          } else {
            orderedEntries.push({ type: "single", item: c });
          }
        }

        const renderCartItem = (c: CartItem, indent = false) => (
          <div key={c.menuItem.id} className={`space-y-1 ${indent ? "ml-3" : ""}`}>
            <div className="flex items-center gap-1 text-sm">
              {!c.comboGroupId && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartQty(c.menuItem.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-5 text-center text-xs font-medium">{c.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartQty(c.menuItem.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {c.comboGroupId && (
                <span className="text-xs text-muted-foreground ml-1">{c.quantity}×</span>
              )}
              <span className="flex-1 truncate text-xs">{getName(c.menuItem)}</span>
              {c.discount > 0 && (
                <span className="text-[10px] text-emerald-600 font-medium">-{c.discount}%</span>
              )}
              {c.discountAmount > 0 && (
                <span className="text-[10px] text-emerald-600 font-medium">-${c.discountAmount.toFixed(0)}</span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setEditingNotes(editingNotes === c.menuItem.id ? null : c.menuItem.id)}
              >
                <MessageSquare className={`h-3 w-3 ${c.notes ? "text-primary" : "text-muted-foreground"}`} />
              </Button>
              {isAdmin && !c.comboGroupId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setEditingNotes(editingNotes === `disc-${c.menuItem.id}` ? null : `disc-${c.menuItem.id}`)}
                >
                  <Percent className={`h-3 w-3 ${(c.discount > 0 || c.discountAmount > 0) ? "text-emerald-600" : "text-muted-foreground"}`} />
                </Button>
              )}
              {!c.comboGroupId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-destructive"
                  onClick={() => removeFromCart(c.menuItem.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            {editingNotes === `disc-${c.menuItem.id}` && isAdmin && (
              <div className="flex items-center gap-2 ml-1 flex-wrap">
                <div className="flex items-center gap-1">
                  <Percent className="h-3 w-3 text-muted-foreground shrink-0" />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={c.discount || ""}
                    placeholder="0"
                    onChange={(e) => updateCartDiscount(c.menuItem.id, parseInt(e.target.value) || 0)}
                    className="h-7 w-16 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">%</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-muted-foreground shrink-0" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={c.discountAmount || ""}
                    placeholder="0"
                    onChange={(e) => updateCartDiscountAmount(c.menuItem.id, parseFloat(e.target.value) || 0)}
                    className="h-7 w-20 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">MXN</span>
                </div>
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
        );

        return orderedEntries.map((entry) => {
          if (entry.type === "combo") {
            const group = comboCartGroups.get(entry.groupId)!;
            return (
              <div key={entry.groupId} className="border rounded-md p-1.5 bg-muted/20 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Package className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-xs font-semibold text-primary">{group.comboName}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-destructive"
                    onClick={() => {
                      group.items.forEach((c) => removeFromCart(c.menuItem.id));
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {group.items.map((c) => renderCartItem(c, true))}
              </div>
            );
          }
          return renderCartItem(entry.item);
        });
      })()}
      <Button size="sm" className="w-full gap-1 h-8" onClick={handleSubmitCart} disabled={addItem.isPending || createOrder.isPending}>
        <Plus className="h-3 w-3" /> {t("orders.addToOrder")}
      </Button>
    </div>
  );

  const renderOrderItem = (oi: typeof orderItems[0], indent = false) => {
    const discountPct = (oi as any).discount ?? 0;
    const discountAmt = (oi as any).discount_amount ?? 0;
    const gross = oi.quantity * oi.unit_price;
    const lineTotal = applyLineDiscount(gross, discountPct, discountAmt);
    const hasAnyDiscount = discountPct > 0 || discountAmt > 0;
    return (
      <div key={oi.id} className={`space-y-0.5 ${indent ? "ml-3" : ""}`}>
        <div className="flex items-center justify-between text-sm gap-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="truncate text-xs">
                {oi.quantity}x {getName(oi.menu_item)}
              </p>
              {discountPct > 0 && (
                <span className="text-[10px] text-emerald-600 font-medium shrink-0">-{discountPct}%</span>
              )}
              {discountAmt > 0 && (
                <span className="text-[10px] text-emerald-600 font-medium shrink-0">-${discountAmt.toFixed(0)}</span>
              )}
              {order && order.status !== "pending" && itemStatusBadge(oi.status)}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {hasAnyDiscount ? (
                <><span className="line-through">${gross.toFixed(0)}</span> <span className="text-emerald-600">${lineTotal.toFixed(0)}</span></>
              ) : (
                <>${gross.toFixed(0)}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {order && (oi.status === "pending" || oi.status === "in_progress") && order.status !== "pending" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-emerald-600"
                onClick={() => updateItemStatus.mutate({ id: oi.id, status: "ready", order_id: order.id })}
                title={t("orders.markReady")}
              >
                <CheckCircle className="h-3 w-3" />
              </Button>
            )}
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEditingExistingNotes(editingExistingNotes === `disc-${oi.id}` ? null : `disc-${oi.id}`)}
                  title={language === "es" ? "Descuento %" : "Discount %"}
                >
                  <Percent className={`h-3 w-3 ${discountPct > 0 ? "text-emerald-600" : "text-muted-foreground"}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEditingExistingNotes(editingExistingNotes === `discAmt-${oi.id}` ? null : `discAmt-${oi.id}`)}
                  title={language === "es" ? "Descuento fijo $" : "Fixed discount $"}
                >
                  <DollarSign className={`h-3 w-3 ${discountAmt > 0 ? "text-emerald-600" : "text-muted-foreground"}`} />
                </Button>
              </>
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
        {editingExistingNotes === `discAmt-${oi.id}` && isAdmin && order && (
          <div className="flex items-center gap-1.5 ml-1">
            <DollarSign className="h-3 w-3 text-muted-foreground shrink-0" />
            <Input
              type="number"
              min="0"
              step="1"
              defaultValue={discountAmt || ""}
              placeholder="0"
              onBlur={(e) => {
                const val = Math.max(0, parseFloat(e.target.value) || 0);
                updateItemDiscountAmount.mutate({ id: oi.id, discount_amount: val, order_id: order.id });
                setEditingExistingNotes(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="h-7 w-20 text-xs"
              autoFocus
            />
            <span className="text-[10px] text-muted-foreground">MXN</span>
          </div>
        )}
        {oi.notes && (
          <p className="text-[10px] text-muted-foreground italic ml-1">📝 {oi.notes}</p>
        )}
      </div>
    );
  };

  const grouped = useMemo(() => groupOrderItems(orderItems), [orderItems]);

  // ─── Order items list (scrollable) ───
  const orderItemsList = (
    <>
      {grouped.map((entry) => {
        if (entry.type === "single") {
          return renderOrderItem(entry.item);
        }
        const { group } = entry;
        const comboLabel = language === "es" ? group.comboName : group.comboNameEn;
        return (
          <div key={group.comboGroupId} className="border rounded-md p-1.5 bg-muted/20 space-y-1">
            <div className="flex items-center gap-1.5">
              <Package className="h-3 w-3 text-primary shrink-0" />
              <span className="text-xs font-semibold text-primary">{comboLabel}</span>
            </div>
            {group.items.map((oi) => renderOrderItem(oi, true))}
          </div>
        );
      })}
    </>
  );

  // ─── Order action buttons (sticky at bottom) ───
  const handlePrintPreBill = async () => {
    if (!order || orderItems.length === 0) return;
    try {
      let waiterName: string | undefined;
      if (order.created_by) {
        const { data: prof } = await supabase
          .from("profiles").select("full_name").eq("id", order.created_by).maybeSingle();
        waiterName = prof?.full_name ?? undefined;
      }
      const subtotal = order.total;
      const gd = order.general_discount ?? 0;
      const gda = (order as any).general_discount_amount ?? 0;
      const total = Math.max(0, subtotal * (1 - gd / 100) - gda);
      const { buildTicketSnapshot } = await import("@/utils/ticketSnapshot");
      const snapshot = await buildTicketSnapshot({
        table_number: order.table_number,
        table_name: tableName,
        waiter_name: waiterName,
        general_discount: gd,
        general_discount_amount: gda,
        language,
        items: orderItems,
      });
      const ticket = await createTicket.mutateAsync({
        order_id: order.id,
        kind: "pre_payment",
        subtotal,
        tip: 0,
        total,
        snapshot,
      });
      setPrePaymentTicket(ticket);
      setPrePaymentOpen(true);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const orderActions = orderItems.length > 0 ? (
    <div className="pt-2 border-t space-y-1.5 shrink-0 bg-background">
      {/* General discount */}
      <div className="flex items-center justify-between text-xs">
        <button
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setEditingGeneralDiscount(!editingGeneralDiscount)}
        >
          <Percent className={`h-3 w-3 ${((order?.general_discount ?? 0) > 0 || ((order as any)?.general_discount_amount ?? 0) > 0) ? "text-emerald-600" : ""}`} />
          <span>{language === "es" ? "Descuento general" : "General discount"}</span>
          {(order?.general_discount ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-300 text-emerald-700">
              -{order?.general_discount}%
            </Badge>
          )}
          {((order as any)?.general_discount_amount ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-300 text-emerald-700">
              -${((order as any).general_discount_amount).toFixed(0)}
            </Badge>
          )}
        </button>
      </div>
      {editingGeneralDiscount && order && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Percent className="h-3 w-3 text-muted-foreground shrink-0" />
            <Input
              type="number"
              min="0"
              max="100"
              defaultValue={order.general_discount || ""}
              placeholder="0"
              onBlur={(e) => {
                const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                updateGeneralDiscount.mutate({ id: order.id, discount: val });
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="h-7 w-16 text-xs"
              autoFocus
            />
            <span className="text-[10px] text-muted-foreground">%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-muted-foreground shrink-0" />
            <Input
              type="number"
              min="0"
              step="0.01"
              defaultValue={(order as any).general_discount_amount || ""}
              placeholder="0"
              onBlur={(e) => {
                const val = Math.max(0, parseFloat(e.target.value) || 0);
                updateGeneralDiscountAmount.mutate({ id: order.id, discount_amount: val });
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="h-7 w-20 text-xs"
            />
            <span className="text-[10px] text-muted-foreground">MXN</span>
          </div>
        </div>
      )}
      {(() => {
        const subtotal = order?.total ?? 0;
        const gd = order?.general_discount ?? 0;
        const gda = (order as any)?.general_discount_amount ?? 0;
        const finalTotal = Math.max(0, subtotal * (1 - gd / 100) - gda);
        const hasDisc = gd > 0 || gda > 0;
        return (
          <div className="flex justify-between font-semibold text-sm">
            <span>Total</span>
            <span>
              {hasDisc && (
                <span className="line-through text-muted-foreground text-xs mr-1">${subtotal.toFixed(0)}</span>
              )}
              ${finalTotal.toFixed(0)} MXN
            </span>
          </div>
        );
      })()}
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
      {canPay && (
        <>
          <Button className="w-full gap-1.5" size="sm" variant="outline" onClick={handlePrintPreBill} disabled={createTicket.isPending}>
            <Printer className="h-3.5 w-3.5" /> {t("tickets.printPrebill")}
          </Button>
          <Button className="w-full gap-1.5" size="sm" onClick={() => setShowPayment(true)}>
            <Receipt className="h-3.5 w-3.5" /> {t("billing.payNow")}
          </Button>
        </>
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
  ) : null;

  // ─── Current order section (desktop) ───
  const orderSection = (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 shrink-0">
        {t("orders.currentOrder")}
        {order && <Badge variant="outline" className="text-[10px]">{statusLabel[order.status] ?? order.status}</Badge>}
      </h3>
      {orderItems.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("orders.empty")}</p>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-1.5 pr-1">
              {orderItemsList}
            </div>
          </div>
          {orderActions}
        </>
      )}
    </div>
  );

  // ─── Payment view ───
  const paymentView = (
    <div className="space-y-4 p-1">
      <div className="space-y-1">
        {orderItems.map((oi) => {
          const disc = (oi as any).discount ?? 0;
          const discAmt = (oi as any).discount_amount ?? 0;
          const lineTotal = applyLineDiscount(oi.quantity * oi.unit_price, disc, discAmt);
          return (
            <div key={oi.id} className="flex justify-between text-sm">
              <span>{oi.quantity}x {getName(oi.menu_item)}
                {disc > 0 && <span className="text-emerald-600 text-xs ml-1">(-{disc}%)</span>}
                {discAmt > 0 && <span className="text-emerald-600 text-xs ml-1">(-${discAmt.toFixed(0)})</span>}
              </span>
              <span className="text-muted-foreground">${lineTotal.toFixed(0)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-sm border-t pt-2">
        <span>{t("billing.subtotal")}</span>
        <span className="font-semibold">${order?.total.toFixed(0)} MXN</span>
      </div>
      {(order?.general_discount ?? 0) > 0 && (
        <div className="flex justify-between text-sm text-emerald-600">
          <span>{language === "es" ? "Descuento general" : "General discount"} (-{order?.general_discount}%)</span>
          <span>-${((order?.total ?? 0) * (order?.general_discount ?? 0) / 100).toFixed(0)}</span>
        </div>
      )}
      {((order as any)?.general_discount_amount ?? 0) > 0 && (
        <div className="flex justify-between text-sm text-emerald-600">
          <span>{language === "es" ? "Descuento fijo" : "Fixed discount"}</span>
          <span>-${((order as any).general_discount_amount).toFixed(0)}</span>
        </div>
      )}
      {(() => {
        const subtotal = order?.total ?? 0;
        const gd = order?.general_discount ?? 0;
        const gda = (order as any)?.general_discount_amount ?? 0;
        const finalAmount = applyGeneralDiscount(subtotal, gd, gda);
        const tip = parseFloat(tipAmount) || 0;
        return (
          <>
            <div className="space-y-2">
              <Label>{t("billing.tip")}</Label>
              <div className="flex gap-2">
                {[0, 10, 15, 20].map((pct) => {
                  const val = Math.round(finalAmount * pct / 100);
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
              <span>${(finalAmount + tip).toFixed(0)} MXN</span>
            </div>
            {paymentMethod === "cash" && (() => {
               const totalToPay = finalAmount + tip;
              const received = cashReceived;
              const change = received - totalToPay;
              const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{language === "es" ? "Efectivo recibido" : "Cash received"}</Label>
                    {received > 0 && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive" onClick={() => { setCashDenoms({}); setCashManual(""); }}>
                        {language === "es" ? "Limpiar" : "Clear"}
                      </Button>
                    )}
                  </div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder={`$${totalToPay.toFixed(0)}`}
                    value={cashManual}
                    onChange={(e) => setCashManual(e.target.value)}
                    className="text-center text-lg font-semibold"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {DENOMS.map((d) => {
                      const count = cashDenoms[d] || 0;
                      return (
                        <div key={d} className="inline-flex items-center h-8 rounded-md border border-input overflow-hidden">
                          <button
                            type="button"
                            className="h-full px-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                            disabled={count === 0}
                            onClick={() => setCashDenoms((prev) => {
                              const next = { ...prev, [d]: (prev[d] || 0) - 1 };
                              if (next[d] <= 0) delete next[d];
                              return next;
                            })}
                          >
                            −
                          </button>
                          <span
                            className={`px-1.5 text-xs font-semibold cursor-pointer select-none ${count > 0 ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                            onClick={() => setCashDenoms((prev) => ({ ...prev, [d]: (prev[d] || 0) + 1 }))}
                          >
                            {count > 0 && <span className="mr-0.5">({count})</span>}${d}
                          </span>
                          <button
                            type="button"
                            className="h-full px-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
                            onClick={() => setCashDenoms((prev) => ({ ...prev, [d]: (prev[d] || 0) + 1 }))}
                          >
                            +
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {received > 0 && (
                    <div className="flex justify-between text-sm font-medium border-t pt-1.5">
                      <span>{language === "es" ? "Recibido" : "Received"}</span>
                      <span>${received.toFixed(0)} MXN</span>
                    </div>
                  )}
                  {received > 0 && (
                    <div className={`flex justify-between text-sm font-semibold ${change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                      <span>{language === "es" ? "Cambio" : "Change"}</span>
                      <span>${change.toFixed(0)} MXN</span>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPayment(false)}>{t("common.back")}</Button>
              <Button className="flex-1" onClick={handleConfirmPayment} disabled={createPayment.isPending}>{t("billing.confirmPayment")}</Button>
            </div>
          </>
        );
      })()}
    </div>
  );

  // ─── Table name save ───
  const saveTableName = useCallback((name: string) => {
    const trimmed = name.trim();
    const updated = { ...tableNames, [String(tableNumber)]: trimmed };
    if (!trimmed) delete updated[String(tableNumber)];
    updateNames.mutate(updated);
    setEditingTableName(false);
  }, [tableNames, tableNumber, updateNames]);

  // ─── Title ───
  const currentDisplayName = localTableName || `${t("tables.title")} ${tableNumber}`;
  const titleSuffix = ` — ${showPayment ? t("billing.confirmPayment") : t("orders.order")}`;

  const titleElement = (
    <span className="flex items-center gap-1.5 min-w-0">
      {editingTableName ? (
        <Input
          value={localTableName}
          onChange={(e) => setLocalTableName(e.target.value)}
          onBlur={() => saveTableName(localTableName)}
          onKeyDown={(e) => { if (e.key === "Enter") saveTableName(localTableName); if (e.key === "Escape") { setLocalTableName(tableName || ""); setEditingTableName(false); } }}
          className="h-7 w-28 text-sm"
          placeholder={`${t("tables.title")} ${tableNumber}`}
          autoFocus
        />
      ) : (
        <span
          className="cursor-pointer hover:underline decoration-dashed underline-offset-2 flex items-center gap-1"
          onClick={(e) => { e.stopPropagation(); setEditingTableName(true); }}
          title={language === "es" ? "Editar nombre" : "Edit name"}
        >
          {currentDisplayName}
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </span>
      )}
      <span className="shrink-0">{titleSuffix}</span>
    </span>
  );

  const comboChoiceDialogElement = (
    <>
      {selectedCombo && (
        <ComboChoiceDialog
          open={comboChoiceOpen}
          onOpenChange={(v) => { setComboChoiceOpen(v); if (!v) setSelectedCombo(null); }}
          combo={selectedCombo}
          allItems={items}
          onConfirm={(combo, choices) => addComboToCart(combo, choices)}
        />
      )}
      <PrintTicketDialog
        open={prePaymentOpen}
        onOpenChange={(v) => { setPrePaymentOpen(v); if (!v) setPrePaymentTicket(null); }}
        ticket={prePaymentTicket}
      />
    </>
  );

  // ─── MOBILE: Drawer ───
  if (isMobile) {
    return (
      <>{comboChoiceDialogElement}
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh] flex flex-col overflow-hidden">
          <DrawerHeader className="pb-2 shrink-0">
            <DrawerTitle className="flex items-center gap-2 text-base">
              {titleElement}
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
                <div className="flex gap-1 mb-2 shrink-0">
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
                <div className="flex flex-col flex-1 min-h-0">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 shrink-0">
                    {t("orders.currentOrder")}
                    {order && <Badge variant="outline" className="text-[10px]">{statusLabel[order.status] ?? order.status}</Badge>}
                  </h3>
                  {orderItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("orders.empty")}</p>
                  ) : (
                    <>
                      <div className="flex-1 overflow-y-auto min-h-0" data-vaul-no-drag>
                        <div className="space-y-1.5 pr-1">
                          {orderItemsList}
                        </div>
                      </div>
                      {orderActions}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
      </>
    );
  }

  // ─── DESKTOP: Dialog ───
  if (showPayment && order) {
    return (
      <>{comboChoiceDialogElement}
      <Dialog open={open} onOpenChange={(v) => { if (!v) setShowPayment(false); onOpenChange(v); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{titleElement}</DialogTitle>
          </DialogHeader>
          {paymentView}
        </DialogContent>
      </Dialog>
      </>
    );
  }

  return (
    <>{comboChoiceDialogElement}
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {titleElement}
            {order && <Badge variant="outline" className="text-xs">{statusLabel[order.status] ?? order.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          {canAddItems && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {menuPicker}
              <div className="overflow-y-auto shrink-0 max-h-[40%]">
                {cartSection}
              </div>
            </div>
          )}
          <div className={`flex flex-col min-h-0 overflow-hidden ${canAddItems ? "w-72 border-l pl-4" : "flex-1"}`}>
            {orderSection}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};
