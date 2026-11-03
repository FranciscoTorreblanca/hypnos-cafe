import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ImagePlus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { type TvBrand, uploadBrandLogo, useSaveTvBrand } from "@/hooks/useTvBrands";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  brand?: TvBrand | null;
  onSaved?: (b: TvBrand) => void;
}

export const TvBrandDialog = ({ open, onOpenChange, brand, onSaved }: Props) => {
  const { language } = useLanguage();
  const es = language === "es";
  const { currentBusinessId } = useAuth();
  const { toast } = useToast();
  const save = useSaveTvBrand();
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setName(brand?.name ?? ""); setLogo(brand?.logo_url ?? null); }
  }, [open, brand]);

  const onFile = async (f?: File) => {
    if (!f || !currentBusinessId) return;
    setUploading(true);
    try { setLogo(await uploadBrandLogo(currentBusinessId, f)); }
    catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!name.trim()) return;
    try {
      const b = await save.mutateAsync({ id: brand?.id, name: name.trim().slice(0, 120), logo_url: logo });
      toast({ title: es ? "Marca guardada" : "Brand saved" });
      onSaved?.(b ?? { id: brand?.id ?? "", name: name.trim(), logo_url: logo });
      onOpenChange(false);
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-sm p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{brand ? (es ? "Editar marca" : "Edit brand") : (es ? "Nueva marca" : "New brand")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 min-w-0">
          <div>
            <Label>{es ? "Nombre" : "Name"}</Label>
            <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Minerva" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {logo ? (es ? "Cambiar" : "Change") : (es ? "Subir logo" : "Upload logo")}
                </Button>
                {logo && <Button type="button" size="sm" variant="ghost" onClick={() => setLogo(null)}><X className="h-4 w-4 mr-1" />{es ? "Quitar" : "Remove"}</Button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </div>
          <Button type="button" className="w-full" onClick={submit} disabled={!name.trim() || save.isPending || uploading}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {es ? "Guardar marca" : "Save brand"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
