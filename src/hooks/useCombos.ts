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

export interface ChoiceOption {
  id: string;
  choice_group_id: string;
  menu_item_id: string;
  menu_items: { name: string; name_en: string; price: number; cost: number };
}

export interface ChoiceGroup {
  id: string;
  combo_id: string;
  label: string;
  label_en: string;
  display_order: number;
  combo_choice_options: ChoiceOption[];
}

export interface ComboWithItems extends Combo {
  combo_items: (ComboItem & {
    menu_items: { name: string; name_en: string; price: number; cost: number };
  })[];
  combo_choice_groups: ChoiceGroup[];
}

export interface ChoiceGroupInput {
  label: string;
  label_en: string;
  options: { menu_item_id: string }[];
}

export const useCombos = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["combos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combos")
        .select(
          "*, combo_items(*, menu_items(name, name_en, price, cost)), combo_choice_groups(*, combo_choice_options(*, menu_items(name, name_en, price, cost)))"
        )
        .order("name");
      if (error) throw error;
      return data as ComboWithItems[];
    },
  });

  const upsert = useMutation({
    mutationFn: async ({
      combo,
      items,
      choiceGroups,
    }: {
      combo: Partial<Combo> & { name: string };
      items: { menu_item_id: string; quantity: number }[];
      choiceGroups?: ChoiceGroupInput[];
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

      // Replace choice groups
      // First delete existing groups (cascade deletes options)
      await supabase.from("combo_choice_groups").delete().eq("combo_id", comboId!);
      if (choiceGroups && choiceGroups.length > 0) {
        for (let i = 0; i < choiceGroups.length; i++) {
          const cg = choiceGroups[i];
          const { data: groupData, error: groupError } = await supabase
            .from("combo_choice_groups")
            .insert({ combo_id: comboId!, label: cg.label, label_en: cg.label_en, display_order: i })
            .select("id")
            .single();
          if (groupError) throw groupError;

          if (cg.options.length > 0) {
            const { error: optError } = await supabase
              .from("combo_choice_options")
              .insert(
                cg.options.map((o) => ({
                  choice_group_id: groupData.id,
                  menu_item_id: o.menu_item_id,
                }))
              );
            if (optError) throw optError;
          }
        }
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
