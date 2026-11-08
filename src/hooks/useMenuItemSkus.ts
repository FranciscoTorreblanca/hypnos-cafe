import { fetchAllPages } from "@/lib/fetchAllPages";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MenuItemSku {
  id: string;
  menu_item_id: string;
  code: string;
  label: string;
  created_at: string;
}

export const useMenuItemSkus = (menuItemId?: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["menu_item_skus", menuItemId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("menu_item_skus").select("*").order("created_at");
      if (menuItemId) q = q.eq("menu_item_id", menuItemId);
      const data = await fetchAllPages((from, to) => q.order("id").range(from, to));
      return data as MenuItemSku[];
    },
  });

  const add = useMutation({
    mutationFn: async (input: { menu_item_id: string; code: string; label?: string }) => {
      const { error } = await supabase.from("menu_item_skus").insert({
        menu_item_id: input.menu_item_id,
        code: input.code.trim(),
        label: input.label ?? "",
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu_item_skus"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_item_skus").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu_item_skus"] }),
  });

  return { ...query, add, remove };
};

/** Look up a single SKU by code (returns the matched sku + linked menu_item, if any). */
export const lookupSkuByCode = async (code: string) => {
  const { data, error } = await supabase
    .from("menu_item_skus")
    .select("*, menu_items(*)")
    .eq("code", code.trim())
    .maybeSingle();
  if (error) throw error;
  return data as (MenuItemSku & { menu_items: any }) | null;
};
