import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  tip: number;
  payment_method: string;
  created_by: string;
  created_at: string;
  order?: {
    table_number: number;
    total: number;
    created_at: string;
  };
  waiter?: {
    full_name: string;
    email: string;
  };
}

/** Check if Mercado Pago is enabled and configured */
async function getMpConfig(): Promise<{ enabled: boolean; deviceId: string } | null> {
  const { data } = await supabase
    .from("restaurant_settings")
    .select("key, value")
    .in("key", ["mp_enabled", "mp_device_id", "mp_token_set"]);

  if (!data) return null;
  const map: Record<string, string> = {};
  data.forEach((s) => (map[s.key] = s.value));

  if (map.mp_enabled === "true" && map.mp_device_id && map.mp_token_set === "true") {
    return { enabled: true, deviceId: map.mp_device_id };
  }
  return null;
}

/** Send payment intent to Mercado Pago Point Mini */
async function sendToPointMini(deviceId: string, amount: number, orderId: string) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/mercadopago-payment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: deviceId,
        amount,
        description: `Orden ${orderId.slice(0, 8)}`,
        external_reference: orderId,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "MP error");
  return data;
}

export const usePayments = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, orders(table_number, total, created_at, created_by)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch waiter profiles for each payment
      const waiterIds = [...new Set((data ?? []).map((p: any) => p.orders?.created_by).filter(Boolean))];
      let profiles: any[] = [];
      if (waiterIds.length > 0) {
        const { data: pData } = await supabase.from("profiles").select("id, full_name, email").in("id", waiterIds);
        profiles = pData ?? [];
      }

      return (data ?? []).map((p: any) => ({
        ...p,
        order: p.orders ? { table_number: p.orders.table_number, total: p.orders.total, created_at: p.orders.created_at } : undefined,
        waiter: profiles.find((pr) => pr.id === p.orders?.created_by),
      })) as Payment[];
    },
  });

  const createPayment = useMutation({
    mutationFn: async ({
      order_id,
      amount,
      tip,
      payment_method,
    }: {
      order_id: string;
      amount: number;
      tip: number;
      payment_method: string;
    }) => {
      // If card payment, check if MP is configured and send to Point Mini
      let mpResult: any = null;
      if (payment_method === "card") {
        const mpConfig = await getMpConfig();
        if (mpConfig?.enabled) {
          mpResult = await sendToPointMini(mpConfig.deviceId, amount + tip, order_id);
        }
      }

      const { data: paymentData, error } = await supabase.from("payments").insert({
        order_id,
        amount,
        tip,
        payment_method,
        created_by: user!.id,
      }).select("id").single();
      if (error) throw error;

      // Mark order as paid and reset general discount
      const { error: upErr } = await supabase.from("orders").update({ status: "paid" as any, general_discount: 0 } as any).eq("id", order_id);
      if (upErr) throw upErr;

      // Till entry is auto-created by database trigger for cash payments

      return { mpResult };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["till_transactions"] });
    },
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, amount, tip, payment_method }: { id: string; amount: number; tip: number; payment_method: string }) => {
      const { error } = await supabase.from("payments").update({ amount, tip, payment_method }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  });

  const deletePayment = useMutation({
    mutationFn: async ({ id, revertToServed }: { id: string; revertToServed: boolean }) => {
      const { data: payment } = await supabase.from("payments").select("order_id").eq("id", id).single();
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
      if (payment?.order_id && revertToServed) {
        await supabase.from("orders").update({ status: "served" as any }).eq("id", payment.order_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  return { ...query, createPayment, updatePayment, deletePayment };
};
