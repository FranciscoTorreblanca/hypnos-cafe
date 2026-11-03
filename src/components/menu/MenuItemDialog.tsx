import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { MenuItem } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { useMenuItemIngredients } from "@/hooks/useMenuItemIngredients";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
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
import { Trash2, Plus, Calculator, Upload, ImageIcon, Loader2, Clock, Bike } from "lucide-react";
import { MenuItemCostTab, RecipeRow, computeRecipeCost } from "@/components/menu/MenuItemCostTab";
import { useIngredients } from "@/hooks/useIngredients";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useMenuItemAddons, AddonInput } from "@/hooks/useMenuItemAddons";
import { Sparkles, ArrowUp, ArrowDown } from "lucide-react";
import { signMenuImageUrl } from "@/lib/menuImage";
import { MenuItemPlatformsTab } from "@/components/menu/MenuItemPlatformsTab";
import { MenuItemTapTab } from "@/components/menu/MenuItemTapTab";
import { useTvIntegration } from "@/hooks/useHypnosTv";

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
  image_url: z.string().nullable().default(null),
  cooking_time_seconds: z.coerce.number().int().min(0).nullable().default(null),
  cooking_warning_seconds: z.coerce.number().int().min(0).default(60),
  requires_kitchen: z.boolean().default(true),
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
  const { isAdmin, currentBusinessId, hasFeature } = useAuth();
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
  const [imgUploading, setImgUploading] = useState(false);
  const [imgPreviewUrl, setImgPreviewUrl] = useState<string | null>(null);


  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", name_en: "", description: "", description_en: "",
      price: 0, promo_price: null, cost: 0, category_id: null, is_available: true, inventory_count: null,
      image_url: null,
      cooking_time_seconds: null, cooking_warning_seconds: 60,
      requires_kitchen: true,
    },
  });

  const currentImageUrl = form.watch("image_url");

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
        image_url: item.image_url,
        cooking_time_seconds: item.cooking_time_seconds ?? null,
        cooking_warning_seconds: item.cooking_warning_seconds ?? 60,
        requires_kitchen: (item as any).requires_kitchen ?? true,
      });
    } else {
      form.reset();
    }
    setRecipeDirty(false);
  }, [item, open]);

  // Resolve a viewable URL for the stored image path
  useEffect(() => {
    let cancelled = false;
    if (!currentImageUrl) { setImgPreviewUrl(null); return; }
    signMenuImageUrl(currentImageUrl).then((url) => {
      if (!cancelled) setImgPreviewUrl(url);
    });
    return () => { cancelled = true; };
  }, [currentImageUrl]);

  const handleImageUpload = async (file: File) => {
    if (!currentBusinessId) {
      toast({ title: language === "es" ? "Sin negocio activo" : "No active business", variant: "destructive" });
      return;
    }
    setImgUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${currentBusinessId}/${item?.id ?? "new"}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("menu-images")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error) throw error;
      if (currentImageUrl) {
        try { await supabase.storage.from("menu-images").remove([currentImageUrl]); } catch {}
      }
      form.setValue("image_url", path, { shouldDirty: true });
    } catch (err: any) {
      toast({ title: language === "es" ? "Error al subir imagen" : "Image upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setImgUploading(false);
    }
  };

  const handleImageRemove = async () => {
    if (currentImageUrl) {
      try { await supabase.storage.from("menu-images").remove([currentImageUrl]); } catch {}
    }
    form.setValue("image_url", null, { shouldDirty: true });
  };

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
      setAddons(
        (item.menu_item_addons ?? []).map((a, i) => ({
          id: a.id,
          name: a.name,
          name_en: a.name_en || "",
          extra_price: Number(a.extra_price) || 0,
          display_order: a.display_order ?? i,
        })),
      );
      setAddonsDirty(false);
    } else {
      setRecipeRows([]);
      setAddons([]);
      setAddonsDirty(false);
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

      // Persist add-ons if editing an existing item and they changed
      if (item?.id && addonsDirty) {
        const valid = addons
          .filter((a) => a.name.trim().length > 0)
          .map((a, i) => ({ ...a, name: a.name.trim(), name_en: (a.name_en || "").trim(), display_order: i }));
        await saveAddons.mutateAsync({ menuItemId: item.id, addons: valid });
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
  const showAddonsTab = isAdmin && !!item?.id;
  const showDeliveryTab = isAdmin && !!item?.id && hasFeature("delivery");
  const { data: tvCfg } = useTvIntegration();
  const showTapTab = isAdmin && !!item?.id && !!tvCfg?.taplist_category_id && form.watch("category_id") === tvCfg.taplist_category_id;

  const updateAddon = (idx: number, patch: Partial<AddonInput>) => {
    setAddons((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
    setAddonsDirty(true);
  };
  const addAddonRow = () => {
    setAddons((prev) => [...prev, { name: "", name_en: "", extra_price: 0, display_order: prev.length }]);
    setAddonsDirty(true);
  };
  const removeAddonRow = (idx: number) => {
    setAddons((prev) => prev.filter((_, i) => i !== idx));
    setAddonsDirty(true);
  };
  const moveAddon = (idx: number, dir: -1 | 1) => {
    setAddons((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((a, i) => ({ ...a, display_order: i }));
    });
    setAddonsDirty(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[85dvh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{item ? t("menu.editItem") : t("menu.addItem")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="general">
              <div className="-mx-1 overflow-x-auto px-1 pb-1" data-vaul-no-drag>
              <TabsList className="w-max">
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
                {showAddonsTab && (
                  <TabsTrigger value="addons">
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    {language === "es" ? "Personalizable" : "Customizable"}
                    {addons.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">{addons.length}</Badge>
                    )}
                  </TabsTrigger>
                )}
                {showDeliveryTab && (
                  <TabsTrigger value="delivery">
                    <Bike className="h-3.5 w-3.5 mr-1" />
                    Delivery
                  </TabsTrigger>
                )}
                {showTapTab && <TabsTrigger value="tap">TV</TabsTrigger>}
              </TabsList>
              </div>

              <TabsContent value="general" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                {/* Cooking time */}
                <div className="space-y-2 border-t pt-3">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    {language === "es" ? "Tiempo de cocina" : "Cooking time"}
                  </div>
                  <FormField control={form.control} name="requires_kitchen" render={({ field }) => (
                    <FormItem className="flex items-start gap-3 rounded-md border p-2.5 bg-muted/30">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm mt-0">
                          {language === "es" ? "Requiere preparación en cocina" : "Requires kitchen preparation"}
                        </FormLabel>
                        <p className="text-[11px] text-muted-foreground">
                          {language === "es"
                            ? "Desactiva para artículos ya listos (ej. bebidas embotelladas). El mesero los servirá directamente sin pasar por cocina."
                            : "Turn off for ready-to-serve items (e.g. bottled drinks). The waiter serves them directly without going through the kitchen."}
                        </p>
                      </div>
                    </FormItem>
                  )} />
                  {form.watch("requires_kitchen") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField control={form.control} name="cooking_time_seconds" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            {language === "es" ? "Objetivo (min)" : "Target (min)"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.5"
                              min={0}
                              placeholder={language === "es" ? "Sin objetivo" : "No target"}
                              value={field.value == null ? "" : (field.value / 60).toString()}
                              onChange={(e) => field.onChange(e.target.value === "" ? null : Math.round(Number(e.target.value) * 60))}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="cooking_warning_seconds" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            {language === "es" ? "Aviso antes (seg)" : "Warning offset (sec)"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              value={field.value ?? 60}
                              onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>
                  )}
                </div>



                {/* Image upload */}
                <div className="space-y-2 border-t pt-3">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {language === "es" ? "Imagen" : "Image"}
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-20 w-20 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                      {imgPreviewUrl ? (
                        <img src={imgPreviewUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer px-3 py-1.5 rounded-md border bg-background hover:bg-accent transition-colors">
                        {imgUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {currentImageUrl
                          ? (language === "es" ? "Reemplazar" : "Replace")
                          : (language === "es" ? "Subir imagen" : "Upload image")}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={imgUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleImageUpload(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {currentImageUrl && (
                        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={handleImageRemove}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {language === "es" ? "Quitar" : "Remove"}
                        </Button>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {language === "es"
                          ? "JPG/PNG/WebP. Se muestra en el menú digital."
                          : "JPG/PNG/WebP. Displayed in the digital menu."}
                      </p>
                    </div>
                  </div>
                </div>


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
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
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

              {showAddonsTab && (
                <TabsContent value="addons" className="mt-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {language === "es"
                      ? "Define los extras opcionales. Si hay al menos uno, al añadir este producto a una orden se abrirá un cuadro para seleccionar personalizaciones."
                      : "Define optional add-ons. If at least one exists, adding this item to an order opens a customization dialog."}
                  </p>
                  <div className="space-y-2">
                    {addons.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        {language === "es" ? "Sin extras configurados." : "No add-ons configured."}
                      </p>
                    )}
                    {addons.map((a, idx) => (
                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_100px_auto] gap-2 items-end border rounded-md p-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">{language === "es" ? "Nombre (ES)" : "Name (ES)"}</label>
                          <Input
                            value={a.name}
                            onChange={(e) => updateAddon(idx, { name: e.target.value })}
                            placeholder={language === "es" ? "Ej: Tocino" : "e.g. Bacon"}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">{language === "es" ? "Nombre (EN)" : "Name (EN)"}</label>
                          <Input
                            value={a.name_en}
                            onChange={(e) => updateAddon(idx, { name_en: e.target.value })}
                            placeholder="Bacon"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">{language === "es" ? "Precio extra" : "Extra price"}</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={a.extra_price}
                            onChange={(e) => updateAddon(idx, { extra_price: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveAddon(idx, -1)} disabled={idx === 0}>
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveAddon(idx, 1)} disabled={idx === addons.length - 1}>
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAddonRow(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addAddonRow} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> {language === "es" ? "Agregar extra" : "Add extra"}
                  </Button>
                </TabsContent>
              )}
              {showDeliveryTab && item?.id && (
                <TabsContent value="delivery" className="mt-4">
                  <MenuItemPlatformsTab menuItemId={item.id} basePrice={form.watch("price") || item.price || 0} />
                </TabsContent>
              )}
              {showTapTab && item?.id && (
                <TabsContent value="tap" className="mt-4"><MenuItemTapTab menuItemId={item.id} /></TabsContent>
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
