import { useOffline } from "@/offline/OfflineProvider";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, X, Trash2 } from "lucide-react";

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (s) {
    case "pending": return "secondary";
    case "syncing": return "default";
    case "failed": return "destructive";
    case "synced": return "outline";
    case "discarded": return "outline";
    default: return "secondary";
  }
};

export const SyncLog = () => {
  const { t } = useLanguage();
  const { online, syncing, pending, recentLog, retryAll, retryOne, discardOne, clearSyncedLog } = useOffline();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{t("offline.syncLog")}</CardTitle>
            <CardDescription>
              {online ? t("offline.online") : t("offline.offline")}
              {syncing ? ` · ${t("offline.syncing")}` : ""}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={retryAll} disabled={!pending.some((p) => p.status === "failed")}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> {t("offline.retryAll")}
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSyncedLog}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> {t("offline.clearSynced")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t("offline.pendingChanges")} ({pending.length})</h4>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("offline.noPending")}</p>
          ) : (
            <div className="space-y-1.5">
              {pending.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(p.status)} className="text-[10px]">{t(`offline.status.${p.status}`)}</Badge>
                      <span className="font-medium truncate">{p.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</div>
                    {p.error && <div className="text-xs text-destructive truncate">{p.error}</div>}
                  </div>
                  <div className="flex gap-1">
                    {p.status === "failed" && (
                      <Button size="icon" variant="ghost" onClick={() => retryOne(p.id)} title={t("offline.retry")}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => discardOne(p.id)} title={t("offline.discard")}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent log */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t("offline.recentActivity")}</h4>
          {recentLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("offline.noActivity")}</p>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {recentLog.slice(0, 50).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-1 text-xs">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant={statusVariant(p.status)} className="text-[10px]">{t(`offline.status.${p.status}`)}</Badge>
                    <span className="truncate">{p.label}</span>
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(p.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
