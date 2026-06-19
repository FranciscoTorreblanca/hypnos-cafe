import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queue, log, type QueueEntry } from "./idbStorage";
import { runSync } from "./syncRunner";

interface OfflineCtx {
  online: boolean;
  syncing: boolean;
  pending: QueueEntry[];
  failed: QueueEntry[];
  recentLog: QueueEntry[];
  refresh: () => Promise<void>;
  retryAll: () => Promise<void>;
  retryOne: (id: string) => Promise<void>;
  discardOne: (id: string) => Promise<void>;
  clearSyncedLog: () => Promise<void>;
}

const Ctx = createContext<OfflineCtx | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const qc = useQueryClient();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState<QueueEntry[]>([]);
  const [recentLog, setRecentLog] = useState<QueueEntry[]>([]);
  const runningRef = useRef(false);

  const refresh = useCallback(async () => {
    const [p, l] = await Promise.all([queue.list(), log.list()]);
    setPending(p);
    setRecentLog(l);
  }, []);

  const drain = useCallback(async () => {
    if (runningRef.current) return;
    if (!navigator.onLine) return;
    runningRef.current = true;
    setSyncing(true);
    try {
      await runSync(qc);
    } finally {
      runningRef.current = false;
      setSyncing(false);
      await refresh();
    }
  }, [qc, refresh]);

  useEffect(() => {
    const onOnline = () => { setOnline(true); void drain(); };
    const onOffline = () => setOnline(false);
    const onFocus = () => { if (navigator.onLine) void drain(); };
    const onQueueChange = () => { void refresh(); if (navigator.onLine) void drain(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);
    window.addEventListener("hypnos:queue-changed", onQueueChange as any);
    void refresh();
    void drain();
    const id = setInterval(() => { if (navigator.onLine) void drain(); }, 30000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("hypnos:queue-changed", onQueueChange as any);
      clearInterval(id);
    };
  }, [drain, refresh]);

  const failed = pending.filter((p) => p.status === "failed");

  const retryAll = useCallback(async () => {
    for (const e of pending) {
      if (e.status === "failed") await queue.update(e.id, { status: "pending", error: null });
    }
    await refresh();
    void drain();
  }, [pending, refresh, drain]);

  const retryOne = useCallback(async (id: string) => {
    await queue.update(id, { status: "pending", error: null });
    await refresh();
    void drain();
  }, [refresh, drain]);

  const discardOne = useCallback(async (id: string) => {
    const entry = pending.find((p) => p.id === id);
    if (entry) await log.push({ ...entry, status: "discarded" });
    await queue.remove(id);
    await refresh();
  }, [pending, refresh]);

  const clearSyncedLog = useCallback(async () => {
    await log.clearSynced();
    await refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ online, syncing, pending, failed, recentLog, refresh, retryAll, retryOne, discardOne, clearSyncedLog }}>
      {children}
    </Ctx.Provider>
  );
};

export const useOffline = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOffline must be used within OfflineProvider");
  return c;
};
