import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useTableNames, TableNamesMap } from "@/hooks/useTableNames";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SettingsMap {
  restaurant_name: string;
  tax_rate: string;
  currency: string;
  language: string;
  tables_count: string;
}

const SettingsPage = () => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { tableNames, updateNames } = useTableNames();
  const [settings, setSettings] = useState<SettingsMap>({
    restaurant_name: "",
    tax_rate: "16",
    currency: "MXN",
    language: "es",
    tables_count: "12",
  });
  const [localTableNames, setLocalTableNames] = useState<TableNamesMap>({});
  const [loading, setLoading] = useState(false);

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
        await supabase
          .from("restaurant_settings")
          .update({ value })
          .eq("key", key);
      }
      await updateNames.mutateAsync(localTableNames);
      toast({ title: t("settings.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
    setLoading(false);
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

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
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
    </div>
  );
};

export default SettingsPage;
