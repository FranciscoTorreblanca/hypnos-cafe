import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useTableNames, TableNamesMap } from "@/hooks/useTableNames";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bell, RefreshCw, Info } from "lucide-react";
import { APP_VERSION } from "@/version";

const SettingsPage = () => {
  const { t } = useLanguage();
  const { isAdmin, currentBusiness, hasFeature } = useAuth();
  const { toast } = useToast();
  const { tableNames, updateNames } = useTableNames();
  const { isSubscribed, isSupported, permission, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();

  const [tablesCount, setTablesCount] = useState(12);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [localTableNames, setLocalTableNames] = useState<TableNamesMap>({});
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("key, value")
        .in("key", ["tables_count", "push_enabled"]);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((s) => (map[s.key] = s.value));
        if (map.tables_count) setTablesCount(parseInt(map.tables_count) || 12);
        setPushEnabled(map.push_enabled === "true");
      }
    };
    fetchSettings();
  }, [currentBusiness?.id]);

  useEffect(() => { setLocalTableNames(tableNames); }, [tableNames]);

  const upsertSetting = async (key: string, value: string) => {
    const { data } = await supabase.from("restaurant_settings").update({ value }).eq("key", key).select();
    if (!data || data.length === 0) {
      await supabase.from("restaurant_settings").insert({ key, value });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await upsertSetting("tables_count", String(tablesCount));
      await upsertSetting("push_enabled", pushEnabled ? "true" : "false");
      await updateNames.mutateAsync(localTableNames);
      toast({ title: t("settings.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
    setLoading(false);
  };

  const handleForceReload = async () => {
    setReloading(true);
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set("_v", Date.now().toString());
    window.location.replace(url.toString());
  };

  if (!isAdmin) return <p className="text-muted-foreground">{t("common.error")}</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <CardTitle className="text-base">{currentBusiness?.name ?? "—"}</CardTitle>
              <CardDescription>
                Business profile, VAT, ticket info, Mercado Pago and feature flags are managed by the Super Admin in the backoffice.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.tableNames")}</CardTitle>
          <CardDescription>{t("settings.tablesCount")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.tablesCount")}</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={tablesCount}
              onChange={(e) => setTablesCount(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.tableNames")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: tablesCount }, (_, i) => i + 1).map((num) => (
                <div key={num} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6 shrink-0 text-right">{num}</span>
                  <Input
                    placeholder={t("settings.tableNamePlaceholder")}
                    value={localTableNames[String(num)] || ""}
                    onChange={(e) =>
                      setLocalTableNames((prev) => ({ ...prev, [String(num)]: e.target.value }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? t("common.loading") : t("settings.save")}
          </Button>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      {hasFeature("push_notifications") && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">{t("settings.pushNotifications")}</CardTitle>
                <CardDescription className="text-sm">{t("settings.pushDescription")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="push-toggle">{t("settings.pushEnabled")}</Label>
              <Switch
                id="push-toggle"
                checked={pushEnabled}
                onCheckedChange={(checked) => setPushEnabled(checked)}
              />
            </div>
            {pushEnabled && (
              <div className="space-y-3">
                {!isSupported ? (
                  <p className="text-sm text-muted-foreground">{t("settings.pushNotSupported")}</p>
                ) : permission === "denied" ? (
                  <p className="text-sm text-destructive">{t("settings.pushPermissionDenied")}</p>
                ) : isSubscribed ? (
                  <div className="space-y-2">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">✓ {t("settings.pushSubscribed")}</p>
                    <Button variant="outline" size="sm" onClick={unsubscribe} disabled={pushLoading}>
                      {t("settings.pushUnsubscribe")}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={subscribe} disabled={pushLoading}>
                    {t("settings.pushSubscribe")}
                  </Button>
                )}
              </div>
            )}
            <Button onClick={handleSave} disabled={loading} className="w-full">
              {loading ? t("common.loading") : t("settings.save")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* App Updates */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">{t("settings.appUpdates")}</CardTitle>
              <CardDescription className="text-sm">{t("settings.appUpdatesDescription")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("settings.currentVersion")}</span>
            <code className="rounded bg-muted px-2 py-1 text-xs font-mono">v{APP_VERSION}</code>
          </div>
          <Button onClick={handleForceReload} disabled={reloading} variant="outline" className="w-full gap-2">
            <RefreshCw className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`} />
            {reloading ? t("settings.reloading") : t("settings.checkForUpdates")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
