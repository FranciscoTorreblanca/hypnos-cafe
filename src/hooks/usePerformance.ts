import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PerformanceReport } from "@/lib/performance";

const num = (v: unknown) => Number(v ?? 0);

export function usePerformanceReport(start: Date, end: Date, enabled = true) {
  const { user, currentBusinessId, isAdmin, isSuperAdmin } = useAuth();
  return useQuery<PerformanceReport>({
    queryKey: ["performance-report", currentBusinessId, user?.id, start.toISOString(), end.toISOString()],
    enabled: enabled && Boolean(user && currentBusinessId && (isAdmin || isSuperAdmin)),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("performance_report", {
        _business_id: currentBusinessId, _start: start.toISOString(), _end: end.toISOString(),
      });
      if (error) throw error;
      const r = data as PerformanceReport;
      for (const k of ["monthly_fixed_plan", "gross_sales", "net_revenue", "tips", "item_revenue", "cogs", "costed_revenue", "fixed_spent", "variable_spent", "items_sold", "orders"] as const) {
        (r as any)[k] = num((r as any)[k]);
      }
      r.items = (r.items ?? []).map((i) => ({ ...i, qty: num(i.qty), revenue: num(i.revenue), cost: num(i.cost) }));
      r.monthly = (r.monthly ?? []).map((m) => ({ ...m, net_revenue: num(m.net_revenue), gross_sales: num(m.gross_sales), cogs: num(m.cogs), orders: num(m.orders), fixed_spent: num(m.fixed_spent), variable_spent: num(m.variable_spent) }));
      return r;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
