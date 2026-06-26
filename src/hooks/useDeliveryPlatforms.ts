import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DeliveryPlatform {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  commission_pct: number;
  payout_weekday: number;
  payout_offset_days: number;
  is_active: boolean;
}

const KEY = ["delivery_platforms"];

export const useDeliveryPlatforms = () => {
  const qc = useQueryClient();
  const { currentBusinessId } = useAuth();

  const query = useQuery({
    queryKey: KEY,
    enabled: !!currentBusinessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_platforms")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as DeliveryPlatform[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (
      p: Partial<DeliveryPlatform> & { name: string; slug: string; commission_pct: number },
    ) => {
      if (!currentBusinessId) throw new Error("No business");
      const row: any = {
        business_id: currentBusinessId,
        name: p.name,
        slug: p.slug,
        commission_pct: p.commission_pct,
        payout_weekday: p.payout_weekday ?? 5,
        payout_offset_days: p.payout_offset_days ?? 7,
        is_active: p.is_active ?? true,
      };
      if (p.id) row.id = p.id;
      const { data, error } = await (supabase as any)
        .from("delivery_platforms")
        .upsert(row, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return data as DeliveryPlatform;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("delivery_platforms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  /** Ensure a default Rappi exists for this business. Idempotent. */
  const ensureDefault = useMutation({
    mutationFn: async () => {
      if (!currentBusinessId) return;
      if ((query.data ?? []).length > 0) return;
      await (supabase as any).from("delivery_platforms").insert({
        business_id: currentBusinessId,
        name: "Rappi",
        slug: "rappi",
        commission_pct: 25,
        payout_weekday: 5,
        payout_offset_days: 7,
        is_active: true,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return { ...query, upsert, remove, ensureDefault };
};

/** Per-platform menu pricing — used to override unit_price on delivery orders. */
export interface MenuItemPlatform {
  id: string;
  business_id: string;
  menu_item_id: string;
  platform_id: string;
  price: number;
  is_available: boolean;
}

export const useMenuItemPlatformPrices = (platformId: string | null | undefined) => {
  return useQuery({
    queryKey: ["menu_item_platforms", platformId],
    enabled: !!platformId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("menu_item_platforms")
        .select("*")
        .eq("platform_id", platformId);
      if (error) throw error;
      return (data ?? []) as MenuItemPlatform[];
    },
  });
};

export const useMenuItemPlatformsForItem = (menuItemId: string | null | undefined) => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["menu_item_platforms", "for-item", menuItemId],
    enabled: !!menuItemId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("menu_item_platforms")
        .select("*")
        .eq("menu_item_id", menuItemId);
      if (error) throw error;
      return (data ?? []) as MenuItemPlatform[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: {
      id?: string;
      business_id: string;
      menu_item_id: string;
      platform_id: string;
      price: number;
      is_available: boolean;
    }) => {
      const { data, error } = await (supabase as any)
        .from("menu_item_platforms")
        .upsert(row, { onConflict: "menu_item_id,platform_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu_item_platforms"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("menu_item_platforms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu_item_platforms"] }),
  });

  return { ...query, upsert, remove };
};
