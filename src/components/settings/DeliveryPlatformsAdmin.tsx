import { useEffect, useState } from "react";
import { useDeliveryPlatforms, type DeliveryPlatform } from "@/hooks/useDeliveryPlatforms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Loader2, Save } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const WEEKDAYS_ES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const WEEKDAYS_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export const DeliveryPlatformsAdmin = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { data: platforms = [], isLoading, upsert, remove, ensureDefault } = useDeliveryPlatforms();
  const [adding, setAdding] = useState(false);

  // Seed Rappi once when none exist
  useEffect(() => {
    if (!isLoading && platforms.length === 0) {
      ensureDefault.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, platforms.length]);

  const weekdays = language === "es" ? WEEKDAYS_ES : WEEKDAYS_EN;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {platforms.map((p) => <PlatformRow key={p.id} platform={p} weekdays={weekdays} onSave={(d) => upsert.mutateAsync(d)} onDelete={() => remove.mutate(p.id)} />)}
        {platforms.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground text-center py-3">
            {language === "es" ? "Sin plataformas" : "No platforms"}
          </p>
        )}
      </div>

      {adding ? (
        <PlatformRow
          platform={{ id: "" as any, business_id: "", name: "", slug: "", commission_pct: 25, payout_weekday: 5, payout_offset_days: 7, is_active: true }}
          weekdays={weekdays}
          isNew
          onCancel={() => setAdding(false)}
          onSave={async (d) => {
            await upsert.mutateAsync(d);
            setAdding(false);
            toast({ title: language === "es" ? "Plataforma agregada" : "Platform added" });
          }}
        />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {language === "es" ? "Agregar plataforma" : "Add platform"}
        </Button>
      )}
    </div>
  );
};

interface RowProps {
  platform: DeliveryPlatform;
  weekdays: string[];
  isNew?: boolean;
  onCancel?: () => void;
  onSave: (data: Partial<DeliveryPlatform> & { name: string; slug: string; commission_pct: number }) => Promise<unknown>;
  onDelete?: () => void;
}

const PlatformRow = ({ platform, weekdays, isNew, onCancel, onSave, onDelete }: RowProps) => {
  const { language } = useLanguage();
  const [name, setName] = useState(platform.name);
  const [slug, setSlug] = useState(platform.slug);
  const [pct, setPct] = useState<number>(platform.commission_pct);
  const [weekday, setWeekday] = useState<number>(platform.payout_weekday ?? 5);
  const [offset, setOffset] = useState<number>(platform.payout_offset_days ?? 7);
  const [active, setActive] = useState<boolean>(platform.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: isNew ? undefined : platform.id,
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        commission_pct: pct,
        payout_weekday: weekday,
        payout_offset_days: offset,
        is_active: active,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={language === "es" ? "Nombre (Rappi)" : "Name"} className="h-8" />
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" className="h-8 w-28" />
        <Switch checked={active} onCheckedChange={setActive} />
        {!isNew && <Badge variant="outline" className="text-[10px]">{active ? "ON" : "OFF"}</Badge>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{language === "es" ? "Comisión %" : "Commission %"}</Label>
          <Input type="number" min={0} max={100} step={0.1} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{language === "es" ? "Día de pago" : "Payout day"}</Label>
          <select className="h-8 w-full rounded-md border bg-background px-2 text-sm" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
            {weekdays.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{language === "es" ? "Días de demora" : "Payout offset (days)"}</Label>
          <Input type="number" min={0} max={30} value={offset} onChange={(e) => setOffset(Number(e.target.value))} className="h-8" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {isNew && <Button size="sm" variant="ghost" onClick={onCancel}>{language === "es" ? "Cancelar" : "Cancel"}</Button>}
        {!isNew && onDelete && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim() || !slug.trim()}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
};
