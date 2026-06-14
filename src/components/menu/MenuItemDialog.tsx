import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { MenuItem } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { useMenuItemIngredients } from "@/hooks/useMenuItemIngredients";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMenuItemSkus } from "@/hooks/useMenuItemSkus";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Calculator } from "lucide-react";
import { MenuItemCostTab, RecipeRow, computeRecipeCost } from "@/components/menu/MenuItemCostTab";
import { useIngredients } from "@/hooks/useIngredients";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useMenuItemAddons, AddonInput } from "@/hooks/useMenuItemAddons";
import { Sparkles, ArrowUp, ArrowDown } from "lucide-react";

const schema = z.object({
  name: z.string().min(1),
  name_en: z.string().default(""),
  description: z.string().default(""),
  description_en: z.string().default(""),
  price: z.coerce.number().min(0),
  promo_price: z.coerce.number().min(0).nullable().default(null),
  cost: z.coerce.number().min(0).default(0),
  category_id: z.string().nullable().default(null),
  is_available: z.boolean().default(true),
  inventory_count: z.coerce.number().int().nullable().default(null),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: MenuItem | null;
  onSave: (values: Partial<MenuItem> & { name: string }) => void;
}

export const MenuItemDialog = ({ open, onOpenChange, item, onSave }: Props) => {
  const { t, language } = useLanguage();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: categories = [] } = useMenuCategories();
  const { data: skus = [], add: addSku, remove: removeSku } = useMenuItemSkus(item?.id);
  const { data: existingRecipe = [], saveAll: saveRecipe } = useMenuItemIngredients(item?.id);
  const { data: ingredients = [] } = useIngredients();
  const { data: menuItems = [] } = useMenuItems();
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [recipeDirty, setRecipeDirty] = useState(false);
  const { saveAll: saveAddons } = useMenuItemAddons();
  const [addons, setAddons] = useState<AddonInput[]>([]);
  const [addonsDirty, setAddonsDirty] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", name_en: "", description: "", description_en: "",
      price: 0, promo_price: null, cost: 0, category_id: null, is_available: true, inventory_count: null,
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        name_en: item.name_en,
        description: item.description,
        description_en: item.description_en,
        price: item.price,
        promo_price: item.promo_price,
        cost: item.cost,
        category_id: item.category_id,
        is_available: item.is_available,
        inventory_count: item.inventory_count,
      });
    } else {
      form.reset();
    }
    setRecipeDirty(false);
  }, [item, open]);

  // Sync loaded recipe into local state only when the dialog opens for a new
  // item — not on every query refetch (which would clobber unsaved edits and
  // can trigger infinite update loops).
  useEffect(() => {
    if (!open) return;
    if (item?.id) {
      setRecipeRows(
        existingRecipe.map((r) => ({
          ingredient_id: r.ingredient_id ?? "",
          source_menu_item_id: r.source_menu_item_id ?? "",
          quantity: String(r.quantity),
        })),
      );
      setRecipeDirty(false);
    } else {
      setRecipeRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, open, existingRecipe.length]);

  const handleRecipeChange = (rows: RecipeRow[]) => {
    setRecipeRows(rows);
    setRecipeDirty(true);
  };

  const currentPriceForCost = Number(form.watch("price")) || 0;
  const computedRecipeCost = computeRecipeCost(recipeRows, ingredients, menuItems);
  const hasRecipe = recipeRows.length > 0;

  const onSubmit = async (values: FormValues) => {
    try {
      const effectiveCost = hasRecipe ? Number(computedRecipeCost.toFixed(2)) : values.cost;

      // Persist recipe first if editing an existing item and rows changed
      if (item?.id && recipeDirty) {
        const valid = recipeRows.filter(
          (r) => (r.ingredient_id || r.source_menu_item_id) && Number(r.quantity) > 0,
        );
        await saveRecipe.mutateAsync({
          itemId: item.id,
          ingredients: valid.map((r) => ({
            ingredient_id: r.ingredient_id || null,
            source_menu_item_id: r.source_menu_item_id || null,
            quantity: Number(r.quantity),
          })),
        });
      }

      onSave({
        ...values,
        cost: effectiveCost,
        name: values.name,
        ...(item ? { id: item.id } : {}),
      } as Partial<MenuItem> & { name: string });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: language === "es" ? "Error al guardar" : "Save error",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const showCostTab = isAdmin && !!item?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? t("menu.editItem") : t("menu.addItem")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="general">
              <TabsList>
                <TabsTrigger value="general">{language === "es" ? "General" : "General"}</TabsTrigger>
                {showCostTab && (
                  <TabsTrigger value="costs">
                    <Calculator className="h-3.5 w-3.5 mr-1" />
                    {language === "es" ? "Costos" : "Costs"}
                    {hasRecipe && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px] font-mono">
                        ${computedRecipeCost.toFixed(2)}
                      </Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-4">
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
                <FormField control={form.control} name="category_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("menu.category")}</FormLabel>
                    <Select value={field.value || ""} onValueChange={(v) => field.onChange(v || null)}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("menu.price")} (MXN)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="promo_price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "es" ? "Precio promo" : "Promo price"}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={language === "es" ? "Sin promo" : "No promo"}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="cost" render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {language === "es" ? "Costo" : "Cost"}
                        {hasRecipe && (
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            ({language === "es" ? "calculado desde receta" : "from recipe"})
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          value={hasRecipe ? computedRecipeCost.toFixed(2) : field.value}
                          disabled={hasRecipe}
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="inventory_count" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("menu.inventory")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="is_available" render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormLabel className="mt-0">{t("menu.available")}</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />

                {item?.id && (
                  <div className="space-y-2 border-t pt-3">
                    <div className="text-sm font-medium">{t("stock.skus")}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {skus.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                      {skus.map((s) => (
                        <Badge key={s.id} variant="secondary" className="gap-1 font-mono text-[11px]">
                          {s.code}{s.label ? ` · ${s.label}` : ""}
                          <button
                            type="button"
                            onClick={() => removeSku.mutate(s.id)}
                            className="ml-1 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Input placeholder={t("stock.code")} value={newCode} onChange={(e) => setNewCode(e.target.value)} />
                      <Input placeholder={t("stock.skuLabel")} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          if (!newCode.trim() || !item?.id) return;
                          await addSku.mutateAsync({ menu_item_id: item.id, code: newCode, label: newLabel });
                          setNewCode(""); setNewLabel("");
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />{t("stock.addSku")}
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {showCostTab && (
                <TabsContent value="costs" className="mt-4">
                  <MenuItemCostTab
                    selectedItemId={item!.id}
                    rows={recipeRows}
                    onRowsChange={handleRecipeChange}
                    currentPrice={currentPriceForCost}
                    onApplyPrice={(p) => {
                      form.setValue("price", p, { shouldDirty: true });
                      toast({
                        title:
                          language === "es"
                            ? `Precio actualizado a $${p}`
                            : `Price set to $${p}`,
                        description:
                          language === "es"
                            ? "Guarda para aplicar"
                            : "Save to apply",
                      });
                    }}
                    applyLabel={language === "es" ? "Establecer precio (se aplica al guardar)" : "Set price (applied on save)"}
                  />
                </TabsContent>
              )}
            </Tabs>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button type="submit">{t("common.save")}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
