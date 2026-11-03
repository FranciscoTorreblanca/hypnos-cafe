import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Tv } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTvBrands } from "@/hooks/useTvBrands";
import { TvBrandDialog } from "@/components/tv/TvBrandDialog";

export interface PriceRow { label: string; price: string; promo_price: string; promo_label: string }

export const useItemPresentations = (menuItemId?: string) =>
  useQuery({
    queryKey: ["menu-item-presentations", menuItemId],
    enabled: !!menuItemId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("menu_item_presentations").select("*").eq("menu_item_id", menuItemId).order("display_order");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        label: p.label, price: String(p.price), promo_price: p.promo_price?.toString() ?? "", promo_label: p.promo_label ?? "",
      })) as PriceRow[];
    },
  });

export async function saveItemPresentations(businessId: string, menuItemId: string, rows: PriceRow[]) {
  const db = supabase as any;
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const { error: delErr } = await db.from("menu_item_presentations").delete().eq("menu_item_id", menuItemId);
  if (delErr) throw delErr;
  const valid = rows.filter((r) => r.label.trim());
  if (!valid.length) return;
  const { error } = await db.from("menu_item_presentations").insert(valid.map((r, i) => ({
    business_id: businessId, menu_item_id: menuItemId, label: r.label.trim(),
    price: Number(r.price) || 0, promo_price: num(r.promo_price), promo_label: r.promo_label.trim() || null, display_order: i,
  })));
  if (error) throw error;
}

/** Optional extra labelled prices (e.g. Media / Jarra). The main price stays the item's price + promo. */
export const ExtraPricesEditor = ({ rows, onChange, disabled }: { rows: PriceRow[]; onChange: (r: PriceRow[]) => void; disabled?: boolean }) => {
  const { language } = useLanguage();
  const es = language === "es";
  const set = (i: number, k: keyof PriceRow, v: string) => onChange(rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="space-y-2 min-w-0">
      <Label className="text-sm">{es ? "Precios adicionales (opcional)" : "Extra prices (optional)"}</Label>
      <p className="text-[11px] text-muted-foreground">
        {disabled
          ? (es ? "Guarda el artículo primero para agregar más tamaños." : "Save the item first to add more sizes.")
          : (es ? "Otros tamaños con su propio precio. El precio principal y su promo de arriba siempre se usan como el primero." : "Other sizes with their own price. The main price and promo above always come first.")}
      </p>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-2 items-center rounded-md border p-2 min-w-0">
          <Input placeholder={es ? "Jarra" : "Pitcher"} value={r.label} onChange={(e) => set(i, "label", e.target.value)} />
          <Input type="number" inputMode="decimal" placeholder={es ? "Precio" : "Price"} value={r.price} onChange={(e) => set(i, "price", e.target.value)} />
          <Input type="number" inputMode="decimal" placeholder="Promo $" value={r.promo_price} onChange={(e) => set(i, "promo_price", e.target.value)} />
          <Button type="button" size="icon" variant="ghost" aria-label={es ? "Quitar" : "Remove"} onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          <Input className="col-span-3 sm:col-span-4" placeholder={es ? "Texto promo (ej. 2x1)" : "Promo label (e.g. 2x1)"} value={r.promo_label} onChange={(e) => set(i, "promo_label", e.target.value)} />
        </div>
      ))}
      {!disabled && (
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => onChange([...rows, { label: "", price: "", promo_price: "", promo_label: "" }])}>
          <Plus className="h-3.5 w-3.5" /> {es ? "Agregar precio" : "Add price"}
        </Button>
      )}
    </div>
  );
};

export const TvBadge = () => (
  <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]"><Tv className="h-3 w-3" />TV</Badge>
);

/** Brand / style / ABV for tap list items. Brand must be picked from the Hypnos TV brand list. */
export const TapFields = ({
  brandId, onBrand, style, onStyle, abv, onAbv, previousBrewery,
}: {
  brandId: string | null; onBrand: (id: string | null, name: string | null) => void;
  style: string; onStyle: (v: string) => void; abv: string; onAbv: (v: string) => void; previousBrewery?: string | null;
}) => {
  const { language } = useLanguage();
  const es = language === "es";
  const { data: brands = [], isLoading } = useTvBrands();
  const brand = brands.find((b) => b.id === brandId) ?? null;
  const [dlg, setDlg] = useState<"new" | "edit" | null>(null);
  return (
    <div className="space-y-3 rounded-md border border-dashed p-3 min-w-0">
      <div className="flex items-center gap-2 text-sm font-medium"><TvBadge />{es ? "Datos de barril" : "Tap details"}</div>
      <p className="text-[11px] text-muted-foreground">
        {es ? "La marca se muestra en todo el menú como \"Marca - Nombre\". Estilo y ABV solo se ven en Hypnos TV." : "The brand shows across the menu as \"Brand - Name\". Style and ABV only appear on Hypnos TV."}
      </p>
      <div className="min-w-0">
        <Label>{es ? "Marca" : "Brand"}</Label>
        <div className="flex gap-2 min-w-0">
          <Select value={brandId || "none"} onValueChange={(v) => {
            if (v === "none") return onBrand(null, null);
            onBrand(v, brands.find((b) => b.id === v)?.name ?? null);
          }} disabled={isLoading}>
            <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder={es ? "Elegir marca" : "Choose brand"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{es ? "Sin marca" : "No brand"}</SelectItem>
              {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {brand && <Button type="button" size="icon" variant="outline" aria-label={es ? "Editar marca" : "Edit brand"} onClick={() => setDlg("edit")}><Pencil className="h-4 w-4" /></Button>}
          <Button type="button" size="icon" variant="outline" aria-label={es ? "Nueva marca" : "New brand"} onClick={() => setDlg("new")}><Plus className="h-4 w-4" /></Button>
        </div>
        {!brandId && previousBrewery && (
          <p className="text-[11px] text-muted-foreground mt-1">{es ? `Antes: "${previousBrewery}". Elige o crea la marca.` : `Previously: "${previousBrewery}". Pick or create the brand.`}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0"><Label>{es ? "Estilo" : "Style"}</Label><Input value={style} onChange={(e) => onStyle(e.target.value)} placeholder="IPA" /></div>
        <div className="min-w-0"><Label>ABV %</Label><Input type="number" step="0.1" inputMode="decimal" value={abv} onChange={(e) => onAbv(e.target.value)} /></div>
      </div>
      <TvBrandDialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} brand={dlg === "edit" ? brand : null}
        onSaved={(b) => { if (b?.id) onBrand(b.id, b.name); }} />
    </div>
  );
};
