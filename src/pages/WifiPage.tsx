import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Wifi, Copy, Eye, EyeOff, Share2 } from "lucide-react";

const WifiPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [qr, setQr] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("key, value")
        .in("key", ["wifi_ssid", "wifi_password", "restaurant_name"]);
      const map: Record<string, string> = {};
      (data ?? []).forEach((s) => (map[s.key] = s.value));
      setSsid(map.wifi_ssid ?? "");
      setPassword(map.wifi_password ?? "");
      setRestaurantName(map.restaurant_name ?? "");
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!ssid) {
      setQr("");
      return;
    }
    const esc = (v: string) => v.replace(/([\\;,:"])/g, "\\$1");
    const payload = `WIFI:T:${password ? "WPA" : "nopass"};S:${esc(ssid)};P:${esc(password)};;`;
    QRCode.toDataURL(payload, { width: 480, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [ssid, password]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} ${t("wifi.copied")}` });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const share = async () => {
    const text = `${t("wifi.shareText")}\n${t("wifi.network")}: ${ssid}${password ? `\n${t("wifi.password")}: ${password}` : ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: restaurantName || "WiFi", text });
      } catch {
        /* user cancelled */
      }
    } else {
      copy(text, t("wifi.credentials"));
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md space-y-4">
      <div className="flex items-center gap-2">
        <Wifi className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{t("wifi.title")}</h1>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">…</CardContent>
        </Card>
      ) : !ssid ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("wifi.notConfigured")}</CardTitle>
            <CardDescription>{t("wifi.notConfiguredHint")}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg">{restaurantName || t("wifi.title")}</CardTitle>
              <CardDescription>{t("wifi.scanHint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              {qr && (
                <div className="bg-background p-3 rounded-xl border">
                  <img src={qr} alt="WiFi QR" className="w-64 h-64" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{t("wifi.network")}</div>
                  <div className="font-mono font-semibold truncate">{ssid}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => copy(ssid, t("wifi.network"))}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {password && (
                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">{t("wifi.password")}</div>
                    <div className="font-mono font-semibold truncate">
                      {showPass ? password : "•".repeat(Math.min(password.length, 12))}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowPass((p) => !p)}>
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => copy(password, t("wifi.password"))}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Button className="w-full h-12" onClick={share}>
            <Share2 className="h-4 w-4" />
            {t("wifi.share")}
          </Button>
        </>
      )}
    </div>
  );
};

export default WifiPage;
