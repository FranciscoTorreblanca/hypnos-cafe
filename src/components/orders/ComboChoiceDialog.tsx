import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { ComboWithItems, ChoiceGroup } from "@/hooks/useCombos";
import { MenuItem } from "@/hooks/useMenuItems";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Package, Check } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  combo: ComboWithItems;
  allItems: MenuItem[];
  onConfirm: (combo: ComboWithItems, selectedChoices: { groupLabel: string; menuItem: MenuItem }[]) => void;
}

export const ComboChoiceDialog = ({ open, onOpenChange, combo, allItems, onConfirm }: Props) => {
  const { language } = useLanguage();
  const getName = (item: { name?: string; name_en?: string }) =>
    language === "es" ? item.name : item.name_en || item.name;

  const sortedGroups = useMemo(
    () => [...combo.combo_choice_groups].sort((a, b) => a.display_order - b.display_order),
    [combo]
  );

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    sortedGroups.forEach((g) => {
      const firstAvailable = g.combo_choice_options.find((opt) => {
        const mi = allItems.find((i) => i.id === opt.menu_item_id);
        return mi?.is_available;
      });
      if (firstAvailable) {
        init[g.id] = firstAvailable.menu_item_id;
      }
    });
    return init;
  });

  const allSelected = sortedGroups.every((g) => selections[g.id]);

  const handleConfirm = () => {
    const selectedChoices = sortedGroups.map((g) => {
      const menuItemId = selections[g.id];
      const menuItem = allItems.find((i) => i.id === menuItemId);
      return {
        groupLabel: language === "es" ? g.label : g.label_en || g.label,
        menuItem: menuItem!,
      };
    }).filter((c) => c.menuItem);

    onConfirm(combo, selectedChoices);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 text-base">
            <Package className="h-4 w-4 text-primary" />
            {getName(combo)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Fixed items summary */}
          {combo.combo_items.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground text-sm">{language === "es" ? "Incluye:" : "Includes:"}</p>
              {combo.combo_items.map((ci) => (
                <p key={ci.id} className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-emerald-500" />
                  {ci.quantity}x {getName(ci.menu_items)}
                </p>
              ))}
            </div>
          )}

          {/* Choice groups */}
          {sortedGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <Label className="text-sm font-semibold">
                {language === "es" ? group.label : group.label_en || group.label}
              </Label>
              <RadioGroup
                value={selections[group.id] ?? ""}
                onValueChange={(val) => setSelections((prev) => ({ ...prev, [group.id]: val }))}
                className="space-y-1"
              >
                {group.combo_choice_options.map((opt) => {
                  const mi = allItems.find((i) => i.id === opt.menu_item_id);
                  if (!mi) return null;
                  const unavailable = !mi.is_available;
                  return (
                    <div key={opt.id} className={`flex items-center gap-2 rounded-md border p-2 ${unavailable ? "opacity-40 cursor-not-allowed" : "hover:bg-accent cursor-pointer"}`}
                      onClick={() => !unavailable && setSelections((prev) => ({ ...prev, [group.id]: opt.menu_item_id }))}
                    >
                      <RadioGroupItem value={opt.menu_item_id} id={`choice-${opt.id}`} disabled={unavailable} />
                      <Label htmlFor={`choice-${opt.id}`} className={`flex-1 text-sm ${unavailable ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        {getName(mi)} {unavailable && <span className="text-xs text-muted-foreground">({language === "es" ? "No disponible" : "Unavailable"})</span>}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {language === "es" ? "Cancelar" : "Cancel"}
          </Button>
          <Button onClick={handleConfirm} disabled={!allSelected}>
            {language === "es" ? "Agregar" : "Add"} — ${combo.price.toFixed(0)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
