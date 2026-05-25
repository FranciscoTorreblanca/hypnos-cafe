import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { startOfMonth, endOfMonth, format, differenceInCalendarDays, addDays, addMonths, addYears, parseISO } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Wallet, CreditCard, Coins, TrendingDown, TrendingUp, Plus, Trash2, Pencil, AlertCircle, CheckCircle2, Receipt, CalendarClock } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie, Legend } from "recharts";

type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "one_time";
type Source = "cash" | "card" | "other";

const FREQ_MONTHLY_FACTOR: Record<Frequency, number> = {
  daily: 30,
  weekly: 4.345,
  biweekly: 2.1725,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  one_time: 0,
};

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

export default function BudgetPage() {
  const { t, language } = useLanguage();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const locale = language === "es" ? esLocale : enUS;

  const freqLabel = (f: Frequency) => {
    const map: Record<Frequency, { es: string; en: string }> = {
      daily: { es: "Diario", en: "Daily" },
      weekly: { es: "Semanal", en: "Weekly" },
      biweekly: { es: "Quincenal", en: "Bi-weekly" },
      monthly: { es: "Mensual", en: "Monthly" },
      quarterly: { es: "Trimestral", en: "Quarterly" },
      yearly: { es: "Anual", en: "Yearly" },
      one_time: { es: "Único", en: "One-time" },
    };
    return map[f][language];
  };

  const sourceLabel = (s: Source) => {
    const map: Record<Source, { es: string; en: string }> = {
      cash: { es: "Efectivo", en: "Cash" },
      card: { es: "Tarjeta", en: "Card" },
      other: { es: "Otro", en: "Other" },
    };
    return map[s][language];
  };

  // ---------- Queries ----------
  const { data: categories = [] } = useQuery({
    queryKey: ["budget-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("budget_categories") as any)
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: recurring = [] } = useQuery({
    queryKey: ["recurring-expenses"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("recurring_expenses") as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expense-entries"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("expense_entries") as any)
        .select("*")
        .order("paid_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: adjustments = [] } = useQuery({
    queryKey: ["balance-adjustments"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("balance_adjustments") as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["budget-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, tip, payment_method, created_at")
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---------- Derived numbers ----------
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const cardSourceFor = (method: string) => (method === "cash" ? "cash" : "card");

  const totalsBySource = useMemo(() => {
    let cash = 0;
    let card = 0;

    for (const a of adjustments) {
      if (a.source === "cash") cash += Number(a.amount);
      else if (a.source === "card") card += Number(a.amount);
    }
    for (const p of payments) {
      const total = Number(p.amount) + Number(p.tip || 0);
      if (cardSourceFor(p.payment_method) === "cash") cash += total;
      else card += total;
    }
    for (const e of expenses) {
      if (e.payment_source === "cash") cash -= Number(e.amount);
      else if (e.payment_source === "card") card -= Number(e.amount);
    }
    return { cash, card, total: cash + card };
  }, [adjustments, payments, expenses]);

  const monthlyFixed = useMemo(() => {
    return recurring
      .filter((r) => r.is_active)
      .reduce((s, r) => s + Number(r.amount) * (FREQ_MONTHLY_FACTOR[r.frequency as Frequency] ?? 0), 0);
  }, [recurring]);

  const earningsThisMonth = useMemo(() => {
    return payments
      .filter((p) => new Date(p.created_at) >= monthStart && new Date(p.created_at) <= monthEnd)
      .reduce((s, p) => s + Number(p.amount) + Number(p.tip || 0), 0);
  }, [payments, monthStart, monthEnd]);

  const spentThisMonth = useMemo(() => {
    return expenses
      .filter((e) => new Date(e.paid_at) >= monthStart && new Date(e.paid_at) <= monthEnd)
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [expenses, monthStart, monthEnd]);

  const projectedDelta = earningsThisMonth - monthlyFixed;
  const coverageRatio = monthlyFixed > 0 ? earningsThisMonth / monthlyFixed : 0;

  const byCategoryThisMonth = useMemo(() => {
    const map = new Map<string, { id: string; label: string; color: string; amount: number }>();
    for (const c of categories) {
      map.set(c.id, {
        id: c.id,
        label: language === "es" ? c.label : c.label_en || c.label,
        color: c.color,
        amount: 0,
      });
    }
    for (const e of expenses) {
      if (new Date(e.paid_at) < monthStart || new Date(e.paid_at) > monthEnd) continue;
      const entry = map.get(e.category_id);
      if (entry) entry.amount += Number(e.amount);
    }
    return Array.from(map.values()).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [expenses, categories, language, monthStart, monthEnd]);

  // ---------- Mutations (admin only) ----------
  const addExpense = useMutation({
    mutationFn: async (payload: { category_id: string; amount: number; payment_source: Source; note: string; paid_at: string }) => {
      const { error } = await (supabase.from("expense_entries") as any).insert({
        ...payload,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-entries"] });
      toast({ title: t("budget.expenseAdded") });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("expense_entries") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense-entries"] }),
  });

  const upsertRecurring = useMutation({
    mutationFn: async (r: any) => {
      if (r.id) {
        const { id, ...rest } = r;
        const { error } = await (supabase.from("recurring_expenses") as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("recurring_expenses") as any).insert({ ...r, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-expenses"] });
      toast({ title: t("budget.recurringSaved") });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRecurring = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("recurring_expenses") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-expenses"] }),
  });

  const addAdjustment = useMutation({
    mutationFn: async (a: { source: Source; amount: number; kind: string; note: string }) => {
      const { error } = await (supabase.from("balance_adjustments") as any).insert({ ...a, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["balance-adjustments"] });
      toast({ title: t("budget.balanceAdjusted") });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteAdjustment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("balance_adjustments") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["balance-adjustments"] }),
  });

  // ---------- Dialogs state ----------
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expForm, setExpForm] = useState({ category_id: "", amount: "", payment_source: "card" as Source, note: "", recurring_id: "" });

  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringEdit, setRecurringEdit] = useState<any>(null);

  const [adjOpen, setAdjOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({ source: "cash" as Source, amount: "", kind: "adjustment", note: "" });

  const [quickAdjOpen, setQuickAdjOpen] = useState(false);
  const [quickAdjSource, setQuickAdjSource] = useState<"cash" | "card">("cash");
  const [quickAdjTarget, setQuickAdjTarget] = useState("");
  const [quickAdjNote, setQuickAdjNote] = useState("");

  const openNewExpense = (recurring_id = "", category_id = "") => {
    setExpForm({ category_id: category_id || categories[0]?.id || "", amount: "", payment_source: "card", note: "", recurring_id });
    setExpenseOpen(true);
  };

  const submitExpense = () => {
    const amt = Number(expForm.amount);
    if (!expForm.category_id || !amt) return;
    addExpense.mutate(
      {
        category_id: expForm.category_id,
        amount: amt,
        payment_source: expForm.payment_source,
        note: expForm.note,
        paid_at: new Date().toISOString(),
      },
      { onSuccess: () => setExpenseOpen(false) }
    );
  };

  const openNewRecurring = () => {
    setRecurringEdit({
      name: "",
      category_id: categories.find((c) => c.kind === "fixed")?.id || categories[0]?.id || "",
      amount: 0,
      frequency: "monthly",
      payment_source: "card",
      next_due_date: format(new Date(), "yyyy-MM-dd"),
      is_active: true,
      notes: "",
    });
    setRecurringOpen(true);
  };

  const submitRecurring = () => {
    if (!recurringEdit?.name || !recurringEdit?.amount) return;
    upsertRecurring.mutate(recurringEdit, { onSuccess: () => setRecurringOpen(false) });
  };

  const submitAdjustment = () => {
    const amt = Number(adjForm.amount);
    if (!amt) return;
    addAdjustment.mutate(
      { source: adjForm.source, amount: amt, kind: adjForm.kind, note: adjForm.note },
      { onSuccess: () => { setAdjOpen(false); setAdjForm({ source: "cash", amount: "", kind: "adjustment", note: "" }); } }
    );
  };

  const openQuickAdjust = (source: "cash" | "card") => {
    const current = source === "cash" ? totalsBySource.cash : totalsBySource.card;
    setQuickAdjSource(source);
    setQuickAdjTarget(String(Math.round(current)));
    setQuickAdjNote("");
    setQuickAdjOpen(true);
  };

  const currentQuickBalance = quickAdjSource === "cash" ? totalsBySource.cash : totalsBySource.card;
  const quickDiff = Number(quickAdjTarget || 0) - currentQuickBalance;

  const submitQuickAdjust = () => {
    const target = Number(quickAdjTarget);
    if (Number.isNaN(target)) return;
    const current = quickAdjSource === "cash" ? totalsBySource.cash : totalsBySource.card;
    const diff = target - current;
    if (diff === 0) {
      setQuickAdjOpen(false);
      return;
    }
    addAdjustment.mutate(
      {
        source: quickAdjSource,
        amount: diff,
        kind: "adjustment",
        note: quickAdjNote || `${t("budget.quickAdjust")} ${sourceLabel(quickAdjSource)}`,
      },
      {
        onSuccess: () => {
          setQuickAdjOpen(false);
          setQuickAdjTarget("");
          setQuickAdjNote("");
        },
      }
    );
  };

  // ---------- Render ----------
  const catLabel = (id: string) => {
    const c = categories.find((c) => c.id === id);
    if (!c) return "—";
    return language === "es" ? c.label : c.label_en || c.label;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("budget.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("budget.subtitle")}</p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          className="cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-colors relative"
          onClick={() => openQuickAdjust("cash")}
          title={t("budget.clickToEdit") as string}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><Coins className="h-4 w-4" />{t("budget.cash")}</div>
              <Pencil className="h-3 w-3 opacity-50" />
            </div>
            <div className="text-2xl font-bold mt-1">{fmtMXN(totalsBySource.cash)}</div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-colors relative"
          onClick={() => openQuickAdjust("card")}
          title={t("budget.clickToEdit") as string}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" />{t("budget.card")}</div>
              <Pencil className="h-3 w-3 opacity-50" />
            </div>
            <div className="text-2xl font-bold mt-1">{fmtMXN(totalsBySource.card)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4" />{t("budget.totalAvailable")}</div>
            <div className="text-2xl font-bold mt-1">{fmtMXN(totalsBySource.total)}</div>
          </CardContent>
        </Card>
        <Card className={projectedDelta >= 0 ? "border-primary/30" : "border-destructive/30"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {projectedDelta >= 0 ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
              {t("budget.monthDelta")}
            </div>
            <div className={`text-2xl font-bold mt-1 ${projectedDelta >= 0 ? "" : "text-destructive"}`}>
              {fmtMXN(projectedDelta)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {t("budget.coverage")}: {(coverageRatio * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("budget.overview")}</TabsTrigger>
          <TabsTrigger value="recurring">{t("budget.recurring")}</TabsTrigger>
          <TabsTrigger value="ledger">{t("budget.ledger")}</TabsTrigger>
          <TabsTrigger value="balance">{t("budget.balance")}</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          {/* Coverage alert */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                {coverageRatio >= 1 ? (
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="text-sm">
                  <div className="font-medium">
                    {coverageRatio >= 1
                      ? t("budget.coverageOk")
                      : t("budget.coverageWarn")}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {t("budget.earningsThisMonth")}: <strong>{fmtMXN(earningsThisMonth)}</strong> ·{" "}
                    {t("budget.fixedMonthly")}: <strong>{fmtMXN(monthlyFixed)}</strong> ·{" "}
                    {t("budget.spentThisMonth")}: <strong>{fmtMXN(spentThisMonth)}</strong>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("budget.spendByCategory")}</CardTitle>
              </CardHeader>
              <CardContent>
                {byCategoryThisMonth.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">{t("budget.noSpend")}</div>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={byCategoryThisMonth}
                          dataKey="amount"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={(e: any) => fmtMXN(e.amount)}
                        >
                          {byCategoryThisMonth.map((c, i) => (
                            <Cell key={i} fill={c.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => fmtMXN(Number(v))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("budget.fixedBreakdown")}</CardTitle>
              </CardHeader>
              <CardContent>
                {recurring.filter((r) => r.is_active).length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">{t("budget.noRecurring")}</div>
                ) : (
                  <div className="space-y-2">
                    {recurring
                      .filter((r) => r.is_active)
                      .map((r) => {
                        const monthly = Number(r.amount) * (FREQ_MONTHLY_FACTOR[r.frequency as Frequency] ?? 0);
                        return (
                          <div key={r.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                            <div>
                              <div className="font-medium">{r.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {catLabel(r.category_id)} · {freqLabel(r.frequency)} · {fmtMXN(Number(r.amount))}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{fmtMXN(monthly)}</div>
                              <div className="text-[10px] text-muted-foreground">{t("budget.perMonth")}</div>
                            </div>
                          </div>
                        );
                      })}
                    <div className="flex items-center justify-between pt-2 text-sm font-semibold">
                      <span>{t("budget.total")}</span>
                      <span>{fmtMXN(monthlyFixed)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* RECURRING */}
        <TabsContent value="recurring" className="space-y-3">
          <div className="flex justify-end">
            {isAdmin && (
              <Button size="sm" onClick={openNewRecurring}>
                <Plus className="h-4 w-4 mr-1" />{t("budget.addRecurring")}
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("budget.name")}</TableHead>
                    <TableHead>{t("budget.category")}</TableHead>
                    <TableHead>{t("budget.frequency")}</TableHead>
                    <TableHead className="text-right">{t("budget.amount")}</TableHead>
                    <TableHead className="text-right">{t("budget.perMonth")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurring.map((r) => (
                    <TableRow key={r.id} className={!r.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{catLabel(r.category_id)}</TableCell>
                      <TableCell><Badge variant="outline">{freqLabel(r.frequency)}</Badge></TableCell>
                      <TableCell className="text-right">{fmtMXN(Number(r.amount))}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmtMXN(Number(r.amount) * (FREQ_MONTHLY_FACTOR[r.frequency as Frequency] ?? 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => openNewExpense("", r.category_id)} title={t("budget.markPaid") as string}>
                              <Receipt className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { setRecurringEdit(r); setRecurringOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteRecurring.mutate(r.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {recurring.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("budget.noRecurring")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEDGER */}
        <TabsContent value="ledger" className="space-y-3">
          <div className="flex justify-end">
            {isAdmin && (
              <Button size="sm" onClick={() => openNewExpense()}>
                <Plus className="h-4 w-4 mr-1" />{t("budget.addExpense")}
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("budget.date")}</TableHead>
                    <TableHead>{t("budget.category")}</TableHead>
                    <TableHead>{t("budget.source")}</TableHead>
                    <TableHead>{t("budget.note")}</TableHead>
                    <TableHead className="text-right">{t("budget.amount")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(e.paid_at), "dd MMM", { locale })}</TableCell>
                      <TableCell>{catLabel(e.category_id)}</TableCell>
                      <TableCell><Badge variant="outline">{sourceLabel(e.payment_source)}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{e.note}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtMXN(Number(e.amount))}</TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => deleteExpense.mutate(e.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {expenses.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("budget.noSpend")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BALANCE */}
        <TabsContent value="balance" className="space-y-3">
          <div className="flex justify-end">
            {isAdmin && (
              <Button size="sm" onClick={() => setAdjOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />{t("budget.addAdjustment")}
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              {t("budget.balanceHint")}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("budget.date")}</TableHead>
                    <TableHead>{t("budget.source")}</TableHead>
                    <TableHead>{t("budget.kind")}</TableHead>
                    <TableHead>{t("budget.note")}</TableHead>
                    <TableHead className="text-right">{t("budget.amount")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(a.created_at), "dd MMM yyyy", { locale })}</TableCell>
                      <TableCell><Badge variant="outline">{sourceLabel(a.source)}</Badge></TableCell>
                      <TableCell>{a.kind === "starting_balance" ? t("budget.startingBalance") : t("budget.adjustment")}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{a.note}</TableCell>
                      <TableCell className={`text-right font-semibold ${Number(a.amount) < 0 ? "text-destructive" : ""}`}>
                        {fmtMXN(Number(a.amount))}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => deleteAdjustment.mutate(a.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {adjustments.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("budget.noAdjustments")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add expense dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("budget.addExpense")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("budget.category")}</Label>
              <Select value={expForm.category_id} onValueChange={(v) => setExpForm((f) => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{language === "es" ? c.label : c.label_en || c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("budget.amount")}</Label>
              <Input type="number" inputMode="decimal" value={expForm.amount} onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>{t("budget.source")}</Label>
              <Select value={expForm.payment_source} onValueChange={(v) => setExpForm((f) => ({ ...f, payment_source: v as Source }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{sourceLabel("cash")}</SelectItem>
                  <SelectItem value="card">{sourceLabel("card")}</SelectItem>
                  <SelectItem value="other">{sourceLabel("other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("budget.note")}</Label>
              <Textarea value={expForm.note} onChange={(e) => setExpForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submitExpense} disabled={addExpense.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recurring dialog */}
      <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{recurringEdit?.id ? t("budget.editRecurring") : t("budget.addRecurring")}</DialogTitle></DialogHeader>
          {recurringEdit && (
            <div className="space-y-3">
              <div>
                <Label>{t("budget.name")}</Label>
                <Input value={recurringEdit.name} onChange={(e) => setRecurringEdit({ ...recurringEdit, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("budget.amount")}</Label>
                  <Input type="number" value={recurringEdit.amount} onChange={(e) => setRecurringEdit({ ...recurringEdit, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>{t("budget.frequency")}</Label>
                  <Select value={recurringEdit.frequency} onValueChange={(v) => setRecurringEdit({ ...recurringEdit, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["daily","weekly","biweekly","monthly","quarterly","yearly","one_time"] as Frequency[]).map((f) => (
                        <SelectItem key={f} value={f}>{freqLabel(f)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("budget.category")}</Label>
                  <Select value={recurringEdit.category_id} onValueChange={(v) => setRecurringEdit({ ...recurringEdit, category_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{language === "es" ? c.label : c.label_en || c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("budget.source")}</Label>
                  <Select value={recurringEdit.payment_source} onValueChange={(v) => setRecurringEdit({ ...recurringEdit, payment_source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{sourceLabel("cash")}</SelectItem>
                      <SelectItem value="card">{sourceLabel("card")}</SelectItem>
                      <SelectItem value="other">{sourceLabel("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />{t("budget.nextDueDate")}</Label>
                <Input
                  type="date"
                  value={recurringEdit.next_due_date ?? ""}
                  onChange={(e) => setRecurringEdit({ ...recurringEdit, next_due_date: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("budget.note")}</Label>
                <Textarea value={recurringEdit.notes} onChange={(e) => setRecurringEdit({ ...recurringEdit, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={recurringEdit.is_active} onCheckedChange={(v) => setRecurringEdit({ ...recurringEdit, is_active: v })} />
                <Label>{t("budget.active")}</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submitRecurring} disabled={upsertRecurring.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment dialog */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("budget.addAdjustment")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("budget.source")}</Label>
              <Select value={adjForm.source} onValueChange={(v) => setAdjForm((f) => ({ ...f, source: v as Source }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{sourceLabel("cash")}</SelectItem>
                  <SelectItem value="card">{sourceLabel("card")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("budget.amount")} <span className="text-xs text-muted-foreground">({t("budget.signedHint")})</span></Label>
              <Input type="number" value={adjForm.amount} onChange={(e) => setAdjForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>{t("budget.kind")}</Label>
              <Select value={adjForm.kind} onValueChange={(v) => setAdjForm((f) => ({ ...f, kind: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starting_balance">{t("budget.startingBalance")}</SelectItem>
                  <SelectItem value="adjustment">{t("budget.adjustment")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("budget.note")}</Label>
              <Textarea value={adjForm.note} onChange={(e) => setAdjForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submitAdjustment} disabled={addAdjustment.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick adjust balance dialog */}
      <Dialog open={quickAdjOpen} onOpenChange={setQuickAdjOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("budget.quickAdjust")} — {sourceLabel(quickAdjSource)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("budget.targetBalance")}</span>
              <span className="font-semibold">{fmtMXN(currentQuickBalance)}</span>
            </div>
            <div>
              <Label>{t("budget.targetBalance")}</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={quickAdjTarget}
                onChange={(e) => setQuickAdjTarget(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between text-sm rounded-md bg-muted p-2">
              <span className="text-muted-foreground">{t("budget.difference")}</span>
              <span className={`font-semibold ${quickDiff < 0 ? "text-destructive" : quickDiff > 0 ? "text-primary" : ""}`}>
                {quickDiff > 0 ? "+" : ""}{fmtMXN(quickDiff)}
              </span>
            </div>
            <div>
              <Label>{t("budget.note")}</Label>
              <Textarea value={quickAdjNote} onChange={(e) => setQuickAdjNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAdjOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submitQuickAdjust} disabled={addAdjustment.isPending || Number.isNaN(Number(quickAdjTarget))}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
