import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MenuItemIngredient {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  quantity: number;
}

export const useMenuItemIngredients = (menuItemId?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["menu_item_ingredients", menuItemId],
    enabled: !!menuItemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_item_ingredients")
        .select("*")
        .eq("menu_item_id", menuItemId!);
      if (error) throw error;
      return data as MenuItemIngredient[];
    },
  });

  const saveAll = useMutation({
    mutationFn: async ({ itemId, ingredients }: { itemId: string; ingredients: { ingredient_id: string; quantity: number }[] }) => {
      // Delete existing, then insert new
      const { error: delErr } = await supabase.from("menu_item_ingredients").delete().eq("menu_item_id", itemId);
      if (delErr) throw delErr;
      if (ingredients.length > 0) {
        const rows = ingredients.map((i) => ({ menu_item_id: itemId, ...i }));
        const { error: insErr } = await supabase.from("menu_item_ingredients").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu_item_ingredients"] }),
  });

  return { ...query, saveAll };
};
