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
    const roleList = (rolesData ?? []).map((r: any) => r.role);
    if (roleList.includes("super_admin")) return;
    const role = primaryRole(roleList);
    await (supabase.from("usage_events") as any).insert({
      user_id: user.id,
      role,
      event_type: "action",
      path: window.location.pathname,
      action_name: actionName,
      metadata,
    });
  } catch {
    // never break UX
  }
}

export function useUsageTracking() {
  const location = useLocation();
  const { user, roles } = useAuth();
  const enterTime = useRef<number>(Date.now());
  const previousPath = useRef<string>("");

  useEffect(() => {
    if (!user) return;
    if ((roles as string[]).includes("super_admin")) return;
    const path = location.pathname;
    if (PUBLIC_PATHS.some((p) => path.startsWith(p))) return;

    const now = Date.now();
    const fromPath = previousPath.current;
    const durationOnPrev = fromPath ? now - enterTime.current : null;
    const role = primaryRole(roles as any);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.id]);
}
