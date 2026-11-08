import { fetchAllPages } from "@/lib/fetchAllPages";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Menu {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  type: "main" | "seasonal" | "event";
  status: "draft" | "published" | "archived";
  is_online: boolean;
  version: number;
  parent_menu_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuEntry {
  id: string;
  menu_id: string;
  menu_item_id: string | null;
  combo_id: string | null;
  section_label: string;
  section_label_en: string;
  display_order: number;
  created_at: string;
}

export interface MenuWithEntries extends Menu {
  menu_entries: (MenuEntry & {
    menu_items?: { id: string; name: string; name_en: string; price: number; cost: number; is_available: boolean; description: string; description_en: string; image_url: string | null; category_id: string | null } | null;
    combos?: { id: string; name: string; name_en: string; price: number; is_available: boolean; description: string; description_en: string; image_url: string | null } | null;
  })[];
}

export const useMenus = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["menus"],
    queryFn: async () => {
      const menus = await fetchAllPages((from, to) => supabase.from("menus").select("*")
        .order("updated_at", { ascending: false }).order("id").range(from, to));
      if (!menus.length) return [];
      const entries = await fetchAllPages((from, to) => supabase.from("menu_entries")
        .select("*, menu_items(*), combos(*)").order("display_order").order("id").range(from, to));
      return menus.map(menu => ({ ...menu, menu_entries: entries.filter(e => e.menu_id === menu.id) })) as unknown as MenuWithEntries[];
    },
  });

  const upsertMenu = useMutation({
    mutationFn: async ({
      menu,
      entries,
    }: {
      menu: Partial<Menu> & { name: string };
      entries: { menu_item_id?: string | null; combo_id?: string | null; section_label: string; section_label_en: string; display_order: number }[];
    }) => {
      let menuId = menu.id;
      if (menuId) {
        const { id, created_at, updated_at, ...rest } = menu as any;
        const { error } = await supabase.from("menus").update(rest).eq("id", menuId);
        if (error) throw error;
      } else {
        const { id, created_at, updated_at, ...rest } = menu as any;
        const { data, error } = await supabase.from("menus").insert(rest).select("id").single();
        if (error) throw error;
        menuId = data.id;
      }

      // Replace entries
      await supabase.from("menu_entries").delete().eq("menu_id", menuId);
      if (entries.length > 0) {
        const rows = entries.map((e) => ({ ...e, menu_id: menuId }));
        const { error } = await supabase.from("menu_entries").insert(rows);
        if (error) throw error;
      }
      return menuId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menus"] }),
  });

  const removeMenu = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menus").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menus"] }),
  });

  const toggleOnline = useMutation({
    mutationFn: async ({ id, is_online }: { id: string; is_online: boolean }) => {
      const { error } = await supabase.from("menus").update({ is_online }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menus"] }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Menu["status"] }) => {
      const { error } = await supabase.from("menus").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menus"] }),
  });

  const duplicateMenu = useMutation({
    mutationFn: async (sourceMenu: MenuWithEntries) => {
      const { id, created_at, updated_at, menu_entries, ...rest } = sourceMenu;
      const newMenu = {
        ...rest,
        name: `${rest.name} (v${rest.version + 1})`,
        name_en: rest.name_en ? `${rest.name_en} (v${rest.version + 1})` : "",
        status: "draft" as const,
        is_online: false,
        version: rest.version + 1,
        parent_menu_id: id,
      };
      const { data, error } = await supabase.from("menus").insert(newMenu).select("id").single();
      if (error) throw error;
      if (menu_entries.length > 0) {
        const entries = menu_entries.map((e) => ({
          menu_id: data.id,
          menu_item_id: e.menu_item_id,
          combo_id: e.combo_id,
          section_label: e.section_label,
          section_label_en: e.section_label_en,
          display_order: e.display_order,
        }));
        const { error: eErr } = await supabase.from("menu_entries").insert(entries);
        if (eErr) throw eErr;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menus"] }),
  });

  return { ...query, upsertMenu, removeMenu, toggleOnline, updateStatus, duplicateMenu };
};
