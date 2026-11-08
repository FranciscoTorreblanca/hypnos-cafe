import { fetchAllPages } from "@/lib/fetchAllPages";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MenuItemAddon {
  id: string;
  menu_item_id: string;
  name: string;
  name_en: string;
  extra_price: number;
  display_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string | null;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  promo_price: number | null;
  cost: number;
  image_url: string | null;
  is_available: boolean;
  inventory_count: number | null;
  cooking_time_seconds: number | null;
  cooking_warning_seconds: number | null;
  requires_kitchen: boolean;
  /** Brand name (cached from Hypnos TV brand selection). */
  beer_brewery?: string | null;
  beer_style?: string | null;
  beer_abv?: number | null;
  tv_brand_id?: string | null;
  price_label?: string | null;
  menu_item_addons?: MenuItemAddon[];
}

/** "<brand> - <name>" when the item has a brand (avoids repeating it if the name already starts with it). */
export const itemDisplayName = (
  item: { name?: string | null; beer_brewery?: string | null } | null | undefined,
  name?: string | null,
): string => {
  const n = (name ?? item?.name ?? "").trim();
  const b = (item?.beer_brewery ?? "").trim();
  if (!b || n.toLowerCase().startsWith(b.toLowerCase())) return n;
  return `${b} - ${n}`;
};

/** Text used by search bars: names plus brand. */
export const itemSearchText = (item: { name?: string | null; name_en?: string | null; beer_brewery?: string | null }) =>
  `${item.name ?? ""} ${item.name_en ?? ""} ${item.beer_brewery ?? ""}`;

export const getEffectivePrice = (item: Pick<MenuItem, "price" | "promo_price">): number =>
  item.promo_price != null ? item.promo_price : item.price;

export const useMenuItems = () => {
  const queryClient = useQueryClient();
  const { currentBusinessId } = useAuth();

  const query = useQuery({
    queryKey: ["menu_items", currentBusinessId],
    staleTime: 30 * 1000,
    enabled: Boolean(currentBusinessId),
    queryFn: async ({ signal }) => {
      if (!currentBusinessId) throw new Error("No business selected");
      const data = await fetchAllPages((from, to) => supabase
        .from("menu_items")
        .select("*, menu_item_addons(*)")
        .eq("business_id", currentBusinessId).order("name").order("id")
        .range(from, to).abortSignal(signal), signal);
      return (data ?? []).map((mi: any) => ({
        ...mi,
        menu_item_addons: (mi.menu_item_addons ?? []).sort(
          (a: MenuItemAddon, b: MenuItemAddon) => a.display_order - b.display_order,
        ),
      })) as MenuItem[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (item: Partial<MenuItem> & { name: string }) => {
      const { menu_item_addons, ...rest } = item as any;
      if (item.id) {
        const { id, ...payload } = rest;
        const { error } = await supabase.from("menu_items").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        if (!currentBusinessId) throw new Error("No business selected");
        const { error } = await supabase.from("menu_items").insert({ ...rest, business_id: currentBusinessId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu_items"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu_items"] }),
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ id, is_available }: { id: string; is_available: boolean }) => {
      const { error } = await supabase.from("menu_items").update({ is_available }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu_items"] }),
  });

  return { ...query, upsert, remove, toggleAvailability };
};
