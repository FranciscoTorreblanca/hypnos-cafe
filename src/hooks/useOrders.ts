import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  notes: string;
  status: string;
  created_at: string;
  menu_item?: { name: string; name_en: string };
}

export interface Order {
  id: string;
  table_number: number;
  status: "pending" | "in_progress" | "completed" | "ready" | "served" | "paid" | "cancelled";
  notes: string;
  created_by: string;
  total: number;
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
        .select("*, order_items(*, menu_items(name, name_en))")
        .in("status", ["pending", "in_progress", "completed", "ready", "served"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        ...o,
        order_items: (o.order_items ?? []).map((oi: any) => ({
          ...oi,
          menu_item: oi.menu_items,
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

  const addItem = useMutation({
    mutationFn: async ({
      order_id,
      menu_item_id,
      quantity,
      unit_price,
      notes,
    }: {
      order_id: string;
      menu_item_id: string;
      quantity: number;
      unit_price: number;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("order_items")
        .insert({ order_id, menu_item_id, quantity, unit_price, notes: notes ?? "", discount: discount ?? 0 } as any);
      if (error) throw error;
      const { data: items } = await supabase
        .from("order_items")
        .select("quantity, unit_price, discount")
        .eq("order_id", order_id);
      const total = (items ?? []).reduce((s, i: any) => s + i.quantity * i.unit_price * (1 - (i.discount ?? 0) / 100), 0);
      await supabase.from("orders").update({ total }).eq("id", order_id);
      // If order was already sent to kitchen, keep it in_progress
      const { data: order } = await supabase.from("orders").select("status").eq("id", order_id).single();
      if (order && order.status === "ready") {
        await supabase.from("orders").update({ status: "in_progress" as any }).eq("id", order_id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const removeItem = useMutation({
    mutationFn: async ({ id, order_id }: { id: string; order_id: string }) => {
      const { error } = await supabase.from("order_items").delete().eq("id", id);
      if (error) throw error;
      // Check remaining items
      const { data: items } = await supabase
        .from("order_items")
        .select("quantity, unit_price")
        .eq("order_id", order_id);
      if (!items || items.length === 0) {
        // No items left — cancel the order
        await supabase.from("orders").update({ status: "cancelled" as any }).eq("id", order_id);
      } else {
        const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
        await supabase.from("orders").update({ total }).eq("id", order_id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const cancelOrder = useMutation({
    mutationFn: async (id: string) => {
      // Delete all order items first, then cancel the order
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

  return { ...query, createOrder, updateOrderStatus, updateItemStatus, addItem, removeItem, cancelOrder, getActiveOrderForTable };
};
