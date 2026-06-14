import { useState, useMemo, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { MenuItem, MenuItemAddon, getEffectivePrice } from "@/hooks/useMenuItems";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MenuItem;
  onConfirm: (selected: MenuItemAddon[], notes: string) => void;
}

export const MenuItemAddonsDialog = ({ open, onOpenChange, item, onConfirm }: Props) => {
  const { language } = useLanguage();
  const addons = useMemo(
    () => (item.menu_item_addons ?? []).slice().sort((a, b) => a.display_order - b.display_order),
    [item],
  );

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setSelected({});
      setNotes("");
    }
  }, [open, item.id]);

  const getName = (a: { name: string; name_en: string }) =>
    language === "es" ? a.name : a.name_en || a.name;

  const base = getEffectivePrice(item);
  const extras = addons.reduce((s, a) => s + (selected[a.id] ? Number(a.extra_price) : 0), 0);
  const total = base + extras;

  const handleConfirm = () => {
    const chosen = addons.filter((a) => selected[a.id]);
    onConfirm(chosen, notes.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85dvh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-1.5 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {language === "es" ? item.name : item.name_en || item.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 overflow-y-auto flex-1 min-h-0">
          <p className="text-xs text-muted-foreground">
            {language === "es"
              ? "Selecciona los extras que quieras añadir."
              : "Choose the extras you want to add."}
          </p>

          <div className="space-y-1.5">
            {addons.map((a) => {
              const isChecked = !!selected[a.id];
              return (
                <label
                  key={a.id}
                  htmlFor={`addon-${a.id}`}
                  className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer transition-colors ${
                    isChecked ? "bg-primary/5 border-primary/40" : "hover:bg-accent"
                  }`}
                >
                  <Checkbox
                    id={`addon-${a.id}`}
                    checked={isChecked}
                    onCheckedChange={(v) =>
                      setSelected((prev) => ({ ...prev, [a.id]: !!v }))
                    }
                  />
                  <span className="flex-1 text-sm">{getName(a)}</span>
                  {Number(a.extra_price) > 0 ? (
                    <span className="text-xs font-semibold text-primary">
                      +${Number(a.extra_price).toFixed(0)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      {language === "es" ? "Gratis" : "Free"}
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              {language === "es" ? "Notas (opcional)" : "Notes (optional)"}
            </Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === "es" ? "Sin cebolla, término medio…" : "No onion, medium rare…"}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {language === "es" ? "Cancelar" : "Cancel"}
          </Button>
          <Button onClick={handleConfirm}>
            {language === "es" ? "Agregar" : "Add"} — ${total.toFixed(0)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
