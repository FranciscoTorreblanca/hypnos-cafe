import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PrefetchTask {
  key: string;
  label: { es: string; en: string };
  run: (qc: QueryClient) => Promise<void>;
}

const TASKS: PrefetchTask[] = [
  {
    key: "menu_categories",
    label: { es: "Categorías", en: "Categories" },
    run: (qc) =>
      qc.prefetchQuery({
        queryKey: ["menu_categories"],
        queryFn: async () => {
          const { data, error } = await (supabase as any)
            .from("menu_categories").select("*").order("sort_order");
          if (error) throw error;
          return data ?? [];
        },
        staleTime: 60_000,
      }),
  },
  {
    key: "menu_items",
    label: { es: "Menú", en: "Menu" },
    run: async (qc) => {
      // Match useMenuItems' key shape ["menu_items", currentBusinessId] for any bizId.
      const { data, error } = await (supabase as any)
        .from("menu_items").select("*").order("name");
      if (error) throw error;
      qc.setQueryData(["menu_items"], data ?? []);
    },
  },
  {
    key: "combos",
    label: { es: "Combos", en: "Combos" },
    run: (qc) =>
      qc.prefetchQuery({
        queryKey: ["combos"],
        queryFn: async () => {
          const { data, error } = await (supabase as any).from("combos").select("*");
          if (error) throw error;
          return data ?? [];
        },
        staleTime: 60_000,
      }),
  },
  {
    key: "tables",
    label: { es: "Mesas", en: "Tables" },
    run: async (qc) => {
      await Promise.all([
        qc.prefetchQuery({
          queryKey: ["table_names"],
          queryFn: async () => {
            const { data, error } = await (supabase as any).from("table_names").select("*");
            if (error) throw error;
            return data ?? [];
          },
        }),
        qc.prefetchQuery({
          queryKey: ["table_order"],
          queryFn: async () => {
            const { data, error } = await (supabase as any).from("table_order").select("*");
            if (error) throw error;
            return data ?? [];
          },
        }),
      ]);
    },
  },
  {
    key: "orders",
    label: { es: "Órdenes activas", en: "Active orders" },
    run: (qc) =>
      qc.prefetchQuery({
        queryKey: ["orders"],
        queryFn: async () => {
          const { data, error } = await (supabase as any)
            .from("orders").select("*, order_items(*)")
            .in("status", ["pending", "in_progress", "served"])
            .order("created_at", { ascending: false });
          if (error) throw error;
          return data ?? [];
        },
      }),
  },
  {
    key: "till_session",
    label: { es: "Caja actual", en: "Current till" },
    run: (qc) =>
      qc.prefetchQuery({
        queryKey: ["till_session", "current"],
        queryFn: async () => {
          const { data } = await (supabase.rpc as any)("current_till_session");
          return data ?? null;
        },
      }),
  },
  {
    key: "payments",
    label: { es: "Pagos recientes", en: "Recent payments" },
    run: (qc) =>
      qc.prefetchQuery({
        queryKey: ["payments"],
        queryFn: async () => {
          const { data, error } = await (supabase as any)
            .from("payments").select("*").order("created_at", { ascending: false }).limit(50);
          if (error) throw error;
          return data ?? [];
        },
      }),
  },
];

export interface PrefetchProgress {
  current: number;
  total: number;
  label: { es: string; en: string } | null;
}

export async function runPrefetch(
  qc: QueryClient,
  onProgress?: (p: PrefetchProgress) => void
): Promise<void> {
  const total = TASKS.length;
  for (let i = 0; i < TASKS.length; i++) {
    const t = TASKS[i];
    onProgress?.({ current: i, total, label: t.label });
    try { await t.run(qc); } catch (e) { console.warn("[prefetch] failed", t.key, e); }
  }
  onProgress?.({ current: total, total, label: null });
}
