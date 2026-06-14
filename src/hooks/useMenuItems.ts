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
  menu_item_addons?: MenuItemAddon[];
}

export const getEffectivePrice = (item: Pick<MenuItem, "price" | "promo_price">): number =>
  item.promo_price != null ? item.promo_price : item.price;

export const useMenuItems = () => {
  const queryClient = useQueryClient();
  const { currentBusinessId } = useAuth();

  const query = useQuery({
    queryKey: ["menu_items", currentBusinessId],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*, menu_item_addons(*)")
        .order("name");
      if (error) throw error;
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
