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
import { CreditCard, Eye, EyeOff, Bell, RefreshCw } from "lucide-react";
import { APP_VERSION } from "@/version";

interface SettingsMap {
  restaurant_name: string;
  tax_rate: string;
  currency: string;
  language: string;
  tables_count: string;
  mp_enabled: string;
  mp_device_id: string;
  mp_token_set: string;
  push_enabled: string;
  business_address: string;
  business_phone: string;
  business_rfc: string;
  wifi_ssid: string;
  wifi_password: string;
}

const SettingsPage = () => {
  const { t } = useLanguage();
  const { isAdmin, currentBusinessId } = useAuth();
  const { toast } = useToast();
  const { tableNames, updateNames } = useTableNames();
  const { isSubscribed, isSupported, permission, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [settings, setSettings] = useState<SettingsMap>({
    restaurant_name: "",
    tax_rate: "16",
    currency: "MXN",
    language: "es",
    tables_count: "12",
    mp_enabled: "false",
    mp_device_id: "",
    mp_token_set: "false",
    push_enabled: "false",
    business_address: "",
    business_phone: "",
    business_rfc: "",
    wifi_ssid: "",
    wifi_password: "",
  });
  const [localTableNames, setLocalTableNames] = useState<TableNamesMap>({});
  const [loading, setLoading] = useState(false);

  // MP token input (not stored in restaurant_settings, goes to secrets)
  const [mpToken, setMpToken] = useState("");
  const [mpTokenSaving, setMpTokenSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [reloading, setReloading] = useState(false);

  const handleForceReload = async () => {
    setReloading(true);
    try {
      // Clear all Cache Storage entries (Workbox/PWA caches)
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // Unregister service workers so the next load fetches a fresh one
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      toast({ title: t("settings.updateApplied") });
    } catch {
      // Ignore — still try to reload
    }
    // Hard reload bypassing HTTP cache via cache-busting query param
    const url = new URL(window.location.href);
    url.searchParams.set("_v", Date.now().toString());
    window.location.replace(url.toString());
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("restaurant_settings").select("key, value");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((s) => (map[s.key] = s.value));
        setSettings((prev) => ({ ...prev, ...map } as SettingsMap));
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    setLocalTableNames(tableNames);
  }, [tableNames]);

  const handleSave = async () => {
    setLoading(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        if (key === "mp_token_set") continue; // read-only flag
        // Upsert: try update, if no rows affected, insert
        const { data } = await supabase
          .from("restaurant_settings")
          .update({ value })
          .eq("key", key)
          .select();
        if (!data || data.length === 0) {
          await supabase.from("restaurant_settings").insert({ key, value });
        }
      }
      await updateNames.mutateAsync(localTableNames);
      toast({ title: t("settings.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSaveToken = async () => {
    if (!mpToken.trim()) return;
    setMpTokenSaving(true);
    try {
      // Save token via edge function that stores it as a secret
      const { error } = await supabase.functions.invoke("save-mp-token", {
        body: { token: mpToken.trim(), business_id: currentBusinessId },
      });
      if (error) throw error;

      // Mark token as set in settings
      setSettings((prev) => ({ ...prev, mp_token_set: "true" }));
      const { data } = await supabase
        .from("restaurant_settings")
        .update({ value: "true" })
        .eq("key", "mp_token_set")
        .select();
      if (!data || data.length === 0) {
        await supabase.from("restaurant_settings").insert({ key: "mp_token_set", value: "true" });
      }

      setMpToken("");
      toast({ title: t("settings.mpTokenSaved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
    setMpTokenSaving(false);
  };

  if (!isAdmin) {
    return <p className="text-muted-foreground">{t("common.error")}</p>;
  }

  const fields: { key: keyof SettingsMap; label: string; type?: string }[] = [
    { key: "restaurant_name", label: t("settings.restaurantName") },
    { key: "tax_rate", label: t("settings.taxRate"), type: "number" },
    { key: "tables_count", label: t("settings.tablesCount"), type: "number" },
  ];

  const tablesCount = parseInt(settings.tables_count) || 12;
  const mpEnabled = settings.mp_enabled === "true";
  const pushEnabled = settings.push_enabled === "true";

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label>{field.label}</Label>
              <Input
                type={field.type || "text"}
                value={settings[field.key]}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
            </div>
          ))}

          {/* Table Names */}
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
                      setLocalTableNames((prev) => ({
                        ...prev,
                        [String(num)]: e.target.value,
                      }))
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

      {/* Business info for tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.businessInfo")}</CardTitle>
          <CardDescription className="text-sm">{t("settings.businessInfoDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.businessAddress")}</Label>
            <Input
              value={settings.business_address}
              onChange={(e) => setSettings((p) => ({ ...p, business_address: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("settings.businessPhone")}</Label>
              <Input
                value={settings.business_phone}
                onChange={(e) => setSettings((p) => ({ ...p, business_phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.businessRfc")}</Label>
              <Input
                value={settings.business_rfc}
                onChange={(e) => setSettings((p) => ({ ...p, business_rfc: e.target.value }))}
              />
            </div>
          </div>
          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-semibold">{t("settings.wifi")}</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("settings.wifiSsid")}</Label>
                <Input
                  value={settings.wifi_ssid}
                  onChange={(e) => setSettings((p) => ({ ...p, wifi_ssid: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("settings.wifiPassword")}</Label>
                <Input
                  value={settings.wifi_password}
                  onChange={(e) => setSettings((p) => ({ ...p, wifi_password: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? t("common.loading") : t("settings.save")}
          </Button>
        </CardContent>
      </Card>

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

      {/* Mercado Pago Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">{t("settings.mercadoPago")}</CardTitle>
              <CardDescription className="text-sm">{t("settings.mpDescription")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="mp-toggle">{t("settings.mpEnabled")}</Label>
            <Switch
              id="mp-toggle"
              checked={mpEnabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, mp_enabled: checked ? "true" : "false" }))
              }
            />
          </div>

          {mpEnabled && (
            <>
              {/* Device ID */}
              <div className="space-y-2">
                <Label>{t("settings.mpDeviceId")}</Label>
                <Input
                  placeholder="e.g. PAX_A910__SMARTPOS1234567890"
                  value={settings.mp_device_id}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, mp_device_id: e.target.value }))
                  }
                />
              </div>

              {/* Access Token */}
              <div className="space-y-2">
                <Label>{t("settings.mpAccessToken")}</Label>
                {settings.mp_token_set === "true" && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{t("settings.mpAccessTokenSet")}</p>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showToken ? "text" : "password"}
                      placeholder={t("settings.mpAccessTokenPlaceholder")}
                      value={mpToken}
                      onChange={(e) => setMpToken(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <Button onClick={handleSaveToken} disabled={mpTokenSaving || !mpToken.trim()} size="sm">
                    {mpTokenSaving ? t("settings.mpSavingToken") : t("common.save")}
                  </Button>
                </div>
              </div>

              <Button onClick={handleSave} disabled={loading} className="w-full">
                {loading ? t("common.loading") : t("settings.save")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications */}
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
          {/* Global toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="push-toggle">{t("settings.pushEnabled")}</Label>
            <Switch
              id="push-toggle"
              checked={pushEnabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, push_enabled: checked ? "true" : "false" }))
              }
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

              <Button onClick={handleSave} disabled={loading} className="w-full">
                {loading ? t("common.loading") : t("settings.save")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
