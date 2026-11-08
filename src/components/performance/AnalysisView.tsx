import { useMemo, useState } from "react";
import { format, startOfMonth, subMonths, startOfDay, subDays, addDays, startOfQuarter, subYears } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePerformanceReport } from "@/hooks/usePerformance";
import { computeKpis, classifyMenu, statusLowerBetter, statusHigherBetter, KPI_TARGETS, type Status, type Quadrant } from "@/lib/performance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Lightbulb, Target } from "lucide-react";
import { cn } from "@/lib/utils";

type Preset = "lastMonth" | "thisMonth" | "last7" | "last30" | "quarter" | "sinceOpening" | "last12";
type Compare = "previous" | "lastYear";

const money = (v: number | null | undefined) => v == null ? "—" : `$${Math.round(v).toLocaleString("es-MX")}`;
const pctFmt = (v: number | null | undefined) => v == null ? "—" : `${v.toFixed(1)}%`;

function buildRange(p: Preset): { start: Date; end: Date } {
  const now = new Date();
  const tomorrow = startOfDay(addDays(now, 1));
  switch (p) {
    case "thisMonth": return { start: startOfMonth(now), end: tomorrow };
    case "last7": return { start: startOfDay(subDays(now, 6)), end: tomorrow };
    case "last30": return { start: startOfDay(subDays(now, 29)), end: tomorrow };
    case "quarter": return { start: startOfQuarter(now), end: tomorrow };
    case "last12": return { start: startOfMonth(subMonths(now, 11)), end: tomorrow };
    case "sinceOpening": return { start: startOfMonth(subMonths(now, 23)), end: tomorrow };
    default: return { start: startOfMonth(subMonths(now, 1)), end: startOfMonth(now) };
  }
}

const statusClass: Record<Status, string> = {
  good: "border-l-4 border-l-primary", warn: "border-l-4 border-l-accent", bad: "border-l-4 border-l-destructive", na: "",
};

export default function AnalysisView() {
  const { language } = useLanguage();
  const es_ = language === "es";
  const L = (a: string, b: string) => (es_ ? a : b);
  const loc = es_ ? es : enUS;
  const [preset, setPreset] = useState<Preset>("lastMonth");
  const [compare, setCompare] = useState<Compare>("previous");

  const range = useMemo(() => buildRange(preset), [preset]);
  const prevRange = useMemo(() => {
    if (compare === "lastYear") return { start: subYears(range.start, 1), end: subYears(range.end, 1) };
    const len = range.end.getTime() - range.start.getTime();
    return { start: new Date(range.start.getTime() - len), end: range.start };
  }, [range, compare]);

  const q = usePerformanceReport(range.start, range.end);
  const pq = usePerformanceReport(prevRange.start, prevRange.end, preset !== "sinceOpening");
  const r = q.data;

  // For "since opening", start from first sale.
  const effStart = useMemo(() => {
    if (preset === "sinceOpening" && r?.first_sale_at) return new Date(r.first_sale_at);
    return range.start;
  }, [preset, r, range.start]);
  const effEnd = useMemo(() => (range.end > new Date() ? new Date() : range.end), [range.end]);

  const k = useMemo(() => (r ? computeKpis(r, effStart, effEnd) : null), [r, effStart, effEnd]);
  const pk = useMemo(() => (pq.data ? computeKpis(pq.data, prevRange.start, prevRange.end > new Date() ? new Date() : prevRange.end) : null), [pq.data, prevRange]);
  const menu = useMemo(() => (r ? classifyMenu(r.items.filter((i) => i.has_cost)) : []), [r]);

  const monthly = useMemo(() => {
    if (!r) return [];
    const first = r.first_sale_at ? startOfMonth(new Date(r.first_sale_at)) : null;
    let cum = 0;
    return r.monthly
      .filter((m) => !first || new Date(m.month) >= first)
      .map((m) => {
        const fixed = Math.max(r.monthly_fixed_plan, m.fixed_spent);
        const profit = m.net_revenue - fixed - m.variable_spent;
        cum += profit;
        return { label: format(new Date(m.month), "MMM yy", { locale: loc }), revenue: m.net_revenue, cogs: m.cogs, fixed, variable: m.variable_spent, profit, cumulative: cum, orders: m.orders };
      });
  }, [r, loc]);

  const insights = useMemo(() => {
    if (!k || !r) return [] as string[];
    const out: string[] = [];
    if (k.operatingProfit >= 0) out.push(L(`El periodo fue rentable: utilidad operativa de ${money(k.operatingProfit)} (${pctFmt(k.netMarginPct)} de margen).`, `The period was profitable: operating profit ${money(k.operatingProfit)} (${pctFmt(k.netMarginPct)} margin).`));
    else out.push(L(`El periodo tuvo pérdida de ${money(-k.operatingProfit)}. Faltan ${money((k.breakEvenRevenue ?? 0) - k.netRevenue)} de ventas netas para el punto de equilibrio.`, `The period lost ${money(-k.operatingProfit)}. ${money((k.breakEvenRevenue ?? 0) - k.netRevenue)} more net sales were needed to break even.`));
    if (pk && pk.netRevenue > 0) {
      const ch = ((k.netRevenue - pk.netRevenue) / pk.netRevenue) * 100;
      out.push(L(`Ventas netas ${ch >= 0 ? "subieron" : "bajaron"} ${Math.abs(ch).toFixed(1)}% vs el periodo de comparación.`, `Net sales ${ch >= 0 ? "rose" : "fell"} ${Math.abs(ch).toFixed(1)}% vs the comparison period.`));
    }
    if (k.foodCostPct != null && pk?.foodCostPct != null && Math.abs(k.foodCostPct - pk.foodCostPct) >= 2)
      out.push(L(`El costo de insumos cambió ${(k.foodCostPct - pk.foodCostPct).toFixed(1)} pts.`, `Food cost changed ${(k.foodCostPct - pk.foodCostPct).toFixed(1)} pts.`));
    if (k.costCoveragePct != null && k.costCoveragePct < 90)
      out.push(L(`Solo ${pctFmt(k.costCoveragePct)} de las ventas tiene receta con costo; completa recetas para márgenes más precisos.`, `Only ${pctFmt(k.costCoveragePct)} of sales have a costed recipe; complete recipes for accurate margins.`));
    if (k.breakEvenDaily && r.weekday.length) {
      const below = r.weekday.filter((w) => w.days > 0 && Number(w.net) / w.days < k.breakEvenDaily!);
      const names = below.map((w) => format(addDays(new Date(2024, 0, 1), w.dow - 1), "EEEE", { locale: loc }));
      if (names.length) out.push(L(`Días por debajo del equilibrio diario (${money(k.breakEvenDaily)}): ${names.join(", ")}.`, `Days below daily break-even (${money(k.breakEvenDaily)}): ${names.join(", ")}.`));
    }
    const delivery = r.by_method.find((m) => m.method === "delivery");
    if (delivery && Number(delivery.gross) > 0)
      out.push(L(`Delivery retiene ${pctFmt((Number(delivery.net) / Number(delivery.gross)) * 100)} de su venta tras comisión e IVA.`, `Delivery keeps ${pctFmt((Number(delivery.net) / Number(delivery.gross)) * 100)} of its sales after commission and VAT.`));
    const dogs = menu.filter((m) => m.quadrant === "dog").sort((a, b) => a.margin - b.margin).slice(0, 3);
    if (dogs.length) out.push(L(`Productos con baja venta y bajo margen: ${dogs.map((d) => d.name).join(", ")}. Evalúa rediseñar o retirar.`, `Low-selling, low-margin items: ${dogs.map((d) => d.name_en || d.name).join(", ")}. Consider redesigning or removing.`));
    if (monthly.length > 1) {
      const last = monthly[monthly.length - 1];
      out.push(last.cumulative >= 0
        ? L(`Utilidad acumulada desde apertura: ${money(last.cumulative)}.`, `Cumulative profit since opening: ${money(last.cumulative)}.`)
        : L(`Acumulado desde apertura: ${money(last.cumulative)} (aún sin recuperar).`, `Cumulative since opening: ${money(last.cumulative)} (not yet recovered).`));
    }
    return out;
  }, [k, pk, r, menu, monthly, es_]);

  const Delta = ({ cur, prev, inverse }: { cur: number | null; prev: number | null | undefined; inverse?: boolean }) => {
    if (cur == null || prev == null || prev === 0) return null;
    const ch = ((cur - prev) / Math.abs(prev)) * 100;
    const good = inverse ? ch <= 0 : ch >= 0;
    return (
      <span className={cn("flex items-center gap-1 text-xs", good ? "text-primary" : "text-destructive")}>
        {ch >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(ch).toFixed(1)}%
      </span>
    );
  };

  const Kpi = ({ label, value, hint, status = "na", cur, prev, inverse }: { label: string; value: string; hint?: string; status?: Status; cur?: number | null; prev?: number | null; inverse?: boolean }) => (
    <Card className={statusClass[status]}>
      <CardContent className="p-4 space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        <div className="flex items-center justify-between gap-2">
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
          {cur !== undefined && <Delta cur={cur ?? null} prev={prev} inverse={inverse} />}
        </div>
      </CardContent>
    </Card>
  );

  const quadLabel: Record<Quadrant, [string, string, string]> = {
    star: [L("Estrella", "Star"), L("Mantener y destacar", "Keep and feature"), "default"],
    plowhorse: [L("Caballo de batalla", "Plowhorse"), L("Popular, bajo margen: ajustar precio o receta", "Popular, low margin: adjust price or recipe"), "secondary"],
    puzzle: [L("Enigma", "Puzzle"), L("Buen margen, poca venta: promocionar", "Good margin, low sales: promote"), "outline"],
    dog: [L("Perro", "Dog"), L("Bajo margen y venta: rediseñar o retirar", "Low margin and sales: rework or remove"), "destructive"],
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="lastMonth">{L("Mes pasado", "Last month")}</SelectItem>
            <SelectItem value="thisMonth">{L("Este mes", "This month")}</SelectItem>
            <SelectItem value="last7">{L("Últimos 7 días", "Last 7 days")}</SelectItem>
            <SelectItem value="last30">{L("Últimos 30 días", "Last 30 days")}</SelectItem>
            <SelectItem value="quarter">{L("Este trimestre", "This quarter")}</SelectItem>
            <SelectItem value="last12">{L("Últimos 12 meses", "Last 12 months")}</SelectItem>
            <SelectItem value="sinceOpening">{L("Desde apertura", "Since opening")}</SelectItem>
          </SelectContent>
        </Select>
        {preset !== "sinceOpening" && (
          <Select value={compare} onValueChange={(v) => setCompare(v as Compare)}>
            <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="previous">{L("vs periodo anterior", "vs previous period")}</SelectItem>
              <SelectItem value="lastYear">{L("vs mismo periodo año pasado", "vs same period last year")}</SelectItem>
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-muted-foreground self-center">
          {format(effStart, "dd MMM yyyy", { locale: loc })} – {format(addDays(effEnd, -0), "dd MMM yyyy", { locale: loc })}
          {r && ` · ${L("actualizado", "updated")} ${format(new Date(r.fetched_at), "HH:mm")}`}
        </p>
      </div>

      {q.isLoading || !k || !r ? (
        q.error ? <p className="text-destructive text-sm">{(q.error as Error).message}</p> :
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">{L("Rentabilidad", "Profitability")}</h2>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Kpi label={L("Ventas netas", "Net revenue")} value={money(k.netRevenue)} hint={L("Tras comisiones e IVA delivery", "After commissions & delivery VAT")} cur={k.netRevenue} prev={pk?.netRevenue} />
              <Kpi label={L("Utilidad operativa", "Operating profit")} value={money(k.operatingProfit)} hint={`${L("Margen", "Margin")} ${pctFmt(k.netMarginPct)} · ${L("meta", "target")} ≥10%`}
                status={statusHigherBetter(k.netMarginPct, KPI_TARGETS.netMargin[0], KPI_TARGETS.netMargin[1])} cur={k.operatingProfit} prev={pk?.operatingProfit} />
              <Kpi label={L("Margen bruto", "Gross margin")} value={pctFmt(k.grossMarginPct)} hint={money(k.grossProfit)}
                status={statusHigherBetter(k.grossMarginPct, KPI_TARGETS.grossMargin[0], KPI_TARGETS.grossMargin[1])} cur={k.grossMarginPct} prev={pk?.grossMarginPct} />
              <Kpi label={L("Costo de insumos", "Food & beverage cost")} value={pctFmt(k.foodCostPct)} hint={`${L("meta", "target")} 28–35%`}
                status={statusLowerBetter(k.foodCostPct, KPI_TARGETS.foodCost[0], KPI_TARGETS.foodCost[1])} cur={k.foodCostPct} prev={pk?.foodCostPct} inverse />
              <Kpi label={L("Costo de personal", "Labor cost")} value={pctFmt(k.laborPct)} hint={`${money(k.laborCost)} · ${L("meta", "target")} 25–35%`}
                status={statusLowerBetter(k.laborPct, KPI_TARGETS.labor[0], KPI_TARGETS.labor[1])} cur={k.laborPct} prev={pk?.laborPct} inverse />
              <Kpi label={L("Costo primo", "Prime cost")} value={pctFmt(k.primeCostPct)} hint={`${L("Insumos + personal", "Food + labor")} · ≤65%`}
                status={statusLowerBetter(k.primeCostPct, KPI_TARGETS.prime[0], KPI_TARGETS.prime[1])} cur={k.primeCostPct} prev={pk?.primeCostPct} inverse />
              <Kpi label={L("Costo de renta", "Occupancy cost")} value={pctFmt(k.occupancyPct)} hint={`${money(k.rentCost)} · ≤10%`}
                status={statusLowerBetter(k.occupancyPct, KPI_TARGETS.occupancy[0], KPI_TARGETS.occupancy[1])} cur={k.occupancyPct} prev={pk?.occupancyPct} inverse />
              <Kpi label={L("Gastos fijos + variables", "Fixed + variable spending")} value={money(k.fixedCosts + k.variableSpent)} hint={`${L("Fijos", "Fixed")} ${money(k.fixedCosts)} · ${L("Var.", "Var.")} ${money(k.variableSpent)}`} cur={k.fixedCosts + k.variableSpent} prev={pk ? pk.fixedCosts + pk.variableSpent : null} inverse />
            </div>
          </section>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />{L("Punto de equilibrio", "Break-even")}</CardTitle>
              <CardDescription>{L("Ventas netas necesarias para cubrir gastos fijos con el margen actual.", "Net sales needed to cover fixed costs at the current margin.")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span>{money(k.netRevenue)}</span><span className="text-muted-foreground">{L("de", "of")} {money(k.breakEvenRevenue)}</span></div>
              <Progress value={Math.min(100, k.breakEvenPct ?? 0)} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">{L("Alcanzado", "Achieved")}</p><p className="font-semibold">{pctFmt(k.breakEvenPct)}</p></div>
                <div><p className="text-muted-foreground text-xs">{L("Equilibrio diario", "Daily break-even")}</p><p className="font-semibold">{money(k.breakEvenDaily)}</p></div>
                <div><p className="text-muted-foreground text-xs">{L("Órdenes/día necesarias", "Orders/day needed")}</p><p className="font-semibold">{k.breakEvenDaily && k.avgTicket ? Math.ceil(k.breakEvenDaily / k.avgTicket) : "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">{L("Órdenes/día actuales", "Current orders/day")}</p><p className="font-semibold">{k.ordersPerDay.toFixed(1)}</p></div>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-2">
            <h2 className="font-semibold">{L("Operación", "Operations")}</h2>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Kpi label={L("Ticket promedio", "Average ticket")} value={money(k.avgTicket)} cur={k.avgTicket} prev={pk?.avgTicket} />
              <Kpi label={L("Órdenes", "Orders")} value={String(r.orders)} hint={`${k.ordersPerDay.toFixed(1)} ${L("por día", "per day")}`} cur={r.orders} prev={pq.data?.orders} />
              <Kpi label={L("Productos por orden", "Items per order")} value={k.itemsPerOrder?.toFixed(2) ?? "—"} cur={k.itemsPerOrder} prev={pk?.itemsPerOrder} />
              <Kpi label={L("Propinas", "Tips")} value={money(r.tips)} hint={pctFmt(k.tipRatePct)} cur={r.tips} prev={pq.data?.tips} />
            </div>
          </section>

          {insights.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4" />{L("Hallazgos", "Insights")}</CardTitle></CardHeader>
              <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{insights.map((s, i) => <li key={i}>{s}</li>)}</ul></CardContent>
            </Card>
          )}

          {monthly.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{L("Estado de resultados mensual", "Monthly P&L")}</CardTitle>
                <CardDescription>{L("Gastos fijos = mayor entre lo planeado y lo pagado en el mes.", "Fixed = higher of planned and actually paid that month.")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip formatter={(v: number) => money(v)} />
                      <Legend />
                      <ReferenceLine y={0} className="stroke-muted-foreground" />
                      <Bar dataKey="revenue" name={L("Ventas netas", "Net revenue")} fill="hsl(var(--primary))" />
                      <Bar dataKey="profit" name={L("Utilidad", "Profit")} fill="hsl(var(--accent))" />
                      <Line dataKey="cumulative" name={L("Acumulado", "Cumulative")} stroke="hsl(var(--foreground))" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{L("Mes", "Month")}</TableHead><TableHead className="text-right">{L("Ventas", "Revenue")}</TableHead>
                      <TableHead className="text-right">{L("Costo receta", "Recipe cost")}</TableHead><TableHead className="text-right">{L("Fijos", "Fixed")}</TableHead>
                      <TableHead className="text-right">{L("Variables", "Variable")}</TableHead><TableHead className="text-right">{L("Utilidad", "Profit")}</TableHead>
                      <TableHead className="text-right">{L("Acumulado", "Cumulative")}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{monthly.map((m) => (
                      <TableRow key={m.label}>
                        <TableCell className="capitalize">{m.label}</TableCell><TableCell className="text-right">{money(m.revenue)}</TableCell>
                        <TableCell className="text-right">{money(m.cogs)}</TableCell><TableCell className="text-right">{money(m.fixed)}</TableCell>
                        <TableCell className="text-right">{money(m.variable)}</TableCell>
                        <TableCell className={cn("text-right font-medium", m.profit < 0 && "text-destructive")}>{money(m.profit)}</TableCell>
                        <TableCell className={cn("text-right", m.cumulative < 0 && "text-destructive")}>{money(m.cumulative)}</TableCell>
                      </TableRow>))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {menu.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{L("Ingeniería de menú", "Menu engineering")}</CardTitle>
                <CardDescription>{L("Popularidad vs margen por unidad (solo productos con costo).", "Popularity vs unit margin (costed items only).")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(["star", "plowhorse", "puzzle", "dog"] as Quadrant[]).map((qd) => {
                  const list = menu.filter((m) => m.quadrant === qd).sort((a, b) => b.margin - a.margin);
                  if (!list.length) return null;
                  return (
                    <div key={qd}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={quadLabel[qd][2] as any}>{quadLabel[qd][0]}</Badge>
                        <span className="text-xs text-muted-foreground">{quadLabel[qd][1]}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {list.slice(0, 15).map((m) => (
                          <span key={m.id} className="text-xs rounded border px-2 py-1">{es_ ? m.name : m.name_en || m.name} · {m.qty} · {money(m.unitMargin)}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{L("Desglose de gastos", "Spending breakdown")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {r.spent_by_category.map((c) => (
                    <TableRow key={c.key + c.kind}>
                      <TableCell>{es_ ? c.label : c.label_en}</TableCell>
                      <TableCell><Badge variant="outline">{c.kind === "fixed" ? L("Fijo", "Fixed") : L("Variable", "Variable")}</Badge></TableCell>
                      <TableCell className="text-right">{money(Number(c.amount))}</TableCell>
                    </TableRow>
                  ))}
                  {!r.spent_by_category.length && <TableRow><TableCell className="text-muted-foreground text-sm">{L("Sin gastos registrados en el periodo.", "No spending recorded in this period.")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
