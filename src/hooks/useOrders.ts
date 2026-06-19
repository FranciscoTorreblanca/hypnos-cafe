import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { applyLineDiscount } from "@/lib/discounts";
import { useOfflineMutation } from "@/offline/useOfflineMutation";

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
  _pending?: boolean; // offline marker
}

const ORDERS_KEY = ["orders"];

function recalc(order: Order): Order {
  const total = (order.order_items ?? []).reduce(
    (s, i) => s + applyLineDiscount(i.quantity * i.unit_price, i.discount ?? 0, i.discount_amount ?? 0),
    0
  );
  return { ...order, total };
}

function patchOrder(qc: any, id: string, patch: (o: Order) => Order) {
  qc.setQueryData(ORDERS_KEY, (old: Order[] | undefined) => {
    if (!old) return old;
    return old.map((o) => (o.id === id ? patch(o) : o));
  });
}

export const useOrders = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ORDERS_KEY,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, menu_items(name, name_en), combos(name, name_en))")
        .in("status", ["pending", "in_progress", "completed", "ready", "served"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((o: any) => {
        const order_items = (o.order_items ?? []).map((oi: any) => ({
          ...oi,
          menu_item: oi.menu_items,
          combo: oi.combos ?? null,
        }));
        const total = order_items.reduce(
          (s: number, i: any) =>
            s + applyLineDiscount(i.quantity * i.unit_price, i.discount ?? 0, i.discount_amount ?? 0),
          0
        );
        return { ...o, order_items, total };
      }) as Order[];
    },
  });

  const lookupMenuItem = (menu_item_id: string) => {
    const items = queryClient.getQueryData<any[]>(["menu_items"]) ?? [];
    const m = items.find((x: any) => x.id === menu_item_id);
    return m ? { name: m.name, name_en: m.name_en ?? m.name } : { name: "Item", name_en: "Item" };
  };

  const lookupCombo = (combo_id: string | null | undefined) => {
    if (!combo_id) return null;
    const items = queryClient.getQueryData<any[]>(["combos"]) ?? [];
    const c = items.find((x: any) => x.id === combo_id);
    return c ? { name: c.name, name_en: c.name_en ?? c.name } : null;
  };

  const createOrder = useOfflineMutation<number>({
    kind: "order.create",
    label: (tableNumber) => `Create order · Table ${tableNumber}`,
    entryId: () => crypto.randomUUID(),
    buildPayload: (tableNumber) => ({ table_number: tableNumber, created_by: user!.id }),
    optimistic: async (qc, tableNumber) => {
      // We need a deterministic order id for follow-up addItem. Use enqueue's id.
      // But entryId callback isn't passed here — generate independently then attach.
    },
  });
  // Override to expose a function that returns the created order id for chained UI calls.
  const createOrderWithId = async (tableNumber: number): Promise<Order> => {
    const id = crypto.randomUUID();
    const optimistic: Order = {
      id, table_number: tableNumber, status: "pending", notes: "",
      created_by: user!.id, total: 0, general_discount: 0, general_discount_amount: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      order_items: [], _pending: true,
    };
    queryClient.setQueryData<Order[]>(ORDERS_KEY, (old) => [optimistic, ...(old ?? [])]);
    const { enqueue } = await import("@/offline/enqueue");
    await enqueue("order.create", { id, table_number: tableNumber, created_by: user!.id }, {
      id, label: `Create order · Table ${tableNumber}`,
    });
    return optimistic;
  };

  const updateOrderStatus = useOfflineMutation<{ id: string; status: Order["status"] }>({
    kind: "order.updateStatus",
    label: ({ id, status }) => `Order ${id.slice(0, 6)} → ${status}`,
    buildPayload: ({ id, status }) => ({ id, status }),
    optimistic: async (qc, { id, status }) => patchOrder(qc, id, (o) => ({ ...o, status })),
  });

  const updateItemStatus = useOfflineMutation<{ id: string; status: string; order_id: string }>({
    kind: "order_item.updateStatus",
    label: ({ id, status }) => `Item ${id.slice(0, 6)} → ${status}`,
    buildPayload: ({ id, status }) => ({ id, status }),
    optimistic: async (qc, { id, status, order_id }) =>
      patchOrder(qc, order_id, (o) => ({
        ...o,
        order_items: (o.order_items ?? []).map((it) => (it.id === id ? { ...it, status } : it)),
        status: (o.order_items ?? []).every((it) => (it.id === id ? status : it.status) === "ready") && (o.order_items?.length ?? 0) > 0
          ? "ready" : o.status,
      })),
  });

  const addItem = useOfflineMutation<{
    order_id: string; menu_item_id: string; quantity: number; unit_price: number;
    notes?: string; discount?: number; discount_amount?: number; combo_id?: string; combo_group_id?: string;
  }>({
    kind: "order_item.insert",
    label: ({ menu_item_id }) => `Add item ${lookupMenuItem(menu_item_id).name}`,
    entryId: () => crypto.randomUUID(),
    dependsOn: () => undefined, // dep tracking optional; client UUIDs match
    buildPayload: (v) => ({
      id: crypto.randomUUID(),
      order_id: v.order_id, menu_item_id: v.menu_item_id, quantity: v.quantity,
      unit_price: v.unit_price, notes: v.notes ?? "", discount: v.discount ?? 0,
      discount_amount: v.discount_amount ?? 0, combo_id: v.combo_id ?? null,
      combo_group_id: v.combo_group_id ?? null,
    }),
    optimistic: async (qc, v) => {
      const newItem: OrderItem = {
        id: crypto.randomUUID(),
        order_id: v.order_id, menu_item_id: v.menu_item_id, quantity: v.quantity,
        unit_price: v.unit_price, discount: v.discount ?? 0, discount_amount: v.discount_amount ?? 0,
        notes: v.notes ?? "", status: "pending", created_at: new Date().toISOString(),
        combo_id: v.combo_id ?? null, combo_group_id: v.combo_group_id ?? null,
        menu_item: lookupMenuItem(v.menu_item_id), combo: lookupCombo(v.combo_id),
      };
      patchOrder(qc, v.order_id, (o) => recalc({
        ...o,
        order_items: [...(o.order_items ?? []), newItem],
        status: o.status === "ready" || o.status === "served" ? "in_progress" : o.status,
      }));
    },
  });

  const addItemsBulk = useOfflineMutation<{
    order_id: string;
    items: Array<{
      menu_item_id: string; quantity: number; unit_price: number;
      notes?: string; discount?: number; discount_amount?: number; combo_id?: string; combo_group_id?: string;
    }>;
  }>({
    kind: "order_item.insertBulk",
    label: ({ items }) => `Add ${items.length} items`,
    buildPayload: ({ order_id, items }) => ({
      rows: items.map((c) => ({
        id: crypto.randomUUID(),
        order_id, menu_item_id: c.menu_item_id, quantity: c.quantity,
        unit_price: c.unit_price, notes: c.notes ?? "", discount: c.discount ?? 0,
        discount_amount: c.discount_amount ?? 0, combo_id: c.combo_id ?? null,
        combo_group_id: c.combo_group_id ?? null,
      })),
    }),
    optimistic: async (qc, { order_id, items }) => {
      const newItems: OrderItem[] = items.map((v) => ({
        id: crypto.randomUUID(), order_id, menu_item_id: v.menu_item_id,
        quantity: v.quantity, unit_price: v.unit_price, discount: v.discount ?? 0,
        discount_amount: v.discount_amount ?? 0, notes: v.notes ?? "",
        status: "pending", created_at: new Date().toISOString(),
        combo_id: v.combo_id ?? null, combo_group_id: v.combo_group_id ?? null,
        menu_item: lookupMenuItem(v.menu_item_id), combo: lookupCombo(v.combo_id),
      }));
      patchOrder(qc, order_id, (o) => recalc({
        ...o,
        order_items: [...(o.order_items ?? []), ...newItems],
        status: o.status === "ready" || o.status === "served" ? "in_progress" : o.status,
      }));
    },
  });

  const removeItem = useOfflineMutation<{ id: string; order_id: string }>({
    kind: "order_item.remove",
    label: ({ id }) => `Remove item ${id.slice(0, 6)}`,
    buildPayload: ({ id }) => ({ id }),
    optimistic: async (qc, { id, order_id }) =>
      patchOrder(qc, order_id, (o) => {
        const remaining = (o.order_items ?? []).filter((it) => it.id !== id);
        return recalc({ ...o, order_items: remaining, status: remaining.length === 0 ? "cancelled" : o.status });
      }),
  });

  const updateItemDiscount = useOfflineMutation<{ id: string; discount: number; order_id: string }>({
    kind: "order_item.updateDiscount",
    label: ({ discount }) => `Item discount → ${discount}%`,
    buildPayload: ({ id, discount }) => ({ id, discount }),
    optimistic: async (qc, { id, discount, order_id }) =>
      patchOrder(qc, order_id, (o) => recalc({
        ...o, order_items: (o.order_items ?? []).map((it) => it.id === id ? { ...it, discount } : it),
      })),
  });

  const updateItemDiscountAmount = useOfflineMutation<{ id: string; discount_amount: number; order_id: string }>({
    kind: "order_item.updateDiscountAmount",
    label: ({ discount_amount }) => `Item discount → ${discount_amount}`,
    buildPayload: ({ id, discount_amount }) => ({ id, discount_amount: Math.max(0, discount_amount) }),
    optimistic: async (qc, { id, discount_amount, order_id }) =>
      patchOrder(qc, order_id, (o) => recalc({
        ...o, order_items: (o.order_items ?? []).map((it) => it.id === id ? { ...it, discount_amount: Math.max(0, discount_amount) } : it),
      })),
  });

  const updateGeneralDiscount = useOfflineMutation<{ id: string; discount: number }>({
    kind: "order.updateGeneralDiscount",
    label: ({ discount }) => `General discount → ${discount}%`,
    buildPayload: ({ id, discount }) => ({ id, discount }),
    optimistic: async (qc, { id, discount }) => patchOrder(qc, id, (o) => ({ ...o, general_discount: discount })),
  });

  const updateGeneralDiscountAmount = useOfflineMutation<{ id: string; discount_amount: number }>({
    kind: "order.updateGeneralDiscountAmount",
    label: ({ discount_amount }) => `General discount → ${discount_amount}`,
    buildPayload: ({ id, discount_amount }) => ({ id, discount_amount: Math.max(0, discount_amount) }),
    optimistic: async (qc, { id, discount_amount }) =>
      patchOrder(qc, id, (o) => ({ ...o, general_discount_amount: Math.max(0, discount_amount) })),
  });

  const cancelOrder = useOfflineMutation<string>({
    kind: "order.cancel",
    label: (id) => `Cancel order ${id.slice(0, 6)}`,
    buildPayload: (id) => ({ id }),
    optimistic: async (qc, id) => patchOrder(qc, id, (o) => ({ ...o, status: "cancelled", order_items: [] })),
  });

  const getActiveOrderForTable = (tableNumber: number) =>
    (query.data ?? []).find(
      (o) => o.table_number === tableNumber && !["paid", "cancelled"].includes(o.status)
    );

  // Provide a createOrder.mutateAsync-compatible shim that returns the new order
  const createOrderShim = {
    ...createOrder,
    mutateAsync: async (tableNumber: number) => createOrderWithId(tableNumber),
    mutate: (tableNumber: number) => { void createOrderWithId(tableNumber); },
  } as any;

  return {
    ...query,
    createOrder: createOrderShim,
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
