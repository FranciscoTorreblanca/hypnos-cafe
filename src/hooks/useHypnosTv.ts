import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TvIntegration {
  business_id: string;
  enabled: boolean;
  taplist_category_id: string | null;
  auto_sync: boolean;
  has_api_key: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

export async function callHypnosTv(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("hypnos-tv", { body });
  if (error) {
    let msg = error.message;
    try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) msg = typeof ctx.error === "string" ? ctx.error : JSON.stringify(ctx.error); } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}

export function useTvIntegration() {
  const { currentBusinessId } = useAuth();
  return useQuery({
    queryKey: ["tv-integration", currentBusinessId],
    enabled: !!currentBusinessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("tv_integrations").select("*").eq("business_id", currentBusinessId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as TvIntegration | null;
    },
  });
}

export function useTvSync() {
  const { currentBusinessId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callHypnosTv({ action: "sync", business_id: currentBusinessId }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tv-integration"] }),
  });
}

/** Debounced automatic sync whenever menu items / presentations are invalidated. */
export function installTvAutoSync(client: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const roots = new Set(["menu_items", "menu-item-presentations"]);
  return client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "invalidate") return;
    if (!roots.has(String(event.query.queryKey[0]))) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const cfgs = client.getQueryCache().findAll({ queryKey: ["tv-integration"] });
      for (const q of cfgs) {
        const cfg = q.state.data as TvIntegration | null | undefined;
        if (cfg?.enabled && cfg.auto_sync && cfg.has_api_key && cfg.taplist_category_id) {
          try { await callHypnosTv({ action: "sync", business_id: cfg.business_id }); } catch { /* recorded server-side */ }
          void client.invalidateQueries({ queryKey: ["tv-integration"] });
        }
      }
    }, 2500);
  });
}
