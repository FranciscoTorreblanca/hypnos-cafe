import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTillBalance } from "@/hooks/useBudgetSummary";

export interface TillTransaction {
  id: string;
  type: string; // 'payment' | 'adjustment_in' | 'adjustment_out'
  amount: number;
  note: string;
  payment_id: string | null;
  created_by: string;
  created_at: string;
  profile?: { full_name: string; email: string };
}

export const useTill = () => {
  const queryClient = useQueryClient();
  const { user, currentBusinessId } = useAuth();
  const confirmedBalance = useTillBalance();

  const query = useQuery({
    queryKey: ["till_transactions", currentBusinessId, user?.id],
    enabled: Boolean(user && currentBusinessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("till_transactions" as any)
        .select("*")
        .eq("business_id", currentBusinessId ?? "")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const userIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: pData } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
        profiles = pData ?? [];
      }

      return rows.map((r) => ({
        ...r,
        profile: profiles.find((p) => p.id === r.created_by),
      })) as TillTransaction[];
    },
  });

  const addTransaction = useMutation({
    mutationFn: async ({ type, amount, note, payment_id, category_id }: { type: string; amount: number; note: string; payment_id?: string; category_id?: string }) => {
      if (!user) throw new Error("Authentication required");
      const { error } = await (supabase.from("till_transactions" as any) as any).insert({
        type,
        amount,
        note,
        payment_id: payment_id || null,
        category_id: category_id || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["till_transactions"] });
      // Till movements are mirrored into budget cash adjustments by a DB trigger.
      queryClient.invalidateQueries({ queryKey: ["balance-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["expense-entries"] });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("till_transactions" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["till_transactions"] });
      // Till movements are mirrored into budget cash adjustments by a DB trigger.
      queryClient.invalidateQueries({ queryKey: ["balance-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["expense-entries"] });
    },
  });

  // Calculate current till balance
  const balance = confirmedBalance.data ?? 0;

  return { ...query, balance, balanceQuery: confirmedBalance, addTransaction, deleteTransaction };
};
