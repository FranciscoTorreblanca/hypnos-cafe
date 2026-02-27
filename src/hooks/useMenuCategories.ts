import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MenuCategory {
  id: string;
  name: string;
  name_en: string;
  display_order: number;
}

export const useMenuCategories = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["menu_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as MenuCategory[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (cat: Partial<MenuCategory> & { name: string }) => {
      if (cat.id) {
        const { error } = await supabase.from("menu_categories").update(cat).eq("id", cat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_categories").insert(cat);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu_categories"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu_categories"] }),
  });

  return { ...query, upsert, remove };
};
