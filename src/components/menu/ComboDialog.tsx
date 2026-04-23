import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ComboWithItems, ChoiceGroupInput } from "@/hooks/useCombos";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, Package, ListChecks, X } from "lucide-react";
import {
  MenuItemFilters,
  applyMenuItemFilters,
  emptyFilters,
  type MenuItemFilterState,
} from "./MenuItemFilters";

const schema = z.object({
  name: z.string().min(1),
  name_en: z.string().default(""),
  description: z.string().default(""),
  description_en: z.string().default(""),
  price: z.coerce.number().min(0),
  is_available: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

interface ComboItemEntry {
  menu_item_id: string;
  quantity: number;
  name: string;
  price: number;
  cost: number;
}

interface ChoiceGroupEntry {
  label: string;
  label_en: string;
  options: { menu_item_id: string; name: string; price: number; cost: number }[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  combo?: ComboWithItems | null;
  onSave: (combo: any, items: { menu_item_id: string; quantity: number }[], choiceGroups?: ChoiceGroupInput[]) => void;
}

export const ComboDialog = ({ open, onOpenChange, combo, onSave }: Props) => {
  const { t, language } = useLanguage();
  const { data: menuItems = [] } = useMenuItems();
  const [comboItems, setComboItems] = useState<ComboItemEntry[]>([]);
  const [choiceGroups, setChoiceGroups] = useState<ChoiceGroupEntry[]>([]);
  const [itemFilters, setItemFilters] = useState<MenuItemFilterState>(emptyFilters);
  const [groupFilters, setGroupFilters] = useState<Record<number, MenuItemFilterState>>({});
  const [activeGroupSearch, setActiveGroupSearch] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", name_en: "", description: "", description_en: "", price: 0, is_available: true },
  });

  const getItemName = (item: { name: string; name_en?: string }) =>
    language === "es" ? item.name : item.name_en || item.name;

  useEffect(() => {
    if (combo) {
      form.reset({
        name: combo.name,
        name_en: combo.name_en,
        description: combo.description,
        description_en: combo.description_en,
        price: combo.price,
        is_available: combo.is_available,
      });
      setComboItems(
        combo.combo_items.map((ci) => ({
          menu_item_id: ci.menu_item_id,
          quantity: ci.quantity,
          name: getItemName(ci.menu_items),
          price: ci.menu_items.price,
          cost: ci.menu_items.cost,
        }))
      );
      setChoiceGroups(
        (combo.combo_choice_groups || [])
          .sort((a, b) => a.display_order - b.display_order)
          .map((cg) => ({
            label: cg.label,
            label_en: cg.label_en,
            options: cg.combo_choice_options.map((co) => ({
              menu_item_id: co.menu_item_id,
              name: getItemName(co.menu_items),
              price: co.menu_items.price,
              cost: co.menu_items.cost,
            })),
          }))
      );
    } else {
      form.reset();
      setComboItems([]);
      setChoiceGroups([]);
    }
    setItemSearch("");
    setOptionSearch(null);
  }, [combo, open]);

  // Fixed items management
  const addItem = (item: { id: string; name: string; name_en: string; price: number; cost: number }) => {
    const existing = comboItems.find((ci) => ci.menu_item_id === item.id);
    if (existing) {
      setComboItems((prev) =>
        prev.map((ci) => (ci.menu_item_id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci))
      );
    } else {
      setComboItems((prev) => [
        ...prev,
        { menu_item_id: item.id, quantity: 1, name: getItemName(item), price: item.price, cost: item.cost },
      ]);
    }
  };

  const updateQty = (menuItemId: string, delta: number) => {
    setComboItems((prev) =>
      prev.map((ci) => (ci.menu_item_id === menuItemId ? { ...ci, quantity: ci.quantity + delta } : ci)).filter((ci) => ci.quantity > 0)
    );
  };

  const removeItem = (menuItemId: string) => setComboItems((prev) => prev.filter((ci) => ci.menu_item_id !== menuItemId));

  // Choice group management
  const addChoiceGroup = () => {
    setChoiceGroups((prev) => [...prev, { label: "", label_en: "", options: [] }]);
  };

  const updateGroupLabel = (idx: number, field: "label" | "label_en", value: string) => {
    setChoiceGroups((prev) => prev.map((g, i) => (i === idx ? { ...g, [field]: value } : g)));
  };

  const removeChoiceGroup = (idx: number) => {
    setChoiceGroups((prev) => prev.filter((_, i) => i !== idx));
  };

  const addOptionToGroup = (groupIdx: number, item: { id: string; name: string; name_en: string; price: number; cost: number }) => {
    setChoiceGroups((prev) =>
      prev.map((g, i) => {
        if (i !== groupIdx) return g;
        if (g.options.some((o) => o.menu_item_id === item.id)) return g;
        return { ...g, options: [...g.options, { menu_item_id: item.id, name: getItemName(item), price: item.price, cost: item.cost }] };
      })
    );
    setOptionSearch(null);
  };

  const removeOptionFromGroup = (groupIdx: number, menuItemId: string) => {
    setChoiceGroups((prev) =>
      prev.map((g, i) => (i === groupIdx ? { ...g, options: g.options.filter((o) => o.menu_item_id !== menuItemId) } : g))
    );
  };

  // Calculations — use most expensive option per choice group for worst-case cost/price
  const choiceGroupMaxCost = choiceGroups.reduce((sum, g) => {
    if (g.options.length === 0) return sum;
    return sum + Math.max(...g.options.map((o) => o.cost));
  }, 0);
  const choiceGroupMaxPrice = choiceGroups.reduce((sum, g) => {
    if (g.options.length === 0) return sum;
    return sum + Math.max(...g.options.map((o) => o.price));
  }, 0);

  const originalPrice = comboItems.reduce((sum, ci) => sum + ci.price * ci.quantity, 0) + choiceGroupMaxPrice;
  const productionCost = comboItems.reduce((sum, ci) => sum + ci.cost * ci.quantity, 0) + choiceGroupMaxCost;
  const comboPrice = form.watch("price");
  const discount = originalPrice > 0 ? ((originalPrice - comboPrice) / originalPrice) * 100 : 0;
  const margin = comboPrice > 0 ? ((comboPrice - productionCost) / comboPrice) * 100 : 0;

  const filteredMenuItems = menuItems.filter((mi) => {
    const query = optionSearch ? optionSearch.query : itemSearch;
    const name = getItemName(mi);
    return name.toLowerCase().includes(query.toLowerCase());
  });

  const onSubmit = (values: FormValues) => {
    const choiceGroupInputs: ChoiceGroupInput[] = choiceGroups
      .filter((g) => g.label.trim() && g.options.length > 0)
      .map((g) => ({
        label: g.label,
        label_en: g.label_en,
        options: g.options.map((o) => ({ menu_item_id: o.menu_item_id })),
      }));

    onSave(
      { ...values, ...(combo ? { id: combo.id } : {}) },
      comboItems.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })),
      choiceGroupInputs
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {combo
              ? language === "es" ? "Editar combo" : "Edit combo"
              : language === "es" ? "Nuevo combo" : "New combo"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Names */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("menu.name")} (ES)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name_en" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("menu.name")} (EN)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("menu.description")} (ES)</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="description_en" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("menu.description")} (EN)</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            {/* Fixed items */}
            <div className="space-y-2">
              <FormLabel>{language === "es" ? "Artículos fijos del combo" : "Fixed combo items"}</FormLabel>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "es" ? "Buscar artículo..." : "Search item..."}
                  value={itemSearch}
                  onChange={(e) => { setItemSearch(e.target.value); setOptionSearch(null); }}
                  className="pl-9"
                />
              </div>
              {itemSearch && !optionSearch && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {filteredMenuItems.slice(0, 8).map((mi) => (
                    <button
                      key={mi.id}
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      onClick={() => { addItem(mi); setItemSearch(""); }}
                    >
                      <span>{getItemName(mi)}</span>
                      <span className="text-muted-foreground">${Number(mi.price).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}

              {comboItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  {language === "es" ? "Agrega artículos fijos al combo" : "Add fixed items to the combo"}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {comboItems.map((ci) => (
                    <div key={ci.menu_item_id} className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ci.name}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>${Number(ci.price).toFixed(2)} × {ci.quantity}</span>
                          {ci.cost > 0 && <span>({language === "es" ? "costo" : "cost"}: ${(ci.cost * ci.quantity).toFixed(2)})</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(ci.menu_item_id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{ci.quantity}</span>
                        <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(ci.menu_item_id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeItem(ci.menu_item_id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Choice Groups */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel className="flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4 text-primary" />
                  {language === "es" ? "Opciones a elegir" : "Choice options"}
                </FormLabel>
                <Button type="button" size="sm" variant="outline" onClick={addChoiceGroup}>
                  <Plus className="h-3 w-3 mr-1" />
                  {language === "es" ? "Agregar grupo" : "Add group"}
                </Button>
              </div>

              {choiceGroups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {language === "es"
                    ? "Agrega grupos de opciones (ej: \"Elige tu cerveza\")"
                    : "Add option groups (e.g. \"Choose your beer\")"}
                </p>
              )}

              {choiceGroups.map((group, gIdx) => (
                <Card key={gIdx} className="border-primary/20">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={language === "es" ? "Nombre del grupo (ES)" : "Group name (ES)"}
                        value={group.label}
                        onChange={(e) => updateGroupLabel(gIdx, "label", e.target.value)}
                        className="text-sm h-8"
                      />
                      <Input
                        placeholder="EN"
                        value={group.label_en}
                        onChange={(e) => updateGroupLabel(gIdx, "label_en", e.target.value)}
                        className="text-sm h-8 w-28"
                      />
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeChoiceGroup(gIdx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Options search */}
                    <div className="relative">
                      <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder={language === "es" ? "Buscar opción..." : "Search option..."}
                        value={optionSearch?.groupIndex === gIdx ? optionSearch.query : ""}
                        onChange={(e) => { setOptionSearch({ groupIndex: gIdx, query: e.target.value }); setItemSearch(""); }}
                        onFocus={() => setItemSearch("")}
                        className="pl-7 h-7 text-xs"
                      />
                    </div>
                    {optionSearch?.groupIndex === gIdx && optionSearch.query && (
                      <div className="border rounded-md max-h-28 overflow-y-auto">
                        {filteredMenuItems.slice(0, 6).map((mi) => (
                          <button
                            key={mi.id}
                            type="button"
                            className="w-full flex items-center justify-between px-2 py-1 text-xs hover:bg-accent transition-colors"
                            onClick={() => addOptionToGroup(gIdx, mi)}
                          >
                            <span>{getItemName(mi)}</span>
                            <span className="text-muted-foreground">${Number(mi.price).toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Options list */}
                    {group.options.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-1">
                        {language === "es" ? "Sin opciones aún" : "No options yet"}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {group.options.map((opt) => (
                          <div key={opt.menu_item_id} className="flex items-center justify-between px-2 py-1 rounded border bg-muted/20 text-xs">
                            <span className="truncate">{opt.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-muted-foreground">${Number(opt.price).toFixed(2)}</span>
                              <Button type="button" size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => removeOptionFromGroup(gIdx, opt.menu_item_id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Price + cost analysis */}
            <div className="space-y-3">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>{language === "es" ? "Precio del combo (MXN)" : "Combo price (MXN)"}</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                </FormItem>
              )} />

              {(comboItems.length > 0 || choiceGroups.some((g) => g.options.length > 0)) && (
                <Card className="border-dashed">
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {language === "es" ? "Análisis de precios" : "Price Analysis"}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{language === "es" ? "Costo prod. (min)" : "Prod. cost (min)"}</p>
                        <p className="font-semibold">${productionCost.toFixed(2)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{language === "es" ? "Precio orig. (prom)" : "Orig. price (avg)"}</p>
                        <p className="font-semibold">${originalPrice.toFixed(2)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{language === "es" ? "Precio combo" : "Combo price"}</p>
                        <p className="font-semibold">${Number(comboPrice).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1 flex-wrap">
                      <Badge variant={discount > 0 ? "default" : "secondary"}>
                        {language === "es" ? "Descuento" : "Discount"}: {discount.toFixed(1)}%
                      </Badge>
                      <Badge variant={margin > 50 ? "default" : margin > 30 ? "secondary" : "destructive"}>
                        {language === "es" ? "Margen" : "Margin"}: {margin.toFixed(1)}%
                      </Badge>
                      {productionCost > 0 && (
                        <Badge variant="outline">
                          {language === "es" ? "Ganancia" : "Profit"}: ${(Number(comboPrice) - productionCost).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    {choiceGroups.some((g) => g.options.length > 0) && (
                      <p className="text-[10px] text-muted-foreground italic">
                        {language === "es"
                          ? "* Costo y precio orig. usan la opción más cara de cada grupo"
                          : "* Cost and orig. price use the most expensive option per group"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <FormField control={form.control} name="is_available" render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormLabel className="mt-0">{t("menu.available")}</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button type="submit">{t("common.save")}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
