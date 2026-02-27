import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MenuItem {
  id: string;
  category_id: string | null;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  cost: number;
  image_url: string | null;
  is_available: boolean;
  inventory_count: number | null;
}

export const useMenuItems = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["menu_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as MenuItem[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (item: Partial<MenuItem> & { name: string }) => {
      if (item.id) {
        const { id, ...rest } = item;
        const { error } = await supabase.from("menu_items").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").insert(item);
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
