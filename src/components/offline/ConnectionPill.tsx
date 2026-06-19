import { useOffline } from "@/offline/OfflineProvider";
import { useLanguage } from "@/i18n/LanguageContext";
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export const ConnectionPill = ({ className }: { className?: string }) => {
  const { online, syncing, pending, failed } = useOffline();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const pendingCount = pending.length;
  const failedCount = failed.length;

  let icon = <Wifi className="h-3.5 w-3.5" />;
  let label: string = t("offline.online");
  let tone = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";

  if (!online) {
    icon = <WifiOff className="h-3.5 w-3.5" />;
    label = pendingCount ? `${t("offline.offline")} · ${pendingCount}` : t("offline.offline");
    tone = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40";
  } else if (failedCount > 0) {
    icon = <AlertTriangle className="h-3.5 w-3.5" />;
    label = `${t("offline.syncError")} · ${failedCount}`;
    tone = "bg-destructive/15 text-destructive border-destructive/40";
  } else if (syncing || pendingCount > 0) {
    icon = <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    label = `${t("offline.syncing")} ${pendingCount > 0 ? `· ${pendingCount}` : ""}`.trim();
    tone = "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40";
  }

  // Hide when fully synced & online to reduce noise — pure online shows nothing
  if (online && !syncing && pendingCount === 0 && failedCount === 0) return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/settings?tab=sync")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        tone,
        className,
      )}
      aria-label={label}
    >
      {icon}
      <span className="truncate max-w-[140px]">{label}</span>
    </button>
  );
};
