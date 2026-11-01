import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { format, differenceInCalendarDays, addDays, addMonths, addYears, parseISO } from "date-fns";
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
import { Wallet, CreditCard, Coins, TrendingDown, TrendingUp, Plus, Trash2, Pencil, AlertCircle, CheckCircle2, Receipt, CalendarClock, ArrowLeftRight, ArrowRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie, Legend } from "recharts";
import DebtsTab from "@/components/budget/DebtsTab";
import { useBudgetSummary } from "@/hooks/useBudgetSummary";
import { useOffline } from "@/offline/OfflineProvider";


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

const advanceDate = (d: Date, f: Frequency): Date => {
  switch (f) {
    case "daily": return addDays(d, 1);
    case "weekly": return addDays(d, 7);
    case "biweekly": return addDays(d, 14);
    case "monthly": return addMonths(d, 1);
    case "quarterly": return addMonths(d, 3);
    case "yearly": return addYears(d, 1);
    default: return d;
  }
};

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

export default function BudgetPage() {
  const { t, language } = useLanguage();
  const { user, isAdmin, currentBusinessId } = useAuth();
  const summary = useBudgetSummary();
  const { online, pending } = useOffline();
  const [expensePage, setExpensePage] = useState(0);
  const [adjustmentPage, setAdjustmentPage] = useState(0);
  const PAGE_SIZE = 50;
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
    queryKey: ["budget-categories", currentBusinessId, user?.id],
    enabled: Boolean(currentBusinessId && user),
    queryFn: async () => {
      const { data, error } = await (supabase.from("budget_categories") as any)
        .select("*")
        .eq("business_id", currentBusinessId)
        .order("display_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: recurring = [] } = useQuery({
    queryKey: ["recurring-expenses", currentBusinessId, user?.id],
    enabled: Boolean(currentBusinessId && user),
    queryFn: async () => {
      const { data, error } = await (supabase.from("recurring_expenses") as any)
        .select("*")
        .eq("business_id", currentBusinessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Ledger pages never participate in balance or monthly-summary calculations.
  const { data: expenseRows = [] , isFetching: expensesFetching } = useQuery({
    queryKey: ["expense-entries", currentBusinessId, user?.id, expensePage],
    enabled: Boolean(currentBusinessId && user),
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_entries")
        .select("*").eq("business_id", currentBusinessId ?? "")
        .order("paid_at", { ascending: false }).order("id")
        .range(expensePage * PAGE_SIZE, (expensePage + 1) * PAGE_SIZE);
      if (error) throw error;
      return data ?? [];
    },
  });
  const expenses = expenseRows.slice(0, PAGE_SIZE);
  const { data: adjustmentRows = [], isFetching: adjustmentsFetching } = useQuery({
    queryKey: ["balance-adjustments", currentBusinessId, user?.id, adjustmentPage],
    enabled: Boolean(currentBusinessId && user),
    queryFn: async () => {
      const { data, error } = await supabase.from("balance_adjustments")
        .select("*").eq("business_id", currentBusinessId ?? "")
        .order("created_at", { ascending: false }).order("id")
        .range(adjustmentPage * PAGE_SIZE, (adjustmentPage + 1) * PAGE_SIZE);
      if (error) throw error;
      return data ?? [];
    },
  });
  const adjustments = adjustmentRows.slice(0, PAGE_SIZE);
  const totalsBySource = {
    cash: summary.data?.cash ?? 0,
    card: summary.data?.card ?? 0,
    total: summary.data?.total ?? 0,
  };
  const monthlyFixed = summary.data?.monthly_fixed ?? 0;
  const earningsThisMonth = summary.data?.month_income ?? 0;
  const spentThisMonth = summary.data?.month_spent ?? 0;
  const fixedSpentThisMonth = summary.data?.month_fixed_spent ?? 0;
  const variableSpentThisMonth = summary.data?.month_variable_spent ?? 0;
  const totalCommitmentsThisMonth = monthlyFixed + variableSpentThisMonth;
  const projectedDelta = earningsThisMonth - totalCommitmentsThisMonth;
  const coverageRatio = totalCommitmentsThisMonth > 0 ? earningsThisMonth / totalCommitmentsThisMonth : 0;
  const byCategoryThisMonth = (summary.data?.by_category ?? []).map((c) => ({
    ...c, label: language === "es" ? c.label : c.label_en || c.label,
  }));

  // ---------- Mutations (admin only) ----------
  const addExpense = useMutation({
    mutationFn: async (payload: { category_id: string; amount: number; payment_source: Source; note: string; paid_at: string; recurring_id?: string | null }) => {
      const { error } = await (supabase.from("expense_entries") as any).insert({
        ...payload,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      (qc.invalidateQueries({ queryKey: ["expense-entries"] }), qc.invalidateQueries({ queryKey: ["till_transactions"] }));
      toast({ title: t("budget.expenseAdded") });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("expense_entries") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => (qc.invalidateQueries({ queryKey: ["expense-entries"] }), qc.invalidateQueries({ queryKey: ["till_transactions"] })),
  });

  const upsertRecurring = useMutation({
    mutationFn: async (r: any) => {
      if (r.id) {
        const { id, ...rest } = r;
        const { error } = await (supabase.from("recurring_expenses") as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("recurring_expenses") as any).insert({ ...r, created_by: user?.id });
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
      const { error } = await (supabase.from("balance_adjustments") as any).insert({ ...a, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      (qc.invalidateQueries({ queryKey: ["balance-adjustments"] }), qc.invalidateQueries({ queryKey: ["till_transactions"] }));
      toast({ title: t("budget.balanceAdjusted") });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteAdjustment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("balance_adjustments") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => (qc.invalidateQueries({ queryKey: ["balance-adjustments"] }), qc.invalidateQueries({ queryKey: ["till_transactions"] })),
  });

  // ---------- Dialogs state ----------
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expForm, setExpForm] = useState({ category_id: "", amount: "", payment_source: "card" as Source, note: "", recurring_id: "", paid_at: format(new Date(), "yyyy-MM-dd") });

  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringEdit, setRecurringEdit] = useState<any>(null);

  const [adjOpen, setAdjOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({ source: "cash" as Source, amount: "", kind: "adjustment", note: "" });

  const [quickAdjOpen, setQuickAdjOpen] = useState(false);
  const [quickAdjSource, setQuickAdjSource] = useState<"cash" | "card">("cash");
  const [quickAdjTarget, setQuickAdjTarget] = useState("");
  const [quickAdjNote, setQuickAdjNote] = useState("");

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ from: "cash" as "cash" | "card", to: "card" as "cash" | "card", amount: "", note: "" });

  const addTransfer = useMutation({
    mutationFn: async (p: { from: "cash" | "card"; to: "cash" | "card"; amount: number; note: string }) => {
      if (p.from === p.to) throw new Error(t("budget.sameSourceError") as string);
      const transferId = crypto.randomUUID();
      const baseNote = p.note?.trim() || (t("budget.transferNote") as string);
      const fromNote = `${baseNote} → ${sourceLabel(p.to)} [${transferId.slice(0, 8)}]`;
      const toNote = `${baseNote} ← ${sourceLabel(p.from)} [${transferId.slice(0, 8)}]`;
      // The till is the source of truth for cash: the cash leg is registered as a
      // till movement, which a DB trigger mirrors into the budget's cash balance.
      const { error: tillErr } = await (supabase.from("till_transactions") as any).insert({
        type: p.from === "cash" ? "adjustment_out" : "adjustment_in",
        amount: Math.abs(p.amount),
        note: p.from === "cash" ? fromNote : toNote,
        created_by: user?.id,
      });
      if (tillErr) throw tillErr;
      // Only the card leg is written directly to the budget.
      const { error } = await (supabase.from("balance_adjustments") as any).insert([
        p.from === "card"
          ? { source: "card", amount: -Math.abs(p.amount), kind: "transfer", note: fromNote, created_by: user?.id }
          : { source: "card", amount: Math.abs(p.amount), kind: "transfer", note: toNote, created_by: user?.id },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      (qc.invalidateQueries({ queryKey: ["balance-adjustments"] }), qc.invalidateQueries({ queryKey: ["till_transactions"] }));
      qc.invalidateQueries({ queryKey: ["till_transactions"] });
      toast({ title: t("budget.transferDone") });
      setTransferOpen(false);
      setTransferForm({ from: "cash", to: "card", amount: "", note: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openNewExpense = (recurring_id = "", category_id = "") => {
    setExpForm({ category_id: category_id || categories[0]?.id || "", amount: "", payment_source: "card", note: "", recurring_id, paid_at: format(new Date(), "yyyy-MM-dd") });
    setExpenseOpen(true);
  };

  const openMarkPaid = (r: any) => {
    setExpForm({
      category_id: r.category_id || categories[0]?.id || "",
      amount: String(r.amount ?? ""),
      payment_source: (r.payment_source as Source) || "card",
      note: r.name || "",
      recurring_id: r.id,
      paid_at: format(new Date(), "yyyy-MM-dd"),
    });
    setExpenseOpen(true);
  };

  const submitExpense = () => {
    const amt = Number(expForm.amount);
    if (!expForm.category_id || !amt) return;
    const recurring_id = expForm.recurring_id || null;
    const paidAtIso = expForm.paid_at
      ? new Date(`${expForm.paid_at}T12:00:00`).toISOString()
      : new Date().toISOString();
    addExpense.mutate(
      {
        category_id: expForm.category_id,
        amount: amt,
        payment_source: expForm.payment_source,
        note: expForm.note,
        paid_at: paidAtIso,
        recurring_id,
      } as any,
      {
        onSuccess: async () => {
          if (recurring_id) {
            const r = recurring.find((x) => x.id === recurring_id);
            if (r && r.frequency && r.frequency !== "one_time") {
              const paidDate = new Date(paidAtIso);
              const due = r.next_due_date ? parseISO(r.next_due_date) : paidDate;
              // Advance from whichever is later: the paid date or the original due date
              const base = paidDate > due ? paidDate : due;
              const next = advanceDate(base, r.frequency as Frequency);
              await (supabase.from("recurring_expenses") as any)
                .update({ next_due_date: format(next, "yyyy-MM-dd") })
                .eq("id", recurring_id);
              qc.invalidateQueries({ queryKey: ["recurring-expenses"] });
            }
          }
          setExpenseOpen(false);
        },
      }
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
    if (!summary.data || !online || summary.isFetching) return;
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

  const lastPaidByRecurring = new Map((summary.data?.last_paid ?? []).map((entry) => [entry.recurring_id, entry.paid_at]));

  const dueStatus = (r: any): { days: number | null; tone: "ok" | "upcoming" | "soon" | "overdue" | "none"; label: string } => {
    if (!r.next_due_date) return { days: null, tone: "none", label: "—" };
    const d = parseISO(r.next_due_date);
    const days = differenceInCalendarDays(d, new Date());
    if (days < 0) return { days, tone: "overdue", label: `${Math.abs(days)}d ${language === "es" ? "vencido" : "overdue"}` };
    if (days === 0) return { days, tone: "soon", label: language === "es" ? "Hoy" : "Today" };
    if (days <= 3) return { days, tone: "soon", label: language === "es" ? `En ${days}d` : `In ${days}d` };
    if (days <= 7) return { days, tone: "upcoming", label: language === "es" ? `En ${days}d` : `In ${days}d` };
    return { days, tone: "ok", label: language === "es" ? `En ${days}d` : `In ${days}d` };
  };

  const toneClasses = (tone: string) => {
    switch (tone) {
      case "overdue": return "bg-destructive/15 text-destructive border-destructive/30";
      case "soon": return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30";
      case "upcoming": return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
      case "ok": return "bg-primary/10 text-primary border-primary/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const isPaidThisPeriod = (r: any): boolean => {
    const last = lastPaidByRecurring.get(r.id);
    if (!last) return false;
    if (!r.next_due_date) return false;
    // Paid for current cycle if last paid date is after (next_due_date - cycle length)
    const next = parseISO(r.next_due_date);
    // Determine cycle start = next - frequency
    let cycleStart: Date;
    const f = r.frequency as Frequency;
    switch (f) {
      case "daily": cycleStart = addDays(next, -1); break;
      case "weekly": cycleStart = addDays(next, -7); break;
      case "biweekly": cycleStart = addDays(next, -14); break;
      case "monthly": cycleStart = addMonths(next, -1); break;
      case "quarterly": cycleStart = addMonths(next, -3); break;
      case "yearly": cycleStart = addYears(next, -1); break;
      default: return !!last;
    }
    return new Date(last) >= cycleStart;
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("budget.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("budget.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="status">
        {summary.data && <span>{language === "es" ? "Última confirmación" : "Last confirmed"}: {format(new Date(summary.data.fetched_at), "dd MMM HH:mm", { locale })}</span>}
        {!online && <Badge variant="outline">{language === "es" ? "Sin conexión · saldo guardado" : "Offline · saved balance"}</Badge>}
        {pending.some((entry) => entry.kind === "payment.create") && <Badge variant="outline">{language === "es" ? "Pagos pendientes de sincronizar" : "Payments pending synchronization"}</Badge>}
        {summary.isFetching && <span>{language === "es" ? "Actualizando…" : "Updating…"}</span>}
        {summary.isError && <span className="text-destructive">{language === "es" ? "No se pudo confirmar el saldo" : "Could not confirm the balance"}</span>}
        <Button variant="ghost" size="sm" disabled={!online || summary.isFetching} onClick={() => void summary.refetch()}>{language === "es" ? "Actualizar" : "Refresh"}</Button>
      </div>
      {summary.data && summary.data.delivery_pending > 0 && <div className="text-sm text-muted-foreground">{language === "es" ? "Delivery por cobrar (neto)" : "Delivery receivable (net)"}: {fmtMXN(summary.data.delivery_pending)}</div>}

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
            <div className="text-2xl font-bold mt-1">{summary.data ? fmtMXN(totalsBySource.cash) : "—"}</div>
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
            <div className="text-2xl font-bold mt-1">{summary.data ? fmtMXN(totalsBySource.card) : "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4" />{t("budget.totalAvailable")}</div>
            <div className="text-2xl font-bold mt-1">{summary.data ? fmtMXN(totalsBySource.total) : "—"}</div>
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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">{t("budget.overview")}</TabsTrigger>
          <TabsTrigger value="recurring">{t("budget.recurring")}</TabsTrigger>
          <TabsTrigger value="ledger">{t("budget.ledger")}</TabsTrigger>
          <TabsTrigger value="balance">{t("budget.balance")}</TabsTrigger>
          <TabsTrigger value="debts">{language === "es" ? "Deudas" : "Debts"}</TabsTrigger>
        </TabsList>

        <TabsContent value="debts" className="space-y-3">
          <DebtsTab />
        </TabsContent>


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
                <div className="text-sm flex-1">
                  <div className="font-medium">
                    {coverageRatio >= 1
                      ? t("budget.coverageOk")
                      : t("budget.coverageWarn")}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {language === "es"
                      ? "Ingresos del mes vs. costos fijos + costos variables (insumos, mantenimiento, etc.)."
                      : "This month's income vs. fixed costs + variable costs (supplies, maintenance, etc.)."}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    <div className="rounded-md border p-2">
                      <div className="text-[11px] text-muted-foreground">{t("budget.earningsThisMonth")}</div>
                      <div className="font-semibold">{fmtMXN(earningsThisMonth)}</div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-[11px] text-muted-foreground">{t("budget.fixedMonthly")}</div>
                      <div className="font-semibold">{fmtMXN(monthlyFixed)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {language === "es" ? "Pagado" : "Paid"}: {fmtMXN(fixedSpentThisMonth)}
                      </div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-[11px] text-muted-foreground">
                        {language === "es" ? "Costos variables" : "Variable costs"}
                      </div>
                      <div className="font-semibold">{fmtMXN(variableSpentThisMonth)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {language === "es" ? "Gasto total" : "Total spend"}: {fmtMXN(spentThisMonth)}
                      </div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-[11px] text-muted-foreground">
                        {language === "es" ? "Resultado" : "Result"}
                      </div>
                      <div className={`font-semibold ${projectedDelta >= 0 ? "text-primary" : "text-destructive"}`}>
                        {fmtMXN(projectedDelta)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {t("budget.coverage")}: {(coverageRatio * 100).toFixed(0)}%
                      </div>
                    </div>
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
                    <TableHead>{t("budget.nextDueDate")}</TableHead>
                    <TableHead>{t("budget.status")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurring.map((r) => {
                    const status = dueStatus(r);
                    const paid = isPaidThisPeriod(r);
                    const lastPaid = lastPaidByRecurring.get(r.id);
                    return (
                      <TableRow key={r.id} className={!r.is_active ? "opacity-50" : ""}>
                        <TableCell className="font-medium">
                          {r.name}
                          {lastPaid && (
                            <div className="text-[10px] text-muted-foreground">
                              {t("budget.lastPaid")}: {format(new Date(lastPaid), "dd MMM", { locale })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{catLabel(r.category_id)}</TableCell>
                        <TableCell><Badge variant="outline">{freqLabel(r.frequency)}</Badge></TableCell>
                        <TableCell className="text-right">{fmtMXN(Number(r.amount))}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {r.next_due_date ? format(parseISO(r.next_due_date), "dd MMM yyyy", { locale }) : "—"}
                        </TableCell>
                        <TableCell>
                          {paid ? (
                            <Badge className="bg-primary/15 text-primary border-primary/30" variant="outline">
                              <CheckCircle2 className="h-3 w-3 mr-1" />{t("budget.paid")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={toneClasses(status.tone)}>
                              {status.tone === "overdue" && <AlertCircle className="h-3 w-3 mr-1" />}
                              {status.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" onClick={() => openMarkPaid(r)} title={t("budget.markPaid") as string}>
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
                    );
                  })}
                  {recurring.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("budget.noRecurring")}</TableCell></TableRow>
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
          <div className="flex justify-end items-center gap-2">
            <Button variant="outline" size="sm" disabled={expensePage === 0 || expensesFetching} onClick={() => setExpensePage((p) => p - 1)}>{language === "es" ? "Anterior" : "Previous"}</Button>
            <span className="text-sm">{expensePage + 1}</span>
            <Button variant="outline" size="sm" disabled={expenseRows.length <= PAGE_SIZE || expensesFetching} onClick={() => setExpensePage((p) => p + 1)}>{language === "es" ? "Siguiente" : "Next"}</Button>
          </div>
        </TabsContent>

        {/* BALANCE */}
        <TabsContent value="balance" className="space-y-3">
          <div className="flex justify-end gap-2">
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
                <ArrowLeftRight className="h-4 w-4 mr-1" />{t("budget.transfer")}
              </Button>
            )}
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
                      <TableCell>{a.kind === "starting_balance" ? t("budget.startingBalance") : a.kind === "transfer" ? t("budget.transfer") : a.kind === "till" ? (language === "es" ? "Caja" : "Till") : t("budget.adjustment")}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{a.note}</TableCell>
                      <TableCell className={`text-right font-semibold ${Number(a.amount) < 0 ? "text-destructive" : ""}`}>
                        {fmtMXN(Number(a.amount))}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Till movements are mirrored automatically — the till is the source of truth. */}
                        {isAdmin && a.kind !== "till" && (
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
          <div className="flex justify-end items-center gap-2">
            <Button variant="outline" size="sm" disabled={adjustmentPage === 0 || adjustmentsFetching} onClick={() => setAdjustmentPage((p) => p - 1)}>{language === "es" ? "Anterior" : "Previous"}</Button>
            <span className="text-sm">{adjustmentPage + 1}</span>
            <Button variant="outline" size="sm" disabled={adjustmentRows.length <= PAGE_SIZE || adjustmentsFetching} onClick={() => setAdjustmentPage((p) => p + 1)}>{language === "es" ? "Siguiente" : "Next"}</Button>
          </div>
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
              <Label className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />{t("budget.paidAt")}</Label>
              <Input
                type="date"
                value={expForm.paid_at}
                onChange={(e) => setExpForm((f) => ({ ...f, paid_at: e.target.value }))}
              />
              {expForm.recurring_id && (() => {
                const r = recurring.find((x) => x.id === expForm.recurring_id);
                if (!r?.next_due_date || !expForm.paid_at) return null;
                const diff = differenceInCalendarDays(parseISO(expForm.paid_at), parseISO(r.next_due_date));
                if (diff > 0) {
                  return (
                    <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {language === "es" ? `Pago tardío: ${diff}d después de la fecha límite` : `Late payment: ${diff}d past due date`}
                    </div>
                  );
                }
                return (
                  <div className="text-xs text-primary mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {language === "es"
                      ? diff === 0 ? "A tiempo (el día límite)" : `A tiempo (${Math.abs(diff)}d antes)`
                      : diff === 0 ? "On time (due today)" : `On time (${Math.abs(diff)}d early)`}
                  </div>
                );
              })()}
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

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />{t("budget.transferBetween")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <div>
                <Label>{t("budget.from")}</Label>
                <Select value={transferForm.from} onValueChange={(v) => setTransferForm((f) => ({ ...f, from: v as "cash" | "card", to: v === f.to ? (v === "cash" ? "card" : "cash") : f.to }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{sourceLabel("cash")}</SelectItem>
                    <SelectItem value="card">{sourceLabel("card")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {fmtMXN(transferForm.from === "cash" ? totalsBySource.cash : totalsBySource.card)}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 mb-8 text-muted-foreground" />
              <div>
                <Label>{t("budget.to")}</Label>
                <Select value={transferForm.to} onValueChange={(v) => setTransferForm((f) => ({ ...f, to: v as "cash" | "card", from: v === f.from ? (v === "cash" ? "card" : "cash") : f.from }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{sourceLabel("cash")}</SelectItem>
                    <SelectItem value="card">{sourceLabel("card")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {fmtMXN(transferForm.to === "cash" ? totalsBySource.cash : totalsBySource.card)}
                </div>
              </div>
            </div>
            <div>
              <Label>{t("budget.amount")}</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={transferForm.amount}
                onChange={(e) => setTransferForm((f) => ({ ...f, amount: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <Label>{t("budget.note")}</Label>
              <Textarea value={transferForm.note} onChange={(e) => setTransferForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => addTransfer.mutate({ from: transferForm.from, to: transferForm.to, amount: Number(transferForm.amount), note: transferForm.note })}
              disabled={addTransfer.isPending || !Number(transferForm.amount) || transferForm.from === transferForm.to}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
