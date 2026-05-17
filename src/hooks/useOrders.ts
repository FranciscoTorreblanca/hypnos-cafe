import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { applyLineDiscount } from "@/lib/discounts";

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  discount_amount: number;
  notes: string;
  status: string;
  created_at: string;
  combo_id?: string | null;
  combo_group_id?: string | null;
  menu_item?: { name: string; name_en: string };
  combo?: { name: string; name_en: string } | null;
}

export interface Order {
  id: string;
  table_number: number;
  status: "pending" | "in_progress" | "completed" | "ready" | "served" | "paid" | "cancelled";
  notes: string;
  created_by: string;
  total: number;
  general_discount: number;
  general_discount_amount: number;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export const useOrders = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["orders"],
    staleTime: 30 * 1000, // 30s cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, menu_items(name, name_en), combos(name, name_en))")
        .in("status", ["pending", "in_progress", "completed", "ready", "served"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        ...o,
        order_items: (o.order_items ?? []).map((oi: any) => ({
          ...oi,
          menu_item: oi.menu_items,
          combo: oi.combos ?? null,
        })),
      })) as Order[];
    },
  });

  const createOrder = useMutation({
    mutationFn: async (tableNumber: number) => {
      const { data, error } = await supabase
        .from("orders")
        .insert({ table_number: tableNumber, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as Order;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Order["status"] }) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const updateItemStatus = useMutation({
    mutationFn: async ({ id, status, order_id }: { id: string; status: string; order_id: string }) => {
      const { error } = await supabase.from("order_items").update({ status } as any).eq("id", id);
      if (error) throw error;
      // Check if all items in this order are ready
      const { data: items } = await supabase
        .from("order_items")
        .select("status")
        .eq("order_id", order_id);
      const allReady = (items ?? []).every((i: any) => i.status === "ready");
      if (allReady && items && items.length > 0) {
        await supabase.from("orders").update({ status: "ready" as any }).eq("id", order_id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const recalcOrderTotal = async (order_id: string) => {
    const { data: items } = await supabase
      .from("order_items")
      .select("quantity, unit_price, discount, discount_amount")
      .eq("order_id", order_id);
    const total = (items ?? []).reduce(
      (s, i: any) =>
        s + applyLineDiscount(i.quantity * i.unit_price, i.discount ?? 0, i.discount_amount ?? 0),
      0,
    );
    await supabase.from("orders").update({ total }).eq("id", order_id);
  };

  const addItem = useMutation({
    mutationFn: async ({
      order_id,
      menu_item_id,
      quantity,
      unit_price,
      notes,
      discount,
      discount_amount,
      combo_id,
      combo_group_id,
    }: {
      order_id: string;
      menu_item_id: string;
      quantity: number;
      unit_price: number;
      notes?: string;
      discount?: number;
      discount_amount?: number;
      combo_id?: string;
      combo_group_id?: string;
    }) => {
      const { error } = await supabase
        .from("order_items")
        .insert({
          order_id,
          menu_item_id,
          quantity,
          unit_price,
          notes: notes ?? "",
          discount: discount ?? 0,
          discount_amount: discount_amount ?? 0,
          combo_id: combo_id ?? null,
          combo_group_id: combo_group_id ?? null,
        } as any);
      if (error) throw error;
      await recalcOrderTotal(order_id);
      // If order was already sent to kitchen, keep it in_progress
      const { data: order } = await supabase.from("orders").select("status").eq("id", order_id).single();
      if (order && (order.status === "ready" || order.status === "served")) {
        await supabase.from("orders").update({ status: "in_progress" as any }).eq("id", order_id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const addItemsBulk = useMutation({
    mutationFn: async ({
      order_id,
      items,
    }: {
      order_id: string;
      items: Array<{
        menu_item_id: string;
        quantity: number;
        unit_price: number;
        notes?: string;
        discount?: number;
        discount_amount?: number;
        combo_id?: string;
        combo_group_id?: string;
      }>;
    }) => {
      if (items.length === 0) return;
      const rows = items.map((c) => ({
        order_id,
        menu_item_id: c.menu_item_id,
        quantity: c.quantity,
        unit_price: c.unit_price,
        notes: c.notes ?? "",
        discount: c.discount ?? 0,
        discount_amount: c.discount_amount ?? 0,
        combo_id: c.combo_id ?? null,
        combo_group_id: c.combo_group_id ?? null,
      }));
      const { error } = await supabase.from("order_items").insert(rows as any);
      if (error) throw error;
      await recalcOrderTotal(order_id);
      const { data: order } = await supabase.from("orders").select("status").eq("id", order_id).single();
      if (order && (order.status === "ready" || order.status === "served")) {
        await supabase.from("orders").update({ status: "in_progress" as any }).eq("id", order_id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const removeItem = useMutation({
    mutationFn: async ({ id, order_id }: { id: string; order_id: string }) => {
      const { error } = await supabase.from("order_items").delete().eq("id", id);
      if (error) throw error;
      const { data: items } = await supabase
        .from("order_items")
        .select("id")
        .eq("order_id", order_id);
      if (!items || items.length === 0) {
        await supabase.from("orders").update({ status: "cancelled" as any }).eq("id", order_id);
      } else {
        await recalcOrderTotal(order_id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const updateItemDiscount = useMutation({
    mutationFn: async ({ id, discount, order_id }: { id: string; discount: number; order_id: string }) => {
      const { error } = await supabase.from("order_items").update({ discount } as any).eq("id", id);
      if (error) throw error;
      await recalcOrderTotal(order_id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const updateItemDiscountAmount = useMutation({
    mutationFn: async ({ id, discount_amount, order_id }: { id: string; discount_amount: number; order_id: string }) => {
      const { error } = await supabase
        .from("order_items")
        .update({ discount_amount: Math.max(0, discount_amount) } as any)
        .eq("id", id);
      if (error) throw error;
      await recalcOrderTotal(order_id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const updateGeneralDiscount = useMutation({
    mutationFn: async ({ id, discount }: { id: string; discount: number }) => {
      const { error } = await supabase.from("orders").update({ general_discount: discount } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const updateGeneralDiscountAmount = useMutation({
    mutationFn: async ({ id, discount_amount }: { id: string; discount_amount: number }) => {
      const { error } = await supabase
        .from("orders")
        .update({ general_discount_amount: Math.max(0, discount_amount) } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const cancelOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error: itemsError } = await supabase.from("order_items").delete().eq("order_id", id);
      if (itemsError) throw itemsError;
      const { error } = await supabase.from("orders").update({ status: "cancelled" as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const getActiveOrderForTable = (tableNumber: number) =>
    (query.data ?? []).find(
      (o) => o.table_number === tableNumber && !["paid", "cancelled"].includes(o.status)
    );

  return {
    ...query,
    createOrder,
    updateOrderStatus,
    updateItemStatus,
    addItem,
    addItemsBulk,
    removeItem,
    cancelOrder,
    updateItemDiscount,
    updateItemDiscountAmount,
    updateGeneralDiscount,
    updateGeneralDiscountAmount,
    getActiveOrderForTable,
  };
};
