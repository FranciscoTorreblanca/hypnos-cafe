import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { callHypnosTv, useTvIntegration } from "@/hooks/useHypnosTv";

export interface TvBrand { id: string; name: string; logo_url: string | null }

export function useTvBrands() {
  const { currentBusinessId } = useAuth();
  const { data: cfg } = useTvIntegration();
  return useQuery({
    queryKey: ["tv-brands", currentBusinessId],
    enabled: !!currentBusinessId && !!cfg?.has_api_key,
    networkMode: "online",
    queryFn: async () => {
      const r = await callHypnosTv({ action: "list_brands", business_id: currentBusinessId });
      return ((r?.brands ?? []) as TvBrand[]).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useSaveTvBrand() {
  const { currentBusinessId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { id?: string; name: string; logo_url: string | null }) => {
      const r = await callHypnosTv({ action: "save_brand", business_id: currentBusinessId, ...b });
      const brand = r?.brand?.brand ?? r?.brand?.data ?? r?.brand;
      return brand as TvBrand;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tv-brands"] }),
  });
}

export function useDeleteTvBrand() {
  const { currentBusinessId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => callHypnosTv({ action: "delete_brand", business_id: currentBusinessId, id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tv-brands"] });
      qc.invalidateQueries({ queryKey: ["menu-item-presentations"] });
    },
  });
}

/** Upload a logo to private storage and return a long-lived link the TV can load. */
export async function uploadBrandLogo(businessId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${businessId}/tv-brands/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("menu-images").upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage.from("menu-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (sErr || !data?.signedUrl) throw sErr ?? new Error("Could not create logo link");
  return data.signedUrl;
}
