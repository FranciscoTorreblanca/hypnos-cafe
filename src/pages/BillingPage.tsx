import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useOrders } from "@/hooks/useOrders";
import { usePayments, Payment } from "@/hooks/usePayments";
import { useTill } from "@/hooks/useTill";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Banknote, CreditCard, Receipt, DollarSign, TrendingUp, Pencil, Trash2, BarChart3, Vault, Plus, Minus } from "lucide-react";
import { startOfDay, startOfWeek, startOfMonth, format, isAfter, subDays, subWeeks, subMonths } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BillingPage = () => {
  const { t, language } = useLanguage();
  const { data: orders = [] } = useOrders();
  const { data: payments = [], createPayment, updatePayment, deletePayment } = usePayments();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: tillTransactions = [], balance: tillBalance, addTransaction: addTillTransaction, deleteTransaction: deleteTillTransaction } = useTill();

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [tipAmount, setTipAmount] = useState<string>("0");

  // Admin edit/delete state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editTip, setEditTip] = useState("");
  const [editMethod, setEditMethod] = useState("cash");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // Cash flow state
  const [cashFlowPeriod, setCashFlowPeriod] = useState<"day" | "week" | "month">("day");

  // Till adjustment state
  const [tillAdjustType, setTillAdjustType] = useState<"in" | "out">("in");
  const [tillAdjustAmount, setTillAdjustAmount] = useState("");
  const [tillAdjustNote, setTillAdjustNote] = useState("");

  // Orders ready to bill: served status
  const billableOrders = orders.filter((o) => o.status === "served");

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const openPayDialog = (orderId: string) => {
    setSelectedOrderId(orderId);
    setPaymentMethod("cash");
    setTipAmount("0");
    setPayDialogOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedOrder) return;
    try {
      await createPayment.mutateAsync({
        order_id: selectedOrder.id,
        amount: selectedOrder.total,
        tip: parseFloat(tipAmount) || 0,
        payment_method: paymentMethod,
      });
      toast({ title: t("common.success"), description: t("billing.paymentSuccess") });
      setPayDialogOpen(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const totalSales = payments.reduce((s, p) => s + p.amount, 0);
  const totalTips = payments.reduce((s, p) => s + p.tip, 0);

  const openEditDialog = (p: Payment) => {
    setEditingPayment(p);
    setEditAmount(String(p.amount));
    setEditTip(String(p.tip));
    setEditMethod(p.payment_method);
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingPayment) return;
    try {
      await updatePayment.mutateAsync({ id: editingPayment.id, amount: parseFloat(editAmount) || 0, tip: parseFloat(editTip) || 0, payment_method: editMethod });
      toast({ title: t("common.success"), description: t("billing.paymentUpdated") });
      setEditDialogOpen(false);
    } catch { toast({ title: t("common.error"), variant: "destructive" }); }
  };

  const handleDeleteConfirm = async (revertToServed: boolean) => {
    if (!deletingPaymentId) return;
    try {
      await deletePayment.mutateAsync({ id: deletingPaymentId, revertToServed });
      toast({ title: t("common.success"), description: t("billing.paymentDeleted") });
    } catch { toast({ title: t("common.error"), variant: "destructive" }); }
    setDeleteDialogOpen(false);
    setDeletingPaymentId(null);
  };

  // Group tips by waiter
  const tipsByWaiter: Record<string, { name: string; tips: number; count: number }> = {};
  payments.forEach((p) => {
    const key = p.waiter?.email ?? "unknown";
    if (!tipsByWaiter[key]) tipsByWaiter[key] = { name: p.waiter?.full_name || key, tips: 0, count: 0 };
    tipsByWaiter[key].tips += p.tip;
    tipsByWaiter[key].count += 1;
  });

  // Till adjustment handler
  const handleTillAdjust = async () => {
    const amt = parseFloat(tillAdjustAmount);
    if (!amt || amt <= 0) return;
    try {
      await addTillTransaction.mutateAsync({
        type: tillAdjustType === "in" ? "adjustment_in" : "adjustment_out",
        amount: amt,
        note: tillAdjustNote,
      });
      toast({ title: t("common.success"), description: t("billing.tillSuccess") });
      setTillAdjustAmount("");
      setTillAdjustNote("");
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  // Cash flow calculations
  const dateFnsLocale = language === "es" ? es : enUS;
  const now = new Date();

  const getCashFlowData = () => {
    let periods: { label: string; start: Date; end: Date }[] = [];

    if (cashFlowPeriod === "day") {
      for (let i = 6; i >= 0; i--) {
        const day = subDays(now, i);
        const start = startOfDay(day);
        const end = i === 0 ? now : startOfDay(subDays(now, i - 1));
        periods.push({
          label: format(day, "EEE dd", { locale: dateFnsLocale }),
          start,
          end,
        });
      }
    } else if (cashFlowPeriod === "week") {
      for (let i = 3; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
        const weekEnd = i === 0 ? now : startOfWeek(subWeeks(now, i - 1), { weekStartsOn: 1 });
        periods.push({
          label: format(weekStart, "dd MMM", { locale: dateFnsLocale }),
          start: weekStart,
          end: weekEnd,
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(now, i));
        const monthEnd = i === 0 ? now : startOfMonth(subMonths(now, i - 1));
        periods.push({
          label: format(monthStart, "MMM yy", { locale: dateFnsLocale }),
          start: monthStart,
          end: monthEnd,
        });
      }
    }

    return periods.map((period) => {
      const periodPayments = payments.filter((p) => {
        const d = new Date(p.created_at);
        return d >= period.start && d < period.end;
      });
      const income = periodPayments.reduce((s, p) => s + p.amount, 0);
      const tips = periodPayments.reduce((s, p) => s + p.tip, 0);
      const cash = periodPayments.filter((p) => p.payment_method === "cash").reduce((s, p) => s + p.amount, 0);
      const card = periodPayments.filter((p) => p.payment_method === "card").reduce((s, p) => s + p.amount, 0);
      return { ...period, income, tips, cash, card, count: periodPayments.length };
    });
  };

  const cashFlowData = getCashFlowData();
  const cfTotal = cashFlowData.reduce((s, d) => s + d.income, 0);
  const cfTips = cashFlowData.reduce((s, d) => s + d.tips, 0);
  const cfCash = cashFlowData.reduce((s, d) => s + d.cash, 0);
  const cfCard = cashFlowData.reduce((s, d) => s + d.card, 0);

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-semibold tracking-tight">{t("billing.title")}</h1>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> {t("billing.salesTotal")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalSales.toFixed(0)} MXN</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> {t("billing.tipsTotal")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalTips.toFixed(0)} MXN</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4" /> {t("billing.pendingBills")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{billableOrders.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="pending">{t("billing.pendingBills")}</TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-1"><BarChart3 className="h-3.5 w-3.5" />{t("billing.cashFlow")}</TabsTrigger>
          <TabsTrigger value="history">{t("billing.history")}</TabsTrigger>
          <TabsTrigger value="tips">{t("billing.tip")}</TabsTrigger>
          <TabsTrigger value="till" className="gap-1"><Vault className="h-3.5 w-3.5" />{t("billing.till")}</TabsTrigger>
        </TabsList>

        {/* Pending bills */}
        <TabsContent value="pending" className="mt-4">
          {billableOrders.length === 0 ? (
            <p className="text-muted-foreground">{t("billing.noPending")}</p>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {billableOrders.map((order) => (
                <Card key={order.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {t("billing.table")} {order.table_number}
                      </CardTitle>
                      <Badge variant="outline">{t("orders.served")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      {(order.order_items ?? []).map((oi) => (
                        <div key={oi.id} className="flex justify-between text-sm">
                          <span>{oi.quantity}x {language === "es" ? oi.menu_item?.name : oi.menu_item?.name_en}</span>
                          <span className="text-muted-foreground">${(oi.quantity * oi.unit_price).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between font-semibold text-sm border-t pt-2">
                      <span>Total</span>
                      <span>${order.total.toFixed(0)} MXN</span>
                    </div>
                    <Button className="w-full gap-2" onClick={() => openPayDialog(order.id)}>
                      <Receipt className="h-4 w-4" />
                      {t("billing.payNow")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Payment history */}
        <TabsContent value="history" className="mt-4">
          {payments.length === 0 ? (
            <p className="text-muted-foreground">{t("billing.noHistory")}</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("billing.date")}</TableHead>
                    <TableHead>{t("billing.table")}</TableHead>
                    <TableHead>{t("billing.amount")}</TableHead>
                    <TableHead>{t("billing.tip")}</TableHead>
                    <TableHead>{t("billing.method")}</TableHead>
                    <TableHead>{t("billing.waiter")}</TableHead>
                    {isAdmin && <TableHead>{t("billing.actions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{new Date(p.created_at).toLocaleString()}</TableCell>
                      <TableCell>{p.order?.table_number ?? "-"}</TableCell>
                      <TableCell>${p.amount.toFixed(0)}</TableCell>
                      <TableCell>${p.tip.toFixed(0)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {p.payment_method === "cash" ? t("billing.cash") : t("billing.card")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{p.waiter?.full_name || "-"}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(p)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeletingPaymentId(p.id); setDeleteDialogOpen(true); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tips by waiter */}
        <TabsContent value="tips" className="mt-4">
          {Object.keys(tipsByWaiter).length === 0 ? (
            <p className="text-muted-foreground">{t("billing.noHistory")}</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("billing.waiter")}</TableHead>
                    <TableHead>{t("billing.tipsTotal")}</TableHead>
                    <TableHead>#</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(tipsByWaiter).map((w) => (
                    <TableRow key={w.name}>
                      <TableCell>{w.name}</TableCell>
                      <TableCell className="font-semibold">${w.tips.toFixed(0)} MXN</TableCell>
                      <TableCell>{w.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Cash Flow */}
        <TabsContent value="cashflow" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Select value={cashFlowPeriod} onValueChange={(v) => setCashFlowPeriod(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t("billing.daily")}</SelectItem>
                <SelectItem value="week">{t("billing.weekly")}</SelectItem>
                <SelectItem value="month">{t("billing.monthly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Totals summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{t("billing.income")}</p>
                <p className="text-lg font-bold">${cfTotal.toFixed(0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{t("billing.tipsLabel")}</p>
                <p className="text-lg font-bold">${cfTips.toFixed(0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Banknote className="h-3 w-3" />{t("billing.cashMethod")}</p>
                <p className="text-lg font-bold">${cfCash.toFixed(0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" />{t("billing.cardMethod")}</p>
                <p className="text-lg font-bold">${cfCard.toFixed(0)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Period breakdown table */}
          {cashFlowData.some((d) => d.count > 0) ? (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("billing.date")}</TableHead>
                    <TableHead>{t("billing.income")}</TableHead>
                    <TableHead>{t("billing.tipsLabel")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("billing.cashMethod")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("billing.cardMethod")}</TableHead>
                    <TableHead>{t("billing.transactions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashFlowData.map((d) => (
                    <TableRow key={d.label}>
                      <TableCell className="font-medium text-xs">{d.label}</TableCell>
                      <TableCell className="font-semibold">${d.income.toFixed(0)}</TableCell>
                      <TableCell>${d.tips.toFixed(0)}</TableCell>
                      <TableCell className="hidden sm:table-cell">${d.cash.toFixed(0)}</TableCell>
                      <TableCell className="hidden sm:table-cell">${d.card.toFixed(0)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{d.count}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell>${cfTotal.toFixed(0)}</TableCell>
                    <TableCell>${cfTips.toFixed(0)}</TableCell>
                    <TableCell className="hidden sm:table-cell">${cfCash.toFixed(0)}</TableCell>
                    <TableCell className="hidden sm:table-cell">${cfCard.toFixed(0)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{cashFlowData.reduce((s, d) => s + d.count, 0)}</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">{t("billing.noData")}</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Payment dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("billing.confirmPayment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>{t("billing.subtotal")}</span>
              <span className="font-semibold">${(selectedOrder?.total ?? 0).toFixed(0)} MXN</span>
            </div>

            <div className="space-y-2">
              <Label>{t("billing.tip")}</Label>
              <div className="flex gap-2">
                {[0, 10, 15, 20].map((pct) => (
                  <Button
                    key={pct}
                    type="button"
                    variant={tipAmount === String(Math.round((selectedOrder?.total ?? 0) * pct / 100)) && pct > 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTipAmount(String(Math.round((selectedOrder?.total ?? 0) * pct / 100)))}
                  >
                    {pct === 0 ? "$0" : `${pct}%`}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min="0"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="$0"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("billing.paymentMethod")}</Label>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="cash" id="cash" />
                  <Label htmlFor="cash" className="flex items-center gap-1 cursor-pointer">
                    <Banknote className="h-4 w-4" /> {t("billing.cash")}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="card" id="card" />
                  <Label htmlFor="card" className="flex items-center gap-1 cursor-pointer">
                    <CreditCard className="h-4 w-4" /> {t("billing.card")}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-between font-bold border-t pt-2">
              <span>{t("billing.total")}</span>
              <span>${((selectedOrder?.total ?? 0) + (parseFloat(tipAmount) || 0)).toFixed(0)} MXN</span>
            </div>

            <Button className="w-full" onClick={handleConfirmPayment} disabled={createPayment.isPending}>
              {t("billing.confirmPayment")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin edit payment dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("billing.editPayment")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("billing.amount")}</Label>
              <Input type="number" min="0" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("billing.tip")}</Label>
              <Input type="number" min="0" value={editTip} onChange={(e) => setEditTip(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("billing.paymentMethod")}</Label>
              <RadioGroup value={editMethod} onValueChange={setEditMethod} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="cash" id="edit-cash" />
                  <Label htmlFor="edit-cash" className="flex items-center gap-1 cursor-pointer">
                    <Banknote className="h-4 w-4" /> {t("billing.cash")}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="card" id="edit-card" />
                  <Label htmlFor="edit-card" className="flex items-center gap-1 cursor-pointer">
                    <CreditCard className="h-4 w-4" /> {t("billing.card")}
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <Button className="w-full" onClick={handleEditSave} disabled={updatePayment.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("billing.deletePayment")}</AlertDialogTitle>
            <AlertDialogDescription>{t("billing.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDeleteConfirm(true)} className="bg-orange-600 hover:bg-orange-700">
              {t("billing.deleteAndServe")}
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleDeleteConfirm(false)} className="bg-destructive hover:bg-destructive/90">
              {t("billing.deleteCompletely")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BillingPage;
