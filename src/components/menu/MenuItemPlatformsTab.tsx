import { useMemo } from "react";
import { useDeliveryPlatforms, useMenuItemPlatformsForItem } from "@/hooks/useDeliveryPlatforms";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  menuItemId: string;
  basePrice: number;
}

export const MenuItemPlatformsTab = ({ menuItemId, basePrice }: Props) => {
  const { language } = useLanguage();
  const { currentBusinessId } = useAuth();
  const { data: platforms = [] } = useDeliveryPlatforms();
  const { data: overrides = [], upsert, remove } = useMenuItemPlatformsForItem(menuItemId);

  const byPlatform = useMemo(() => {
    const m = new Map(overrides.map((o) => [o.platform_id, o]));
    return m;
  }, [overrides]);

  if (platforms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {language === "es" ? "No hay plataformas configuradas" : "No platforms configured"}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {language === "es"
          ? `Precio base: $${basePrice.toFixed(2)}. Si no defines un precio aquí, se usa el base.`
          : `Base price: $${basePrice.toFixed(2)}. If unset, the base price is used.`}
      </p>
      {platforms.map((p) => {
        const ov = byPlatform.get(p.id);
        return (
          <PlatformPriceRow
            key={p.id}
            name={`${p.name} (${p.commission_pct}%)`}
            override={ov}
            onSave={(price, is_available) =>
              upsert.mutateAsync({
                id: ov?.id,
                business_id: currentBusinessId!,
                menu_item_id: menuItemId,
                platform_id: p.id,
                price,
                is_available,
              })
            }
            onClear={ov ? () => remove.mutate(ov.id) : undefined}
            basePrice={basePrice}
          />
        );
      })}
    </div>
  );
};

import { useState, useEffect } from "react";

const PlatformPriceRow = ({
  name, override, onSave, onClear, basePrice,
}: {
  name: string;
  override?: { price: number; is_available: boolean } | undefined;
  onSave: (price: number, is_available: boolean) => Promise<unknown>;
  onClear?: () => void;
  basePrice: number;
}) => {
  const { language } = useLanguage();
  const [price, setPrice] = useState<string>(override ? String(override.price) : "");
  const [active, setActive] = useState<boolean>(override?.is_available ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrice(override ? String(override.price) : "");
    setActive(override?.is_available ?? true);
  }, [override?.price, override?.is_available]);

  const handleSave = async () => {
    const n = Number(price);
    if (!isFinite(n) || n < 0) return;
    setSaving(true);
    try { await onSave(n, active); } finally { setSaving(false); }
  };

  const dirty =
    price !== (override ? String(override.price) : "") ||
    active !== (override?.is_available ?? true);

  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        {override && (
          <Badge variant="outline" className="text-[9px] mt-0.5">
            {language === "es" ? "Personalizado" : "Custom"}
          </Badge>
        )}
      </div>
      <Input
        type="number"
        min={0}
        step="0.01"
        placeholder={`$${basePrice.toFixed(2)}`}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="h-8 w-24"
      />
      <Switch checked={active} onCheckedChange={setActive} />
      <Button size="sm" variant="ghost" disabled={!dirty || !price || saving} onClick={handleSave}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (language === "es" ? "Guardar" : "Save")}
      </Button>
      {onClear && (
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onClear}>
          {language === "es" ? "Quitar" : "Clear"}
        </Button>
      )}
    </div>
  );
};
