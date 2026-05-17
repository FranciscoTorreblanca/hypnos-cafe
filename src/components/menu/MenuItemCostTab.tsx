import { useMemo, useState } from "react";
import { useIngredients } from "@/hooks/useIngredients";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Copy, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MenuItemFilters, emptyFilters, applyMenuItemFilters, MenuItemFilterState } from "@/components/menu/MenuItemFilters";

export interface RecipeRow {
  ingredient_id: string;
  source_menu_item_id: string;
  quantity: string;
}

export const suggestPrice = (rawCost: number) => {
  const withShrinkage = rawCost * 1.05;
  const multiplied = withShrinkage * 3;
  const withCC = multiplied * 1.05;
  if (withCC <= 10) return Math.ceil(withCC);
  if (withCC <= 50) return Math.ceil(withCC / 5) * 5;
  if (withCC <= 200) return Math.ceil(withCC / 10) * 10;
  return Math.ceil(withCC / 25) * 25;
};

export const computeRecipeCost = (
  rows: RecipeRow[],
  ingredients: Array<{ id: string; unit_cost: number }>,
  menuItems: Array<{ id: string; cost: number }>,
) => {
  let total = 0;
  for (const row of rows) {
    const qty = Number(row.quantity) || 0;
    if (row.ingredient_id) {
      const ing = ingredients.find((i) => i.id === row.ingredient_id);
      if (ing) total += Number(ing.unit_cost) * qty;
    } else if (row.source_menu_item_id) {
      const mi = menuItems.find((m) => m.id === row.source_menu_item_id);
      if (mi) total += Number(mi.cost) * qty;
    }
  }
  return total;
};

interface Props {
  /** id of the item being costed; excluded from sub-recipe options. Empty string allowed for new items. */
  selectedItemId: string;
  rows: RecipeRow[];
  onRowsChange: (rows: RecipeRow[]) => void;
  /** Price currently used for margin calculations (live form value or saved value). */
  currentPrice: number;
  /** Optional — when provided, renders the "Apply price to menu" section. */
  onApplyPrice?: (price: number) => void;
  /** Optional — when provided, renders a "Save recipe" button (for the standalone page). */
  onSaveRecipe?: () => void;
  /** Optional label override for the suggested price action. */
  applyLabel?: string;
}

export const MenuItemCostTab = ({
  selectedItemId,
  rows,
  onRowsChange,
  currentPrice,
  onApplyPrice,
  onSaveRecipe,
  applyLabel,
}: Props) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { data: ingredients = [] } = useIngredients();
  const { data: menuItems = [] } = useMenuItems();

  const [customPrice, setCustomPrice] = useState("");
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyFilters, setCopyFilters] = useState<MenuItemFilterState>(emptyFilters);

  const availableMenuItems = useMemo(
    () => menuItems.filter((mi) => mi.id !== selectedItemId),
    [menuItems, selectedItemId],
  );

  const filteredCopyItems = useMemo(
    () => applyMenuItemFilters(availableMenuItems, copyFilters, (m) => m.name),
    [availableMenuItems, copyFilters],
  );

  const addRow = () => onRowsChange([...rows, { ingredient_id: "", source_menu_item_id: "", quantity: "" }]);
  const removeRow = (i: number) => onRowsChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<RecipeRow>) =>
    onRowsChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const getRowInfo = (row: RecipeRow) => {
    if (row.ingredient_id) {
      const ing = ingredients.find((i) => i.id === row.ingredient_id);
      return ing ? { unitCost: Number(ing.unit_cost), unit: ing.unit, label: ing.name } : null;
    }
    if (row.source_menu_item_id) {
      const mi = menuItems.find((m) => m.id === row.source_menu_item_id);
      return mi ? { unitCost: Number(mi.cost), unit: "pz", label: `🍽 ${mi.name}` } : null;
    }
    return null;
  };

  const recipeCost = useMemo(
    () => computeRecipeCost(rows, ingredients, menuItems),
    [rows, ingredients, menuItems],
  );

  const realCost = recipeCost * 1.05;
  const suggested = suggestPrice(recipeCost);

  const handleCopyFromItem = async (sourceId: string) => {
    const { data, error } = await supabase
      .from("menu_item_ingredients")
      .select("*")
      .eq("menu_item_id", sourceId);
    if (error) {
      toast({ title: language === "es" ? "Error al copiar" : "Copy error", description: error.message, variant: "destructive" });
      return;
    }
    onRowsChange(
      (data || []).map((r: any) => ({
        ingredient_id: r.ingredient_id ?? "",
        source_menu_item_id: r.source_menu_item_id ?? "",
        quantity: String(r.quantity),
      })),
    );
    setCopyDialogOpen(false);
    toast({
      title: language === "es" ? "Costos copiados" : "Costs copied",
      description: language === "es" ? "Revisa y guarda para aplicar los cambios" : "Review and save to apply changes",
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label>{language === "es" ? "Ingredientes de la receta" : "Recipe ingredients"}</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCopyFilters(emptyFilters);
                setCopyDialogOpen(true);
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              {language === "es" ? "Copiar de…" : "Copy from…"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {language === "es" ? "Ingrediente" : "Ingredient"}
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === "es" ? "Ingrediente" : "Ingredient"}</TableHead>
              <TableHead className="w-24">{language === "es" ? "Cantidad" : "Qty"}</TableHead>
              <TableHead className="w-16">{language === "es" ? "Unidad" : "Unit"}</TableHead>
              <TableHead className="w-24 text-right">{language === "es" ? "Costo" : "Cost"}</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => {
              const info = getRowInfo(row);
              const rowCost = info ? info.unitCost * (Number(row.quantity) || 0) : 0;
              const hasSelection = !!(row.ingredient_id || row.source_menu_item_id);
              return (
                <TableRow key={idx}>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="h-8 w-full justify-between text-left font-normal"
                        >
                          <span className="truncate">
                            {hasSelection ? info?.label ?? "—" : language === "es" ? "Buscar..." : "Search..."}
                          </span>
                          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder={language === "es" ? "Buscar..." : "Search..."} />
                          <CommandList>
                            <CommandEmpty>{language === "es" ? "Sin resultados" : "No results"}</CommandEmpty>
                            <CommandGroup heading={language === "es" ? "Ingredientes" : "Ingredients"}>
                              {ingredients.map((i) => (
                                <CommandItem
                                  key={`ing:${i.id}`}
                                  value={`ing:${i.name}`}
                                  onSelect={() =>
                                    updateRow(idx, { ingredient_id: i.id, source_menu_item_id: "" })
                                  }
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-3.5 w-3.5",
                                      row.ingredient_id === i.id ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  {i.name}
                                  <span className="ml-auto text-xs text-muted-foreground">
                                    ${Number(i.unit_cost).toFixed(2)}/{i.unit}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            {availableMenuItems.length > 0 && (
                              <CommandGroup heading={language === "es" ? "Platillos (sub-receta)" : "Items (sub-recipe)"}>
                                {availableMenuItems.map((mi) => (
                                  <CommandItem
                                    key={`mi:${mi.id}`}
                                    value={`mi:${mi.name}`}
                                    onSelect={() =>
                                      updateRow(idx, { source_menu_item_id: mi.id, ingredient_id: "" })
                                    }
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-3.5 w-3.5",
                                        row.source_menu_item_id === mi.id ? "opacity-100" : "opacity-0",
                                      )}
                                    />
                                    🍽 {mi.name}
                                    <span className="ml-auto text-xs text-muted-foreground">
                                      ${Number(mi.cost).toFixed(2)}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      type="number"
                      step="any"
                      value={row.quantity}
                      onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{info?.unit ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">${rowCost.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeRow(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  {language === "es" ? "Agrega ingredientes a la receta" : "Add recipe ingredients"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {recipeCost > 0 && (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "es" ? "Costo ingredientes" : "Ingredients cost"}
                </p>
                <p className="text-lg font-semibold font-mono">${recipeCost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "es" ? "+ 5% merma" : "+ 5% shrinkage"}
                </p>
                <p className="text-lg font-semibold font-mono">${realCost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "es" ? "Precio sugerido" : "Suggested price"}
                </p>
                <p className="text-2xl font-bold text-primary">${suggested}</p>
                <p className="text-[10px] text-muted-foreground">
                  {language === "es" ? "×3 + 5% tarjeta, redondeado" : "×3 + 5% card, rounded"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "es" ? "Precio actual" : "Current price"}
                </p>
                <p className="text-lg font-semibold font-mono">${Number(currentPrice).toFixed(0)}</p>
              </div>
            </div>

            {currentPrice > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "es"
                    ? `Márgenes con precio actual ($${Number(currentPrice).toFixed(0)})`
                    : `Margins at current price ($${Number(currentPrice).toFixed(0)})`}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="text-muted-foreground">{language === "es" ? "Ganancia bruta" : "Gross profit"}</p>
                    <p className="font-semibold">${(currentPrice - realCost).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{language === "es" ? "Margen bruto" : "Gross margin"}</p>
                    <p
                      className={`font-semibold ${
                        ((currentPrice - realCost) / currentPrice) * 100 >= 60 ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {(((currentPrice - realCost) / currentPrice) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Food cost</p>
                    <p
                      className={`font-semibold ${
                        (realCost / currentPrice) * 100 <= 35 ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {((realCost / currentPrice) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(onSaveRecipe || onApplyPrice) && (
              <div className="flex flex-col gap-3 pt-2">
                {onSaveRecipe && (
                  <Button type="button" size="sm" onClick={onSaveRecipe}>
                    {language === "es" ? "Guardar receta" : "Save recipe"}
                  </Button>
                )}
                {onApplyPrice && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {applyLabel ?? (language === "es" ? "Aplicar precio al menú" : "Apply price to menu")}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant={customPrice === "" ? "default" : "outline"}
                        onClick={() => {
                          setCustomPrice("");
                          onApplyPrice(suggested);
                        }}
                      >
                        {language === "es" ? "Sugerido" : "Suggested"} ${suggested}
                      </Button>
                      <span className="text-xs text-muted-foreground">{language === "es" ? "o" : "or"}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">$</span>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          className="h-8 w-24"
                          placeholder={language === "es" ? "Precio" : "Price"}
                          value={customPrice}
                          onChange={(e) => setCustomPrice(e.target.value)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={!customPrice || Number(customPrice) <= 0}
                          onClick={() => onApplyPrice(Number(customPrice))}
                        >
                          {language === "es" ? "Aplicar" : "Apply"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Copy from another item dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "es" ? "Copiar costos de otro platillo" : "Copy costs from another item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <MenuItemFilters value={copyFilters} onChange={setCopyFilters} compact />
            <ScrollArea className="h-64 rounded-md border">
              <div className="divide-y">
                {filteredCopyItems.map((mi) => (
                  <button
                    key={mi.id}
                    type="button"
                    onClick={() => handleCopyFromItem(mi.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
                  >
                    <span className="truncate">{mi.name}</span>
                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                      ${Number(mi.cost).toFixed(2)}
                    </span>
                  </button>
                ))}
                {filteredCopyItems.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-6">
                    {language === "es" ? "Sin resultados" : "No results"}
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
