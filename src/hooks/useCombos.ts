import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Combo {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  is_available: boolean;
  image_url: string | null;
}

export interface ComboItem {
  id: string;
  combo_id: string;
  menu_item_id: string;
  quantity: number;
}

export interface ComboWithItems extends Combo {
  combo_items: (ComboItem & {
    menu_items: { name: string; name_en: string; price: number; cost: number };
  })[];
}

export const useCombos = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["combos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combos")
        .select("*, combo_items(*, menu_items(name, name_en, price, cost))")
        .order("name");
      if (error) throw error;
      return data as ComboWithItems[];
    },
  });

  const upsert = useMutation({
    mutationFn: async ({
      combo,
      items,
    }: {
      combo: Partial<Combo> & { name: string };
      items: { menu_item_id: string; quantity: number }[];
    }) => {
      let comboId = combo.id;

      if (comboId) {
        const { id, ...rest } = combo;
        const { error } = await supabase.from("combos").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("combos")
          .insert(combo)
          .select("id")
          .single();
        if (error) throw error;
        comboId = data.id;
      }

      // Replace combo items
      await supabase.from("combo_items").delete().eq("combo_id", comboId!);
      if (items.length > 0) {
        const { error } = await supabase
          .from("combo_items")
          .insert(items.map((i) => ({ ...i, combo_id: comboId! })));
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["combos"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("combos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["combos"] }),
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ id, is_available }: { id: string; is_available: boolean }) => {
      const { error } = await supabase.from("combos").update({ is_available }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["combos"] }),
  });

  return { ...query, upsert, remove, toggleAvailability };
};
