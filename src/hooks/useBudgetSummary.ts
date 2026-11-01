import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface BudgetSummary {
  business_id: string;
  fetched_at: string;
  month_start: string;
  cash: number;
  card: number;
  total: number;
  delivery_pending: number;
  payment_count: number;
  monthly_fixed: number;
  month_income: number;
  month_spent: number;
  month_fixed_spent: number;
  month_variable_spent: number;
  by_category: { id: string; label: string; label_en: string; color: string; amount: number }[];
  last_paid: { recurring_id: string; paid_at: string }[];
}

export function useBudgetSummary() {
  const { user, currentBusinessId, isAdmin, isSuperAdmin } = useAuth();
  return useQuery<BudgetSummary>({
    queryKey: ["budget-summary", currentBusinessId, user?.id],
    enabled: Boolean(user && currentBusinessId && (isAdmin || isSuperAdmin)),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("budget_summary", { _business_id: currentBusinessId });
      if (error) throw error;
      if (!data || data.business_id !== currentBusinessId) throw new Error("Invalid business summary");
      return data as BudgetSummary;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    networkMode: "online",
  });
}

export function useTillBalance() {
  const { user, currentBusinessId } = useAuth();
  return useQuery<number>({
    queryKey: ["till-balance", currentBusinessId, user?.id],
    enabled: Boolean(user && currentBusinessId),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("till_balance", { _business_id: currentBusinessId });
      if (error) throw error;
      return Number(data);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    networkMode: "online",
  });
}