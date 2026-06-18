import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { probeBridge, type BridgeStatus } from "@/lib/fingerprintBridge";

const DEVICE_TOKEN_KEY = "hypnos.attendanceDeviceToken";

export function getStoredDeviceToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(DEVICE_TOKEN_KEY);
}

export function setStoredDeviceToken(token: string | null) {
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(DEVICE_TOKEN_KEY, token);
  else localStorage.removeItem(DEVICE_TOKEN_KEY);
}

export function useBridgeStatus(pollMs = 5000) {
  const [status, setStatus] = useState<BridgeStatus | null | "loading">("loading");

  const refresh = useCallback(async () => {
    const s = await probeBridge();
    setStatus(s);
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const s = await probeBridge();
      if (alive) setStatus(s);
    };
    void tick();
    const id = setInterval(tick, pollMs);
    return () => { alive = false; clearInterval(id); };
  }, [pollMs]);

  return { status, refresh };
}

export function useOpenSession(userId: string | null | undefined) {
  const [loading, setLoading] = useState(true);
  const [hasOpen, setHasOpen] = useState(false);
  const [session, setSession] = useState<any | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setHasOpen(false); setSession(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("attendance_sessions")
      .select("*")
      .eq("user_id", userId)
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSession(data ?? null);
    setHasOpen(Boolean(data));
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { loading, hasOpen, session, refresh };
}
