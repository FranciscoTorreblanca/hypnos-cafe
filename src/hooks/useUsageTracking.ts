import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PUBLIC_PATHS = ["/auth", "/reset-password", "/loyalty", "/loyalty-login", "/public-menu"];

function primaryRole(roles: string[]): string {
  if (!roles?.length) return "unknown";
  const priority = ["admin", "billing", "waiter", "kitchen", "loyalty_member"];
  for (const r of priority) if (roles.includes(r as any)) return r;
  return roles[0];
}

// Quick in-page action tracker (call from anywhere).
export async function trackUsageAction(
  actionName: string,
  metadata: Record<string, any> = {}
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const role = primaryRole((rolesData ?? []).map((r: any) => r.role));
    await (supabase.from("usage_events") as any).insert({
      user_id: user.id,
      role,
      event_type: "action",
      path: window.location.pathname,
      action_name: actionName,
      metadata,
    });
  } catch {
    // Silently ignore — analytics must never break UX
  }
}

export function useUsageTracking() {
  const location = useLocation();
  const { user, roles } = useAuth();
  const enterTime = useRef<number>(Date.now());
  const previousPath = useRef<string>("");

  useEffect(() => {
    if (!user) return;
    const path = location.pathname;
    if (PUBLIC_PATHS.some((p) => path.startsWith(p))) return;

    const now = Date.now();
    const fromPath = previousPath.current;
    const durationOnPrev = fromPath ? now - enterTime.current : null;
    const role = primaryRole(roles as any);

    // Log duration on the previous screen
    if (fromPath && durationOnPrev !== null && durationOnPrev > 500) {
      (supabase.from("usage_events") as any)
        .insert({
          user_id: user.id,
          role,
          event_type: "page_leave",
          path: fromPath,
          duration_ms: durationOnPrev,
          metadata: {},
        })
        .then(() => {});
    }

    // Log view on the new screen
    (supabase.from("usage_events") as any)
      .insert({
        user_id: user.id,
        role,
        event_type: "page_view",
        path,
        from_path: fromPath,
        metadata: {},
      })
      .then(() => {});

    enterTime.current = now;
    previousPath.current = path;

    // Log final duration on unload
    const handleUnload = () => {
      const dur = Date.now() - enterTime.current;
      if (dur < 500) return;
      const blob = new Blob(
        [
          JSON.stringify({
            user_id: user.id,
            role,
            event_type: "page_leave",
            path,
            duration_ms: dur,
            metadata: { unload: true },
          }),
        ],
        { type: "application/json" }
      );
      // Best-effort: use sendBeacon when possible via REST
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/usage_events`;
        const headers: any = {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        };
        // sendBeacon doesn't support custom headers, so fall back to fetch keepalive
        fetch(url, {
          method: "POST",
          headers: {
            ...headers,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: blob,
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Silently ignore
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.id]);
}
