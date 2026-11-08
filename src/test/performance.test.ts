import { describe, it, expect } from "vitest";
import { breakEven, classifyMenu, prorateMonthly, statusLowerBetter, computeKpis, type PerformanceReport } from "@/lib/performance";

describe("performance helpers", () => {
  it("break-even = fixed / contribution margin", () => {
    expect(breakEven(21900, 0.3)).toBeCloseTo(31285.71, 1);
    expect(breakEven(1000, 1)).toBeNull();
  });
  it("prorates a monthly plan by days", () => {
    expect(prorateMonthly(30440, 7)).toBeCloseTo(7000, 5);
  });
  it("food cost status thresholds", () => {
    expect(statusLowerBetter(30, 35, 40)).toBe("good");
    expect(statusLowerBetter(37, 35, 40)).toBe("warn");
    expect(statusLowerBetter(42, 35, 40)).toBe("bad");
  });
  it("classifies menu engineering quadrants", () => {
    const r = classifyMenu([
      { id: "a", name: "A", name_en: "A", qty: 100, revenue: 5000, cost: 1000, has_cost: true },
      { id: "b", name: "B", name_en: "B", qty: 100, revenue: 2000, cost: 1500, has_cost: true },
      { id: "c", name: "C", name_en: "C", qty: 5, revenue: 500, cost: 50, has_cost: true },
      { id: "d", name: "D", name_en: "D", qty: 5, revenue: 100, cost: 90, has_cost: true },
    ]);
    expect(r.map((x) => x.quadrant)).toEqual(["star", "plowhorse", "puzzle", "dog"]);
  });
  it("operating profit subtracts fixed and variable spending but not recipe COGS", () => {
    const rep = { monthly_fixed_plan: 3044, fixed_plan_by_key: [], net_revenue: 10000, fixed_spent: 0, variable_spent: 1000,
      cogs: 3000, costed_revenue: 10000, item_revenue: 10000, gross_sales: 10500, orders: 100, items_sold: 200, tips: 0 } as unknown as PerformanceReport;
    const k = computeKpis(rep, new Date("2026-01-01"), new Date("2026-01-31"));
    expect(k.fixedCosts).toBeCloseTo(3000, 5);
    expect(k.operatingProfit).toBeCloseTo(6000, 5);
    expect(k.foodCostPct).toBeCloseTo(30, 5);
  });
});
