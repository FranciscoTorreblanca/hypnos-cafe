import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_HOURS, type OpeningHours } from "@/hooks/useSchedule";

export const DAY_NAMES = {
  es: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

export const OpeningHoursAdmin = () => {
  const { currentBusinessId } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS);
  const es = language === "es";

  useEffect(() => {
    if (!currentBusinessId) return;
    supabase.from("restaurant_settings").select("value").eq("business_id", currentBusinessId).eq("key", "opening_hours").maybeSingle()
      .then(({ data }) => { try { if (data?.value) setHours({ ...DEFAULT_HOURS, ...JSON.parse(data.value) }); } catch { /* ignore */ } });
  }, [currentBusinessId]);

  const save = async () => {
    if (!currentBusinessId) return;
    const value = JSON.stringify(hours);
    const { data } = await supabase.from("restaurant_settings").update({ value }).eq("business_id", currentBusinessId).eq("key", "opening_hours").select();
    let error = null;
    if (!data?.length) ({ error } = await supabase.from("restaurant_settings").insert({ key: "opening_hours", value, business_id: currentBusinessId }));
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["schedule"] });
    toast({ title: es ? "Horario guardado" : "Hours saved" });
  };

  const set = (i: number, patch: Partial<OpeningHours[string]>) =>
    setHours((h) => ({ ...h, [String(i)]: { ...h[String(i)], ...patch } }));

  return (
    <div className="space-y-2">
      {DAY_NAMES[language].map((name, i) => {
        const d = hours[String(i)];
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0">{name}</span>
            <Switch checked={!d.closed} onCheckedChange={(v) => set(i, { closed: !v })} />
            {d.closed ? (
              <span className="text-muted-foreground">{es ? "Cerrado" : "Closed"}</span>
            ) : (
              <>
                <Input type="time" className="h-8" value={d.open} onChange={(e) => set(i, { open: e.target.value })} />
                <Input type="time" className="h-8" value={d.close} onChange={(e) => set(i, { close: e.target.value })} />
              </>
            )}
          </div>
        );
      })}
      <Button onClick={save} className="w-full mt-2">{es ? "Guardar horario" : "Save hours"}</Button>
    </div>
  );
};
