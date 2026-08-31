import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, HandCoins, AlertTriangle } from "lucide-react";

type Source = "cash" | "card" | "other";

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

const emptyForm = {
  id: "",
  provider: "",
  description: "",
  amount: "",
  issued_at: format(new Date(), "yyyy-MM-dd"),
  due_date: "",
  payment_source: "cash" as Source,
  notes: "",
};

export default function DebtsTab() {
  const { language } = useLanguage();
  const { isAdmin, currentBusinessId } = useAuth();
  const qc = useQueryClient();
  const locale = language === "es" ? esLocale : enUS;
  const es = language === "es";
  const T = {
    title: es ? "Deudas con proveedores" : "Supplier debts",
    add: es ? "Nueva deuda" : "New debt",
    edit: es ? "Editar deuda" : "Edit debt",
    provider: es ? "Proveedor" : "Provider",
    description: es ? "Concepto" : "Description",
    amount: es ? "Monto" : "Amount",
    pending: es ? "Pendiente" : "Pending",
    paid: es ? "Pagado" : "Paid",
    issued: es ? "Desde" : "Since",
    due: es ? "Vence" : "Due",
    noDue: es ? "Sin fecha" : "No date",
    source: es ? "Fuente" : "Source",
    notes: es ? "Notas" : "Notes",
    save: es ? "Guardar" : "Save",
    cancel: es ? "Cancelar" : "Cancel",
    registerPayment: es ? "Registrar pago" : "Register payment",
    paymentAmount: es ? "Monto a pagar" : "Amount to pay",
    empty: es ? "Sin deudas registradas" : "No debts registered",
    totalDebt: es ? "Deuda total" : "Total debt",
    overdue: es ? "Vencida" : "Overdue",
    dueSoon: es ? "Por vencer" : "Due soon",
    settled: es ? "Liquidada" : "Settled",
    showSettled: es ? "Ver liquidadas" : "Show settled",
    hideSettled: es ? "Ocultar liquidadas" : "Hide settled",
    aging: es ? "Antigüedad" : "Aging",
    days: es ? "días" : "days",
    status: es ? "Estado" : "Status",
    logExpense: es ? "Registrar como gasto en el presupuesto" : "Record as budget expense",
  };
  const sourceLabel = (s: Source) => (es
    ? { cash: "Efectivo", card: "Tarjeta", other: "Otro" }[s]
    : { cash: "Cash", card: "Card", other: "Other" }[s]);

  const [showSettled, setShowSettled] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paySource, setPaySource] = useState<Source>("cash");
  const [payAsExpense, setPayAsExpense] = useState(true);

  const { data: debts = [] } = useQuery({
    queryKey: ["supplier-debts"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("supplier_debts") as any)
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const visible = useMemo(() => debts.filter((d) => showSettled || !d.is_settled), [debts, showSettled]);
  const outstanding = (d: any) => Math.max(0, Number(d.amount) - Number(d.paid_amount));
  const totalDebt = useMemo(
    () => debts.filter((d) => !d.is_settled).reduce((s, d) => s + outstanding(d), 0),
    [debts]
  );
  const overdueTotal = useMemo(
    () => debts.filter((d) => !d.is_settled && d.due_date && differenceInCalendarDays(parseISO(d.due_date), new Date()) < 0)
      .reduce((s, d) => s + outstanding(d), 0),
    [debts]
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["supplier-debts"] });
    qc.invalidateQueries({ queryKey: ["expense-entries"] });
  };

  const saveDebt = useMutation({
    mutationFn: async () => {
      const payload: any = {
        provider: form.provider.trim(),
        description: form.description.trim(),
        amount: Number(form.amount) || 0,
        issued_at: form.issued_at,
        due_date: form.due_date || null,
        payment_source: form.payment_source,
        notes: form.notes.trim(),
      };
      if (form.id) {
        const { error } = await (supabase.from("supplier_debts") as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("supplier_debts") as any)
          .insert({ ...payload, business_id: currentBusinessId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: es ? "Deuda guardada" : "Debt saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteDebt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("supplier_debts") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const payDebt = useMutation({
    mutationFn: async () => {
      const amount = Number(payAmount) || 0;
      if (amount <= 0) throw new Error(es ? "Monto inválido" : "Invalid amount");
      const nextPaid = Number(payTarget.paid_amount) + amount;
      const { error } = await (supabase.from("supplier_debts") as any)
        .update({ paid_amount: nextPaid, is_settled: nextPaid >= Number(payTarget.amount) - 0.001 })
        .eq("id", payTarget.id);
      if (error) throw error;
      if (payAsExpense) {
        const { error: expErr } = await (supabase.from("expense_entries") as any).insert({
          business_id: currentBusinessId,
          amount,
          payment_source: paySource,
          note: `${payTarget.provider}${payTarget.description ? ` - ${payTarget.description}` : ""}`,
          paid_at: new Date().toISOString(),
        });
        if (expErr) throw expErr;
      }
    },
    onSuccess: () => {
      invalidate();
      setPayOpen(false);
      toast({ title: es ? "Pago registrado" : "Payment registered" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusBadge = (d: any) => {
    if (d.is_settled) return <Badge variant="outline">{T.settled}</Badge>;
    if (!d.due_date) return <Badge variant="secondary">{T.pending}</Badge>;
    const days = differenceInCalendarDays(parseISO(d.due_date), new Date());
    if (days < 0) return <Badge variant="destructive">{T.overdue} · {Math.abs(days)}{es ? "d" : "d"}</Badge>;
    if (days <= 7) return <Badge className="bg-amber-500 text-white hover:bg-amber-500">{T.dueSoon} · {days}d</Badge>;
    return <Badge variant="secondary">{T.pending}</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HandCoins className="h-4 w-4" />{T.totalDebt}
            </div>
            <div className="text-2xl font-bold mt-1">{fmtMXN(totalDebt)}</div>
          </CardContent>
        </Card>
        <Card className={overdueTotal > 0 ? "border-destructive/40" : undefined}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />{T.overdue}
            </div>
            <div className={`text-2xl font-bold mt-1 ${overdueTotal > 0 ? "text-destructive" : ""}`}>{fmtMXN(overdueTotal)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowSettled((v) => !v)}>
          {showSettled ? T.hideSettled : T.showSettled}
        </Button>
        {isAdmin && (
          <Button size="sm" onClick={() => { setForm({ ...emptyForm }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />{T.add}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{T.provider}</TableHead>
                <TableHead>{T.issued}</TableHead>
                <TableHead>{T.due}</TableHead>
                <TableHead>{T.status}</TableHead>
                <TableHead className="text-right">{T.pending}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((d) => {
                const aging = differenceInCalendarDays(new Date(), parseISO(d.issued_at));
                return (
                  <TableRow key={d.id} className={d.is_settled ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="font-medium">{d.provider}</div>
                      {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
                      <div className="text-[11px] text-muted-foreground">
                        {fmtMXN(Number(d.paid_amount))} / {fmtMXN(Number(d.amount))} · {sourceLabel(d.payment_source)}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(parseISO(d.issued_at), "dd MMM yyyy", { locale })}
                      <div className="text-[11px] text-muted-foreground">{aging} {T.days}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {d.due_date ? format(parseISO(d.due_date), "dd MMM yyyy", { locale }) : T.noDue}
                    </TableCell>
                    <TableCell>{statusBadge(d)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMXN(outstanding(d))}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {isAdmin && (
                        <>
                          {!d.is_settled && (
                            <Button size="sm" variant="outline" className="mr-1" onClick={() => {
                              setPayTarget(d);
                              setPayAmount(String(outstanding(d)));
                              setPaySource((d.payment_source ?? "cash") as Source);
                              setPayAsExpense(true);
                              setPayOpen(true);
                            }}>
                              {T.registerPayment}
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => {
                            setForm({
                              id: d.id,
                              provider: d.provider,
                              description: d.description ?? "",
                              amount: String(d.amount),
                              issued_at: d.issued_at,
                              due_date: d.due_date ?? "",
                              payment_source: (d.payment_source ?? "cash") as Source,
                              notes: d.notes ?? "",
                            });
                            setOpen(true);
                          }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteDebt.mutate(d.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {visible.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{T.empty}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? T.edit : T.add}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{T.provider}</Label>
              <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Cervecería Carcosa" />
            </div>
            <div>
              <Label>{T.description}</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{T.amount}</Label>
                <Input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>{T.source}</Label>
                <Select value={form.payment_source} onValueChange={(v) => setForm({ ...form, payment_source: v as Source })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{sourceLabel("cash")}</SelectItem>
                    <SelectItem value="card">{sourceLabel("card")}</SelectItem>
                    <SelectItem value="other">{sourceLabel("other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{T.issued}</Label>
                <Input type="date" value={form.issued_at} onChange={(e) => setForm({ ...form, issued_at: e.target.value })} />
              </div>
              <div>
                <Label>{T.due}</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{T.notes}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{T.cancel}</Button>
            <Button disabled={!form.provider.trim() || !Number(form.amount) || saveDebt.isPending} onClick={() => saveDebt.mutate()}>
              {T.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{T.registerPayment}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {payTarget?.provider} · {fmtMXN(payTarget ? outstanding(payTarget) : 0)} {T.pending.toLowerCase()}
            </div>
            <div>
              <Label>{T.paymentAmount}</Label>
              <Input type="number" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div>
              <Label>{T.source}</Label>
              <Select value={paySource} onValueChange={(v) => setPaySource(v as Source)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{sourceLabel("cash")}</SelectItem>
                  <SelectItem value="card">{sourceLabel("card")}</SelectItem>
                  <SelectItem value="other">{sourceLabel("other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={payAsExpense} onChange={(e) => setPayAsExpense(e.target.checked)} />
              {T.logExpense}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>{T.cancel}</Button>
            <Button disabled={payDebt.isPending} onClick={() => payDebt.mutate()}>{T.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
