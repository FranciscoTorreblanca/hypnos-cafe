import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications, NOTIFICATION_EVENTS } from "@/hooks/usePushNotifications";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, RefreshCw, Building2, Fingerprint, Bike, Smartphone } from "lucide-react";
import { useOrientationPreference, OrientationPreference } from "@/hooks/useOrientationPreference";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APP_VERSION } from "@/version";
import { TimeAttendanceAdmin } from "@/components/attendance/TimeAttendanceAdmin";
import { DeliveryPlatformsAdmin } from "@/components/settings/DeliveryPlatformsAdmin";
import { SyncLog } from "@/components/offline/SyncLog";

interface BusinessInfo {
  name: string; slug: string; legal_name: string | null; tax_id: string | null;
  address: string | null; phone: string | null; email: string | null;
  ticket_header: string | null; ticket_footer: string | null;
  currency: string; language: string; timezone: string;
  vat_rate: number; card_commission_rate: number; status: string;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5 py-1.5 border-b border-border/40 last:border-0 sm:flex-row sm:items-center sm:justify-between">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-medium break-words sm:text-right">{value || "—"}</span>
  </div>
);

const SettingsPage = () => {
  const { t } = useLanguage();
  const { isAdmin, currentBusiness, hasFeature } = useAuth();
  const { toast } = useToast();
  const { isSubscribed, isSupported, permission, loading: pushLoading, subscribe, unsubscribe, enabledEvents, toggleEvent } = usePushNotifications();

  const [info, setInfo] = useState<BusinessInfo | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const { preference: orientation, setPreference: setOrientation } = useOrientationPreference();

  const OrientationCard = (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Orientación / Orientation</CardTitle>
            <CardDescription className="text-sm">
              Elige cómo se muestra la app en este dispositivo. / Choose how the app displays on this device.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Select value={orientation} onValueChange={(v) => setOrientation(v as OrientationPreference)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automático / Auto (device default)</SelectItem>
            <SelectItem value="portrait">Vertical / Portrait</SelectItem>
            <SelectItem value="landscape">Horizontal / Landscape</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          El bloqueo nativo solo funciona en la app instalada (PWA) en algunos navegadores. El diseño se adapta a ambas orientaciones.
          {" / "}
          Native lock only works in the installed app (PWA) on some browsers. The layout adapts to both orientations.
        </p>
      </CardContent>
    </Card>
  );

  useEffect(() => {
    const load = async () => {
      if (!currentBusiness?.id) return;
      const [{ data: biz }, { data: settings }] = await Promise.all([
        supabase.from("businesses")
          .select("name,slug,legal_name,tax_id,address,phone,email,ticket_header,ticket_footer,currency,language,timezone,vat_rate,card_commission_rate,status")
          .eq("id", currentBusiness.id).maybeSingle(),
        supabase.from("restaurant_settings").select("key, value").eq("business_id", currentBusiness.id).eq("key", "push_enabled"),
      ]);
      if (biz) setInfo(biz as BusinessInfo);
      const map: Record<string, string> = {};
      (settings ?? []).forEach((s) => (map[s.key] = s.value));
      setPushEnabled(map.push_enabled !== "false");
    };
    load();
  }, [currentBusiness?.id]);

  const upsertSetting = async (key: string, value: string) => {
    if (!currentBusiness?.id) return;
    const { data } = await supabase.from("restaurant_settings").update({ value }).eq("business_id", currentBusiness.id).eq("key", key).select();
    if (!data || data.length === 0) {
      await supabase.from("restaurant_settings").insert({ key, value, business_id: currentBusiness.id });
    }
  };

  const handleSavePush = async () => {
    setLoading(true);
    try {
      await upsertSetting("push_enabled", pushEnabled ? "true" : "false");
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

  if (!isAdmin) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        {OrientationCard}
        <SyncLog />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>

      <SyncLog />

      {OrientationCard}



      {/* Business info (read-only) */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                {info?.name ?? currentBusiness?.name ?? "—"}
                {info?.status && (
                  <Badge variant={info.status === "active" ? "default" : "secondary"} className="text-[10px]">
                    {info.status}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Read-only business profile. Contact your administrator for changes.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {info ? (
            <div className="space-y-0">
              <Row label="Slug" value={info.slug} />
              <Row label="Legal name" value={info.legal_name} />
              <Row label="Tax ID" value={info.tax_id} />
              <Row label="Email" value={info.email} />
              <Row label="Phone" value={info.phone} />
              <Row label="Address" value={info.address} />
              <Row label="Currency" value={info.currency} />
              <Row label="Language" value={info.language} />
              <Row label="Timezone" value={info.timezone} />
              <Row label="VAT %" value={info.vat_rate} />
              <Row label="Card commission %" value={info.card_commission_rate} />
              <Row label="Ticket header" value={info.ticket_header} />
              <Row label="Ticket footer" value={info.ticket_footer} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
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
                  <div className="space-y-3">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">✓ {t("settings.pushSubscribed")}</p>
                    <div className="rounded-lg border border-border/60 bg-card/40 divide-y divide-border/40">
                      {NOTIFICATION_EVENTS.map((ev) => (
                        <div key={ev.key} className="flex items-start justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{ev.label}</p>
                            <p className="text-xs text-muted-foreground">{ev.description}</p>
                          </div>
                          <Switch
                            checked={enabledEvents.includes(ev.key)}
                            onCheckedChange={(v) => toggleEvent(ev.key, v)}
                          />
                        </div>
                      ))}
                    </div>
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
            <Button onClick={handleSavePush} disabled={loading} className="w-full">
              {loading ? t("common.loading") : t("settings.save")}
            </Button>
          </CardContent>
        </Card>
      )}

      {hasFeature("time_attendance" as any) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">{t("att.title")}</CardTitle>
                <CardDescription className="text-sm">{t("att.subtitle")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TimeAttendanceAdmin />
          </CardContent>
        </Card>
      )}

      {isAdmin && hasFeature("delivery") && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bike className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Delivery</CardTitle>
                <CardDescription className="text-sm">
                  {/* simple label, no i18n entry to add */}
                  Plataformas, comisión y calendario de pagos / Platforms, commission &amp; payout schedule
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DeliveryPlatformsAdmin />
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
