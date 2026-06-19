import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TillSession {
  id: string;
  business_id: string;
  status: "open" | "closed";
  opened_by: string;
  opened_at: string;
  opening_float: number;
  opening_notes: string | null;
  closed_by: string | null;
  closed_at: string | null;
  closing_counted: number | null;
  closing_expected: number | null;
  closing_difference: number | null;
  closing_denominations: Record<string, number> | null;
  closing_notes: string | null;
  z_report: any;
}

export interface TillXReport {
  session_id: string;
  status: string;
  opened_at: string;
  opening_float: number;
  cash_payments_total: number;
  cash_in_total: number;
  cash_out_total: number;
  transactions_count: number;
  expected_cash: number;
  payments_breakdown: Record<string, { count: number; amount: number; tip: number }>;
  generated_at: string;
  closed_at?: string | null;
  counted?: number;
  difference?: number;
  denominations?: Record<string, number> | null;
}

export const useCurrentTillSession = () => {
  return useQuery({
    queryKey: ["till_session", "current"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("current_till_session");
      if (error) throw error;
      return (data ?? null) as TillSession | null;
    },
    refetchInterval: 15000,
  });
};

export const useTillXReport = (sessionId: string | null | undefined) => {
  return useQuery({
    queryKey: ["till_x_report", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("till_x_report", { _session_id: sessionId });
      if (error) throw error;
      return data as TillXReport;
    },
    refetchInterval: 10000,
  });
};

export const useTillSessionsHistory = (limit = 30) => {
  return useQuery({
    queryKey: ["till_sessions", "history", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("till_sessions")
        .select("*")
        .order("opened_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as TillSession[];
    },
  });
};

export const useOpenTillSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ opening_float, notes }: { opening_float: number; notes?: string }) => {
      const { data, error } = await (supabase.rpc as any)("open_till_session", {
        _opening_float: opening_float,
        _notes: notes ?? null,
      });
      if (error) throw error;
      return data as TillSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["till_session"] });
      qc.invalidateQueries({ queryKey: ["till_sessions"] });
      qc.invalidateQueries({ queryKey: ["till_transactions"] });
    },
  });
};

export const useCloseTillSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      session_id, counted, denominations, notes,
    }: { session_id: string; counted: number; denominations?: Record<string, number>; notes?: string }) => {
      const { data, error } = await (supabase.rpc as any)("close_till_session", {
        _session_id: session_id,
        _counted: counted,
        _denominations: denominations ?? null,
        _notes: notes ?? null,
      });
      if (error) throw error;
      return data as TillSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["till_session"] });
      qc.invalidateQueries({ queryKey: ["till_sessions"] });
      qc.invalidateQueries({ queryKey: ["till_x_report"] });
      qc.invalidateQueries({ queryKey: ["till_transactions"] });
    },
  });
};
