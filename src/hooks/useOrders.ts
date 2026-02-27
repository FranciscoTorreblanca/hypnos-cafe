import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  notes: string;
  created_at: string;
  menu_item?: { name: string; name_en: string };
}

export interface Order {
  id: string;
  table_number: number;
  status: "pending" | "in_progress" | "completed" | "cancelled";
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, menu_items(name, name_en))")
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Flatten the nested menu_items join
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
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
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
        .insert({ order_id, menu_item_id, quantity, unit_price, notes: notes ?? "" });
      if (error) throw error;
      // Update order total
      const { data: items } = await supabase
        .from("order_items")
        .select("quantity, unit_price")
        .eq("order_id", order_id);
      const total = (items ?? []).reduce((s, i) => s + i.quantity * i.unit_price, 0);
      await supabase.from("orders").update({ total }).eq("id", order_id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const removeItem = useMutation({
    mutationFn: async ({ id, order_id }: { id: string; order_id: string }) => {
      const { error } = await supabase.from("order_items").delete().eq("id", id);
      if (error) throw error;
      const { data: items } = await supabase
        .from("order_items")
        .select("quantity, unit_price")
        .eq("order_id", order_id);
      const total = (items ?? []).reduce((s, i) => s + i.quantity * i.unit_price, 0);
      await supabase.from("orders").update({ total }).eq("id", order_id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const getActiveOrderForTable = (tableNumber: number) =>
    (query.data ?? []).find(
      (o) => o.table_number === tableNumber && (o.status === "pending" || o.status === "in_progress")
    );

  return { ...query, createOrder, updateOrderStatus, addItem, removeItem, getActiveOrderForTable };
};
