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
      parts: {
        amount: number;
        tip: number;
        payment_method: string;
        evidence_reference?: string | null;
        evidence_file?: File | null;
      }[];
    }) => {
      if (!parts.length) throw new Error("No payment parts provided");

      // If offline OR Mercado Pago not needed: enqueue everything and update cache.
      const cardParts = parts.filter((p) => p.payment_method === "card");
      const cardTotal = cardParts.reduce((s, p) => s + p.amount + p.tip, 0);
      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      const ids = parts.map(() => crypto.randomUUID());

      // Upload any transfer evidence images before enqueueing the insert.
      // Only when online — offline we still keep the textual reference.
      const evidenceUrls: (string | null)[] = parts.map(() => null);
      if (isOnline && currentBusinessId) {
        for (let i = 0; i < parts.length; i++) {
          const file = parts[i].evidence_file;
          if (!file) continue;
          try {
            const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
            const path = `${currentBusinessId}/${ids[i]}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("payment-evidence")
              .upload(path, file, { upsert: true, contentType: file.type || undefined });
            if (!upErr) evidenceUrls[i] = path;
            else console.warn("[payments] evidence upload failed", upErr);
          } catch (e) {
            console.warn("[payments] evidence upload error", e);
          }
        }
      }

      // Try Mercado Pago for card when online + configured. Skip silently on failure → still enqueue.
      let mpResult: any = null;
      if (isOnline && cardTotal > 0 && currentBusinessId) {
        try {
          const mpConfig = await getMpConfig(currentBusinessId);
          if (mpConfig?.enabled) {
            mpResult = await sendToPointMini(mpConfig.deviceId, cardTotal, order_id, currentBusinessId);
          }
        } catch (e) {
          console.warn("[payments] MP card terminal unavailable", e);
        }
      }

      // Optimistic: mark order as paid in the orders cache
      queryClient.setQueryData<any[]>(["orders"], (old) => {
        if (!old) return old;
        return old.map((o) => (o.id === order_id ? { ...o, status: "paid", _pending: !isOnline } : o));
      });

      // Optimistic: add payment rows to the payments cache
      const optimisticRows = parts.map((p, i) => ({
        id: ids[i], order_id, amount: p.amount, tip: p.tip,
        payment_method: p.payment_method, created_by: user!.id,
        created_at: new Date().toISOString(),
        evidence_url: evidenceUrls[i], evidence_reference: p.evidence_reference ?? null,
      }));
      queryClient.setQueryData<any[]>(["payments"], (old) => [...optimisticRows, ...(old ?? [])]);

      // Build enqueue-safe parts (strip File objects, attach uploaded url)
      const safeParts = parts.map((p, i) => ({
        amount: p.amount,
        tip: p.tip,
        payment_method: p.payment_method,
        evidence_url: evidenceUrls[i],
        evidence_reference: p.evidence_reference ?? null,
      }));

      // Enqueue (auto-runs if online)
      const { enqueue } = await import("@/offline/enqueue");
      await enqueue("payment.create", {
        order_id, parts: safeParts, ids, created_by: user!.id,
      }, { label: `Payment · order ${order_id.slice(0, 6)}` });

      return { mpResult, payment_id: ids[0], payment_ids: ids, order_id, parts };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["till_transactions"] });

      // Best-effort push notification — must run even if any DB lookup fails.
      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (!isOnline || !currentBusinessId || !result?.order_id) return;
      try {
        const parts = result.parts ?? [];
        const totalAmount = parts.reduce((s: number, p: any) => s + p.amount, 0);
        const totalTip = parts.reduce((s: number, p: any) => s + (p.tip || 0), 0);
        const methodLabel = parts.length > 1 ? "split" : (parts[0]?.payment_method || "");

        // Pull table_number / waiter from cache first; fall back to DB.
        const cachedOrder = (queryClient.getQueryData<any[]>(["orders"]) ?? []).find(
          (o) => o.id === result.order_id,
        );
        let tableNumber: number | string = cachedOrder?.table_number ?? "?";
        if (tableNumber === "?" && result.order_id) {
          const { data: orderData } = await supabase
            .from("orders").select("table_number").eq("id", result.order_id).maybeSingle();
          if (orderData?.table_number != null) tableNumber = orderData.table_number;
        }

        let waiterName = user?.email || "Mesero";
        try {
          const { data: profile } = await supabase
            .from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
          if (profile?.full_name) waiterName = profile.full_name;
        } catch {}

        console.log("[push] firing order_paid", { order_id: result.order_id, totalAmount, methodLabel });
        await triggerPushNotification("order_paid", {
          amount: totalAmount,
          tip: totalTip,
          payment_method: methodLabel,
          waiter_name: waiterName,
          table_number: tableNumber,
          order_id: result.order_id,
          paid_at: new Date().toISOString(),
        }, currentBusinessId);
      } catch (e) {
        console.error("[push] order_paid failed to fire", e);
      }
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
