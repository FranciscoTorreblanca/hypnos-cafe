import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { runPrefetch, type PrefetchProgress } from "@/offline/prefetch";
import { Progress } from "@/components/ui/progress";
import { Download, CheckCircle2 } from "lucide-react";

const storageKey = (bizId: string) => `hypnos.offlineInstalled:${bizId}`;

export function FirstRunBanner() {
  const qc = useQueryClient();
  const { currentBusinessId } = useAuth();
  const { language } = useLanguage();
  const [progress, setProgress] = useState<PrefetchProgress | null>(null);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!currentBusinessId) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(storageKey(currentBusinessId))) return;
    if (!navigator.onLine) return;

    let cancelled = false;
    (async () => {
      setProgress({ current: 0, total: 1, label: null });
      await runPrefetch(qc, (p) => { if (!cancelled) setProgress(p); });
      if (cancelled) return;
      localStorage.setItem(storageKey(currentBusinessId), String(Date.now()));
      setDone(true);
      setTimeout(() => setHidden(true), 2500);
    })();
    return () => { cancelled = true; };
  }, [currentBusinessId, qc]);

  if (hidden || !progress) return null;

  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
  const label = progress.label?.[language] ?? "";

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        {done ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Download className="h-4 w-4 text-primary animate-pulse" />}
        <div className="text-sm font-medium">
          {done
            ? (language === "es" ? "Modo offline listo" : "Offline mode ready")
            : (language === "es" ? "Preparando modo offline…" : "Preparing offline mode…")}
        </div>
        <div className="ml-auto text-xs text-muted-foreground">{pct}%</div>
      </div>
      <Progress value={pct} className="h-1.5" />
      {!done && label && (
        <div className="mt-1 text-xs text-muted-foreground truncate">{label}</div>
      )}
    </div>
  );
}
