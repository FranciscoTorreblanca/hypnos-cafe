import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ComboWithItems } from "@/hooks/useCombos";
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
import { Plus, Minus, Trash2, Search, Package } from "lucide-react";

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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  combo?: ComboWithItems | null;
  onSave: (combo: any, items: { menu_item_id: string; quantity: number }[]) => void;
}

export const ComboDialog = ({ open, onOpenChange, combo, onSave }: Props) => {
  const { t, language } = useLanguage();
  const { data: menuItems = [] } = useMenuItems();
  const [comboItems, setComboItems] = useState<ComboItemEntry[]>([]);
  const [itemSearch, setItemSearch] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", name_en: "", description: "", description_en: "", price: 0, is_available: true },
  });

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
          name: language === "es" ? ci.menu_items.name : ci.menu_items.name_en || ci.menu_items.name,
          price: ci.menu_items.price,
          cost: ci.menu_items.cost,
        }))
      );
    } else {
      form.reset();
      setComboItems([]);
    }
    setItemSearch("");
  }, [combo, open]);

  const addItem = (item: { id: string; name: string; name_en: string; price: number; cost: number }) => {
    const existing = comboItems.find((ci) => ci.menu_item_id === item.id);
    if (existing) {
      setComboItems((prev) =>
        prev.map((ci) => (ci.menu_item_id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci))
      );
    } else {
      setComboItems((prev) => [
        ...prev,
        {
          menu_item_id: item.id,
          quantity: 1,
          name: language === "es" ? item.name : item.name_en || item.name,
          price: item.price,
          cost: item.cost,
        },
      ]);
    }
  };

  const updateQty = (menuItemId: string, delta: number) => {
    setComboItems((prev) =>
      prev
        .map((ci) => (ci.menu_item_id === menuItemId ? { ...ci, quantity: ci.quantity + delta } : ci))
        .filter((ci) => ci.quantity > 0)
    );
  };

  const removeItem = (menuItemId: string) => {
    setComboItems((prev) => prev.filter((ci) => ci.menu_item_id !== menuItemId));
  };

  const originalPrice = comboItems.reduce((sum, ci) => sum + ci.price * ci.quantity, 0);
  const productionCost = comboItems.reduce((sum, ci) => sum + ci.cost * ci.quantity, 0);
  const comboPrice = form.watch("price");
  const discount = originalPrice > 0 ? ((originalPrice - comboPrice) / originalPrice) * 100 : 0;
  const margin = comboPrice > 0 ? ((comboPrice - productionCost) / comboPrice) * 100 : 0;

  const filteredMenuItems = menuItems.filter((mi) => {
    const name = language === "es" ? mi.name : mi.name_en || mi.name;
    return name.toLowerCase().includes(itemSearch.toLowerCase());
  });

  const onSubmit = (values: FormValues) => {
    onSave(
      { ...values, ...(combo ? { id: combo.id } : {}) },
      comboItems.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity }))
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

            {/* Add items */}
            <div className="space-y-2">
              <FormLabel>{language === "es" ? "Artículos del combo" : "Combo items"}</FormLabel>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "es" ? "Buscar artículo..." : "Search item..."}
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {itemSearch && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {filteredMenuItems.slice(0, 8).map((mi) => (
                    <button
                      key={mi.id}
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      onClick={() => { addItem(mi); setItemSearch(""); }}
                    >
                      <span>{language === "es" ? mi.name : mi.name_en || mi.name}</span>
                      <span className="text-muted-foreground">${Number(mi.price).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected items list */}
              {comboItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {language === "es" ? "Agrega artículos al combo" : "Add items to the combo"}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {comboItems.map((ci) => (
                    <div key={ci.menu_item_id} className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ci.name}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>${Number(ci.price).toFixed(2)} × {ci.quantity}</span>
                          {ci.cost > 0 && <span className="text-muted-foreground">({language === "es" ? "costo" : "cost"}: ${(ci.cost * ci.quantity).toFixed(2)})</span>}
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

            {/* Price + cost analysis */}
            <div className="space-y-3">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>{language === "es" ? "Precio del combo (MXN)" : "Combo price (MXN)"}</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                </FormItem>
              )} />

              {comboItems.length > 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {language === "es" ? "Análisis de precios" : "Price Analysis"}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{language === "es" ? "Costo producción" : "Production cost"}</p>
                        <p className="font-semibold">${productionCost.toFixed(2)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{language === "es" ? "Precio original" : "Original price"}</p>
                        <p className="font-semibold">${originalPrice.toFixed(2)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{language === "es" ? "Precio combo" : "Combo price"}</p>
                        <p className="font-semibold">${Number(comboPrice).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
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
