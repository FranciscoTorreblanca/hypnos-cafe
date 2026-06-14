import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MenuItemAddon } from "@/hooks/useMenuItems";

export interface AddonInput {
  id?: string;
  name: string;
  name_en: string;
  extra_price: number;
  display_order: number;
}

export const useMenuItemAddons = () => {
  const queryClient = useQueryClient();

  const saveAll = useMutation({
    mutationFn: async ({ menuItemId, addons }: { menuItemId: string; addons: AddonInput[] }) => {
      // Replace strategy: delete all existing then insert new
      const { error: delErr } = await supabase
        .from("menu_item_addons")
        .delete()
        .eq("menu_item_id", menuItemId);
      if (delErr) throw delErr;

      if (addons.length > 0) {
        const rows = addons.map((a, i) => ({
          menu_item_id: menuItemId,
          name: a.name,
          name_en: a.name_en || "",
          extra_price: a.extra_price || 0,
          display_order: a.display_order ?? i,
        }));
        const { error } = await supabase.from("menu_item_addons").insert(rows as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu_items"] }),
  });

  return { saveAll };
};
