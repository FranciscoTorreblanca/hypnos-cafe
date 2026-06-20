import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Order, OrderItem } from "@/hooks/useOrders";

/**
 * Plays a short attention sound via WebAudio.
 * tone: "new" (two-tone chime), "warn" (single beep), "over" (urgent triple beep).
 */
function playSound(tone: "new" | "warn" | "over") {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return;
    const ctx: AudioContext = (playSound as any)._ctx || ((playSound as any)._ctx = new AC());
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    const beep = (freq: number, start: number, dur: number, gain = 0.18) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(gain, now + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(now + start);
      o.stop(now + start + dur + 0.02);
    };

    if (tone === "new") { beep(880, 0, 0.18); beep(1320, 0.18, 0.22); }
    else if (tone === "warn") { beep(660, 0, 0.25, 0.22); }
    else { beep(880, 0, 0.16, 0.25); beep(880, 0.2, 0.16, 0.25); beep(660, 0.4, 0.35, 0.28); }
  } catch { /* noop */ }
}

// Unlock audio on first user gesture (browsers block autoplay otherwise).
function useAudioUnlock() {
  useEffect(() => {
    const unlock = () => {
      try {
        const AC = (window.AudioContext || (window as any).webkitAudioContext);
        if (!AC) return;
        const ctx: AudioContext = (playSound as any)._ctx || ((playSound as any)._ctx = new AC());
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
      } catch { /* noop */ }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
}

export function useKitchenAlerts() {
  const { user, currentBusinessId, hasRole, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const qc = useQueryClient();
  const seenItemIds = useRef<Set<string>>(new Set());
  const warnedIds = useRef<Set<string>>(new Set());
  const overIds = useRef<Set<string>>(new Set());
  const bootstrapped = useRef(false);

  const enabled = !!user && !!currentBusinessId && (hasRole("kitchen") || isAdmin);

  useAudioUnlock();

  // Seed seen-set with currently active kitchen items so we don't alert on initial load.
  useEffect(() => {
    if (!enabled) return;
    const orders = qc.getQueryData<Order[]>(["orders"]) ?? [];
    for (const o of orders) {
      for (const oi of o.order_items ?? []) {
        if (oi.menu_item?.requires_kitchen !== false) seenItemIds.current.add(oi.id);
        if (oi.status === "ready" || oi.status === "served" || oi.status === "paid") {
          warnedIds.current.add(oi.id);
          overIds.current.add(oi.id);
        }
      }
    }
    bootstrapped.current = true;
  }, [enabled, qc]);

  // Realtime: new order items arriving at the kitchen
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`kitchen-alerts-${currentBusinessId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_items" },
        (payload) => {
          const row: any = payload.new;
          if (!row?.id || seenItemIds.current.has(row.id)) return;
          seenItemIds.current.add(row.id);

          // Look up the menu item from cache to decide if it needs the kitchen
          const menuItems = qc.getQueryData<any[]>(["menu_items"]) ?? [];
          const mi = menuItems.find((m: any) => m.id === row.menu_item_id);
          if (mi && mi.requires_kitchen === false) return;
          const name = mi ? (language === "es" ? mi.name : mi.name_en || mi.name) : t("orders.order");

          // Re-fetch orders to pull in the new item + table
          qc.invalidateQueries({ queryKey: ["orders"] });

          playSound("new");
          toast.info(`🍳 ${row.quantity}x ${name}`, {
            description: t("kitchen.alertNew"),
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, currentBusinessId, qc, language, t]);

  // Tick: detect warn/over transitions from the cached orders
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const orders = qc.getQueryData<Order[]>(["orders"]) ?? [];
      const now = Date.now();
      for (const o of orders) {
        if (o.status !== "pending" && o.status !== "in_progress") continue;
        for (const oi of o.order_items ?? []) {
          if (oi.menu_item?.requires_kitchen === false) continue;
          if (oi.status !== "pending" && oi.status !== "in_progress") continue;
          const target = oi.menu_item?.cooking_time_seconds ?? null;
          if (!target || target <= 0) continue;
          const warn = oi.menu_item?.cooking_warning_seconds ?? 60;
          const startAt = oi.started_at ? new Date(oi.started_at).getTime() : new Date(oi.created_at).getTime();
          const elapsed = Math.max(0, Math.floor((now - startAt) / 1000));
          const name = language === "es" ? oi.menu_item?.name : oi.menu_item?.name_en;

          if (elapsed >= target && !overIds.current.has(oi.id)) {
            overIds.current.add(oi.id);
            warnedIds.current.add(oi.id);
            playSound("over");
            toast.error(`🔥 ${oi.quantity}x ${name ?? ""}`, {
              description: t("kitchen.alertOver"),
              duration: 8000,
            });
          } else if (elapsed >= Math.max(0, target - warn) && !warnedIds.current.has(oi.id)) {
            warnedIds.current.add(oi.id);
            playSound("warn");
            toast.warning(`⚠️ ${oi.quantity}x ${name ?? ""}`, {
              description: t("kitchen.alertWarn"),
              duration: 6000,
            });
          }
        }
      }
    };
    tick();
    const i = setInterval(tick, 5000);
    return () => clearInterval(i);
  }, [enabled, qc, language, t]);
}
