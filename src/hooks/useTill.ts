import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["till_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("till_transactions" as any)
        .select("*")
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
    mutationFn: async ({ type, amount, note, payment_id }: { type: string; amount: number; note: string; payment_id?: string }) => {
      const { error } = await (supabase.from("till_transactions" as any) as any).insert({
        type,
        amount,
        note,
        payment_id: payment_id || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["till_transactions"] }),
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("till_transactions" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["till_transactions"] }),
  });

  // Calculate current till balance
  const balance = (query.data ?? []).reduce((sum, t) => {
    if (t.type === "adjustment_out") return sum - t.amount;
    return sum + t.amount; // payment or adjustment_in
  }, 0);

  return { ...query, balance, addTransaction, deleteTransaction };
};
