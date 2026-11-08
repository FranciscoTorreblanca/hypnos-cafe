export type Status = "good" | "warn" | "bad" | "na";

export interface PerfItem { id: string; name: string; name_en: string; qty: number; revenue: number; cost: number; has_cost: boolean }
export interface PerfMonth { month: string; net_revenue: number; gross_sales: number; cogs: number; orders: number; fixed_spent: number; variable_spent: number }
export interface PerformanceReport {
  fetched_at: string; start: string; end: string; timezone: string; first_sale_at: string | null;
  monthly_fixed_plan: number;
  fixed_plan_by_key: { key: string; label: string; label_en: string; amount: number }[];
  gross_sales: number; net_revenue: number; tips: number; payment_count: number;
  by_method: { method: string; n: number; gross: number; net: number }[];
  orders: number; delivery_orders: number; items_sold: number; item_revenue: number;
  cogs: number; costed_revenue: number; fixed_spent: number; variable_spent: number;
  spent_by_category: { key: string; label: string; label_en: string; kind: string; amount: number }[];
  weekday: { dow: number; net: number; n: number; days: number }[];
  active_days: number; items: PerfItem[]; monthly: PerfMonth[];
}

/** Days in a range, at least 1. */
export const rangeDays = (start: Date, end: Date) => Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
/** Monthly plan prorated to the number of days (30.44-day average month). */
export const prorateMonthly = (monthly: number, days: number) => (monthly * days) / 30.44;

export const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);

/** Lower-is-better ratio vs. healthy max and alarm threshold. */
export function statusLowerBetter(value: number | null, goodMax: number, badMin: number): Status {
  if (value == null || !isFinite(value)) return "na";
  if (value <= goodMax) return "good";
  if (value >= badMin) return "bad";
  return "warn";
}
export function statusHigherBetter(value: number | null, goodMin: number, badMax: number): Status {
  if (value == null || !isFinite(value)) return "na";
  if (value >= goodMin) return "good";
  if (value <= badMax) return "bad";
  return "warn";
}

/**
 * Break-even revenue: fixed costs / contribution margin ratio.
 * Contribution margin = 1 - variable cost ratio (COGS share of revenue).
 */
export function breakEven(fixedCosts: number, variableCostRatio: number) {
  const cm = 1 - variableCostRatio;
  if (cm <= 0) return null;
  return fixedCosts / cm;
}

export type Quadrant = "star" | "plowhorse" | "puzzle" | "dog";
/** Menu engineering (Kasavana & Smith): popularity vs 70% of average share; margin vs weighted avg unit margin. */
export function classifyMenu(items: PerfItem[]): (PerfItem & { margin: number; unitMargin: number; quadrant: Quadrant })[] {
  const valid = items.filter((i) => i.qty > 0);
  const totalQty = valid.reduce((s, i) => s + i.qty, 0);
  if (!valid.length || totalQty === 0) return [];
  const popThreshold = (1 / valid.length) * 0.7 * totalQty;
  const totalMargin = valid.reduce((s, i) => s + (i.revenue - i.cost), 0);
  const avgUnitMargin = totalMargin / totalQty;
  return valid.map((i) => {
    const margin = i.revenue - i.cost;
    const unitMargin = margin / i.qty;
    const popular = i.qty >= popThreshold;
    const profitable = unitMargin >= avgUnitMargin;
    const quadrant: Quadrant = popular && profitable ? "star" : popular ? "plowhorse" : profitable ? "puzzle" : "dog";
    return { ...i, margin, unitMargin, quadrant };
  });
}

export interface Kpis {
  days: number; netRevenue: number; cogs: number; grossProfit: number; grossMarginPct: number | null;
  foodCostPct: number | null; laborPct: number | null; primeCostPct: number | null; occupancyPct: number | null;
  fixedCosts: number; laborCost: number; rentCost: number; variableSpent: number;
  operatingProfit: number; netMarginPct: number | null; breakEvenRevenue: number | null; breakEvenPct: number | null;
  breakEvenDaily: number | null; avgTicket: number | null; ordersPerDay: number; itemsPerOrder: number | null;
  tipRatePct: number | null; costCoveragePct: number | null;
}

/**
 * Fixed costs per period = max(prorated plan, actually paid fixed spending).
 * Operating profit (cash view, consistent with Budget) = net revenue - fixed - variable spending.
 * COGS from recipes is a theoretical cost used for margins, not subtracted again (supplies purchases already are).
 */
export function computeKpis(r: PerformanceReport, start: Date, end: Date): Kpis {
  const days = rangeDays(start, end);
  const planFor = (key: string) => prorateMonthly(r.fixed_plan_by_key.filter((f) => f.key === key).reduce((s, f) => s + Number(f.amount), 0), days);
  const fixedCosts = Math.max(prorateMonthly(r.monthly_fixed_plan, days), r.fixed_spent);
  const laborCost = planFor("payroll");
  const rentCost = planFor("rent");
  const netRevenue = r.net_revenue;
  const cogsRatio = r.costed_revenue > 0 ? r.cogs / r.costed_revenue : 0;
  const cogs = r.cogs;
  const grossProfit = netRevenue - cogs;
  const operatingProfit = netRevenue - fixedCosts - r.variable_spent;
  const be = breakEven(fixedCosts, cogsRatio);
  const foodCostPct = r.costed_revenue > 0 ? cogsRatio * 100 : null;
  const laborPct = pct(laborCost, netRevenue);
  return {
    days, netRevenue, cogs, grossProfit, grossMarginPct: pct(grossProfit, netRevenue),
    foodCostPct, laborPct,
    primeCostPct: foodCostPct != null && laborPct != null ? foodCostPct + laborPct : null,
    occupancyPct: pct(rentCost, netRevenue), fixedCosts, laborCost, rentCost, variableSpent: r.variable_spent,
    operatingProfit, netMarginPct: pct(operatingProfit, netRevenue),
    breakEvenRevenue: be, breakEvenPct: be ? (netRevenue / be) * 100 : null, breakEvenDaily: be ? be / days : null,
    avgTicket: r.orders > 0 ? r.gross_sales / r.orders : null, ordersPerDay: r.orders / days,
    itemsPerOrder: r.orders > 0 ? r.items_sold / r.orders : null, tipRatePct: pct(r.tips, r.gross_sales),
    costCoveragePct: pct(r.costed_revenue, r.item_revenue),
  };
}

export const KPI_TARGETS = {
  foodCost: [35, 40], labor: [35, 40], prime: [65, 70], occupancy: [10, 15], netMargin: [10, 3], grossMargin: [65, 55],
} as const;
