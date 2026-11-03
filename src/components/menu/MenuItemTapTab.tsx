import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Save } from "lucide-react";

interface Pres { label: string; price: string; promo_price: string; promo_label: string }

export const MenuItemTapTab = ({ menuItemId }: { menuItemId: string }) => {
  const { language } = useLanguage();
  const es = language === "es";
  const { currentBusinessId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const db = supabase as any;

  const { data, isLoading } = useQuery({
    queryKey: ["menu-item-presentations", menuItemId],
    queryFn: async () => {
      const [{ data: item }, { data: pres }] = await Promise.all([
        db.from("menu_items").select("beer_style,beer_abv,beer_brewery").eq("id", menuItemId).single(),
        db.from("menu_item_presentations").select("*").eq("menu_item_id", menuItemId).order("display_order"),
      ]);
      return { item, pres: pres ?? [] };
    },
  });

  const [style, setStyle] = useState("");
  const [abv, setAbv] = useState("");
  const [brewery, setBrewery] = useState("");
  const [rows, setRows] = useState<Pres[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setStyle(data.item?.beer_style ?? "");
    setAbv(data.item?.beer_abv?.toString() ?? "");
    setBrewery(data.item?.beer_brewery ?? "");
    setRows(data.pres.map((p: any) => ({
      label: p.label, price: String(p.price), promo_price: p.promo_price?.toString() ?? "", promo_label: p.promo_label ?? "",
    })));
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const num = (v: string) => (v.trim() === "" ? null : Number(v));
      const { error } = await db.from("menu_items").update({
        beer_style: style.trim() || null, beer_abv: num(abv), beer_brewery: brewery.trim() || null,
      }).eq("id", menuItemId);
      if (error) throw error;
      const { error: delErr } = await db.from("menu_item_presentations").delete().eq("menu_item_id", menuItemId);
      if (delErr) throw delErr;
      const valid = rows.filter((r) => r.label.trim());
      if (valid.length) {
        const { error: insErr } = await db.from("menu_item_presentations").insert(valid.map((r, i) => ({
          business_id: currentBusinessId, menu_item_id: menuItemId, label: r.label.trim(),
          price: Number(r.price) || 0, promo_price: num(r.promo_price), promo_label: r.promo_label.trim() || null, display_order: i,
        })));
        if (insErr) throw insErr;
      }
      await qc.invalidateQueries({ queryKey: ["menu-item-presentations"] });
      await qc.invalidateQueries({ queryKey: ["menu_items"] });
      toast({ title: es ? "Datos de barril guardados" : "Tap details saved" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (isLoading) return <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const set = (i: number, k: keyof Pres, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {es ? "Se muestra en la pantalla de Hypnos TV." : "Shown on the Hypnos TV screen."}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>{es ? "Cervecería / Marca" : "Brewery / Brand"}</Label><Input value={brewery} onChange={(e) => setBrewery(e.target.value)} /></div>
        <div><Label>{es ? "Estilo" : "Style"}</Label><Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="IPA" /></div>
        <div><Label>ABV %</Label><Input type="number" step="0.1" inputMode="decimal" value={abv} onChange={(e) => setAbv(e.target.value)} /></div>
      </div>
      <div className="space-y-2">
        <Label>{es ? "Tamaños y precios" : "Sizes & prices"}</Label>
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">{es ? "Sin tamaños: se usa el precio del artículo." : "No sizes: the item price is used."}</p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-2 items-center rounded-md border p-2">
            <Input placeholder={es ? "Pinta" : "Pint"} value={r.label} onChange={(e) => set(i, "label", e.target.value)} />
            <Input type="number" inputMode="decimal" placeholder={es ? "Precio" : "Price"} value={r.price} onChange={(e) => set(i, "price", e.target.value)} />
            <Input type="number" inputMode="decimal" placeholder="Promo $" value={r.promo_price} onChange={(e) => set(i, "promo_price", e.target.value)} />
            <Button type="button" size="icon" variant="ghost" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            <Input className="col-span-3" placeholder={es ? "Texto promo (ej. 2x1)" : "Promo label (e.g. 2x1)"} value={r.promo_label} onChange={(e) => set(i, "promo_label", e.target.value)} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setRows((x) => [...x, { label: "", price: "", promo_price: "", promo_label: "" }])}>
          <Plus className="h-3.5 w-3.5" /> {es ? "Agregar tamaño" : "Add size"}
        </Button>
      </div>
      <Button type="button" onClick={save} disabled={saving} className="gap-1.5 w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {es ? "Guardar datos de barril" : "Save tap details"}
      </Button>
    </div>
  );
};
