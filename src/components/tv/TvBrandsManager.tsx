import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Plus, Trash2, Tag } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { type TvBrand, useDeleteTvBrand, useTvBrands } from "@/hooks/useTvBrands";
import { TvBrandDialog } from "./TvBrandDialog";

export const TvBrandsManager = () => {
  const { language } = useLanguage();
  const es = language === "es";
  const { toast } = useToast();
  const { data: brands = [], isLoading, error } = useTvBrands();
  const del = useDeleteTvBrand();
  const [edit, setEdit] = useState<TvBrand | null>(null);
  const [open, setOpen] = useState(false);

  const remove = async (b: TvBrand) => {
    if (!confirm(es ? `¿Eliminar la marca "${b.name}"? Sus cervezas quedan sin marca.` : `Delete brand "${b.name}"? Its beers will have no brand.`)) return;
    try { await del.mutateAsync(b.id); } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-1.5"><Tag className="h-4 w-4" />{es ? "Marcas" : "Brands"}</p>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEdit(null); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />{es ? "Nueva" : "New"}
        </Button>
      </div>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      {!isLoading && !brands.length && !error && <p className="text-xs text-muted-foreground">{es ? "Aún no hay marcas." : "No brands yet."}</p>}
      <ul className="divide-y rounded-md border">
        {brands.map((b) => (
          <li key={b.id} className="flex items-center gap-3 p-2 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
              {b.logo_url ? <img src={b.logo_url} alt="" className="h-full w-full object-contain" /> : <Tag className="h-4 w-4 text-muted-foreground" />}
            </div>
            <span className="flex-1 truncate text-sm">{b.name}</span>
            <Button size="icon" variant="ghost" onClick={() => { setEdit(b); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(b)}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>
      <TvBrandDialog open={open} onOpenChange={setOpen} brand={edit} />
    </div>
  );
};
