import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { triggerPushNotification } from "@/hooks/usePushNotifications";

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

/** Check if Mercado Pago is enabled and configured for the given business */
async function getMpConfig(businessId: string): Promise<{ enabled: boolean; deviceId: string } | null> {
  const { data } = await supabase
    .from("restaurant_settings")
    .select("key, value")
    .eq("business_id", businessId)
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
async function sendToPointMini(deviceId: string, amount: number, orderId: string, businessId: string) {
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
        business_id: businessId,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "MP error");
  return data;
}

export const usePayments = () => {
  const queryClient = useQueryClient();
  const { user, currentBusinessId } = useAuth();

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

  /**
   * Create one or more payment rows for a single order.
   * - Pass a single `parts` entry for a regular payment (cash OR card).
   * - Pass two entries to split a payment across cash + card.
   * The DB trigger `auto_till_on_cash_payment` only inserts till entries for cash rows,
   * so the till naturally reflects only the cash portion.
   */
  const createPayment = useMutation({
    mutationFn: async ({
      order_id,
      parts,
    }: {
      order_id: string;
      parts: { amount: number; tip: number; payment_method: string }[];
    }) => {
      if (!parts.length) throw new Error("No payment parts provided");

      // Send card portion to Mercado Pago Point Mini if configured (sum all card parts)
      let mpResult: any = null;
      const cardParts = parts.filter((p) => p.payment_method === "card");
      const cardTotal = cardParts.reduce((s, p) => s + p.amount + p.tip, 0);
      if (cardTotal > 0) {
        const mpConfig = await getMpConfig();
        if (mpConfig?.enabled) {
          mpResult = await sendToPointMini(mpConfig.deviceId, cardTotal, order_id);
        }
      }

      // Insert all payment rows
      const { data: inserted, error } = await supabase
        .from("payments")
        .insert(
          parts.map((p) => ({
            order_id,
            amount: p.amount,
            tip: p.tip,
            payment_method: p.payment_method,
            created_by: user!.id,
          })),
        )
        .select("id, payment_method");
      if (error) throw error;

      // Mark order as paid — preserve general_discount / general_discount_amount
      // so history and tickets can reproduce the actual charged amount.
      const { error: upErr } = await supabase
        .from("orders")
        .update({ status: "paid" as any } as any)
        .eq("id", order_id);
      if (upErr) throw upErr;

      // Notification (fire and forget) — combine totals
      const totalAmount = parts.reduce((s, p) => s + p.amount, 0);
      const totalTip = parts.reduce((s, p) => s + p.tip, 0);
      const methodLabel = parts.length > 1 ? "split" : parts[0].payment_method;
      const { data: orderData } = await supabase
        .from("orders").select("table_number").eq("id", order_id).single();
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", user!.id).single();
      triggerPushNotification("order_paid", {
        amount: totalAmount,
        tip: totalTip,
        payment_method: methodLabel,
        waiter_name: profile?.full_name || user!.email || "Mesero",
        table_number: orderData?.table_number ?? "?",
        order_id,
      });

      return {
        mpResult,
        payment_id: inserted?.[0]?.id ?? null,
        payment_ids: (inserted ?? []).map((r) => r.id),
      };
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
