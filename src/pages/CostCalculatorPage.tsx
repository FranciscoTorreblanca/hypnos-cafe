import { useState, useMemo, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useIngredients, Ingredient } from "@/hooks/useIngredients";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useMenuItemIngredients } from "@/hooks/useMenuItemIngredients";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ExternalLink, Calculator, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

/* ── Price suggestion logic ──────────────────────────────── */
function suggestPrice(rawCost: number) {
  const withShrinkage = rawCost * 1.05;          // +5% shrinkage
  const multiplied = withShrinkage * 3;           // ×3 multiplier
  const withCC = multiplied * 1.05;               // +5% credit card
  // Round to attractive price
  if (withCC <= 10) return Math.ceil(withCC);
  if (withCC <= 50) return Math.ceil(withCC / 5) * 5;
  if (withCC <= 200) return Math.ceil(withCC / 10) * 10;
  return Math.ceil(withCC / 25) * 25;
}

/* ── Ingredient Form Dialog ──────────────────────────────── */
interface IngFormValues {
  name: string; unit: string; presentation_qty: string; presentation_cost: string;
  provider_link: string; notes: string;
}
const emptyIng: IngFormValues = { name: "", unit: "g", presentation_qty: "", presentation_cost: "", provider_link: "", notes: "" };

const IngredientFormDialog = ({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  initial?: Ingredient | null;
  onSave: (v: Partial<Ingredient> & { name: string }) => void;
}) => {
  const getInitialForm = (): IngFormValues => {
    if (initial) return {
      name: initial.name, unit: initial.unit,
      presentation_qty: String(initial.presentation_qty),
      presentation_cost: String(initial.presentation_cost),
      provider_link: initial.provider_link, notes: initial.notes,
    };
    return emptyIng;
  };
  const [form, setForm] = useState<IngFormValues>(getInitialForm);
  const set = (k: keyof IngFormValues, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Reset on open change
  useEffect(() => {
    if (open) setForm(getInitialForm());
  }, [open, initial]);

  const unitCost = (() => {
    const qty = Number(form.presentation_qty);
    const cost = Number(form.presentation_cost);
    if (qty > 0 && cost > 0) return cost / qty;
    return null;
  })();

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      ...(initial ? { id: initial.id } : {}),
      name: form.name.trim(), unit: form.unit,
      presentation_qty: Number(form.presentation_qty) || 1,
      presentation_cost: Number(form.presentation_cost) || 0,
      provider_link: form.provider_link, notes: form.notes,
    });
    onOpenChange(false);
    setForm(emptyIng);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? "Editar ingrediente" : "Agregar ingrediente"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Unidad</Label>
              <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="g, ml, pz" />
            </div>
            <div>
              <Label>Presentación ({form.unit || "u"})</Label>
              <Input type="number" step="any" value={form.presentation_qty} onChange={(e) => set("presentation_qty", e.target.value)} placeholder="500" />
            </div>
            <div>
              <Label>Costo presentación</Label>
              <Input type="number" step="0.01" value={form.presentation_cost} onChange={(e) => set("presentation_cost", e.target.value)} placeholder="$248" />
            </div>
          </div>
          {unitCost !== null && (
            <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
              Costo por {form.unit}: <span className="font-semibold text-foreground">${unitCost.toFixed(4)}</span>
            </p>
          )}
          <div>
            <Label>Link de compra (opcional)</Label>
            <Input value={form.provider_link} onChange={(e) => set("provider_link", e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Notas / Proveedor (opcional)</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Proveedor, ubicación, etc." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ── Main Page ───────────────────────────────────────────── */
const CostCalculatorPage = () => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { data: ingredients = [], upsert, remove, bulkImport } = useIngredients();
  const { data: menuItems = [], upsert: upsertMenuItem } = useMenuItems();
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const { toast } = useToast();

  // Simple mode
  const [simpleCost, setSimpleCost] = useState("");
  const [simplePrice, setSimplePrice] = useState("");
  const simpleMargin = (() => {
    const c = Number(simpleCost); const p = Number(simplePrice);
    if (p > 0 && c >= 0) return (((p - c) / p) * 100).toFixed(1);
    return null;
  })();

  // Ingredient dialog
  const [ingDialogOpen, setIngDialogOpen] = useState(false);
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);

  // Recipe builder
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [recipeRows, setRecipeRows] = useState<{ ingredient_id: string; quantity: string }[]>([]);
  const { data: existingRecipe = [], saveAll } = useMenuItemIngredients(selectedItemId || undefined);

  // Load recipe when item changes
  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    // Load will happen via query; we sync in a useEffect-like pattern below
  };

  // Sync existing recipe into local state when data arrives
  useEffect(() => {
    if (selectedItemId && existingRecipe.length > 0) {
      setRecipeRows(existingRecipe.map((r) => ({ ingredient_id: r.ingredient_id, quantity: String(r.quantity) })));
    } else if (selectedItemId) {
      setRecipeRows([]);
    }
  }, [existingRecipe, selectedItemId]);

  const addRecipeRow = () => setRecipeRows((p) => [...p, { ingredient_id: "", quantity: "" }]);
  const removeRecipeRow = (i: number) => setRecipeRows((p) => p.filter((_, idx) => idx !== i));
  const updateRecipeRow = (i: number, k: string, v: string) =>
    setRecipeRows((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const recipeCost = useMemo(() => {
    let total = 0;
    for (const row of recipeRows) {
      const ing = ingredients.find((i) => i.id === row.ingredient_id);
      if (ing) total += ing.unit_cost * (Number(row.quantity) || 0);
    }
    return total;
  }, [recipeRows, ingredients]);

  const suggested = suggestPrice(recipeCost);
  const selectedItem = menuItems.find((i) => i.id === selectedItemId);
  const currentPrice = selectedItem?.price ?? 0;
  const realCost = recipeCost * 1.05; // with shrinkage

  const handleSaveIngredient = (values: Partial<Ingredient> & { name: string }) => {
    upsert.mutate(values, {
      onSuccess: () => {
        toast({ title: "Ingrediente guardado" });
        setEditingIng(null);
      },
    });
  };

  const parseCsvCost = (val: string) => {
    if (!val) return 0;
    return Number(val.replace(/[$,"]/g, "")) || 0;
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) { toast({ title: "CSV vacío", variant: "destructive" }); return; }

      // Parse header
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const iName = headers.findIndex((h) => h.includes("ingrediente"));
      const iAlmacen = headers.findIndex((h) => h.includes("almacen"));
      const iUnit = headers.findIndex((h) => h.includes("unidad") || h === "unidad");
      const iCosto = headers.findIndex((h) => h === "costo");
      const iUrl = headers.findIndex((h) => h.includes("url"));

      if (iName < 0) { toast({ title: "Columna 'Ingredientes' no encontrada", variant: "destructive" }); return; }

      // Parse rows - handle commas inside quotes
      const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const ch of line) {
          if (ch === '"') { inQuotes = !inQuotes; current += ch; }
          else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
          else { current += ch; }
        }
        result.push(current.trim());
        return result;
      };

      const items: Array<Partial<Ingredient> & { name: string }> = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i]);
        const name = cols[iName]?.trim();
        if (!name) continue;
        const presentation_qty = iAlmacen >= 0 ? (Number(cols[iAlmacen]) || 1) : 1;
        const unit = iUnit >= 0 ? (cols[iUnit] || "g") : "g";
        const presentation_cost = iCosto >= 0 ? parseCsvCost(cols[iCosto]) : 0;
        const provider_link = iUrl >= 0 ? (cols[iUrl] || "") : "";
        items.push({ name, unit, presentation_qty, presentation_cost, provider_link });
      }

      if (items.length === 0) { toast({ title: "No se encontraron ingredientes", variant: "destructive" }); return; }

      setImporting(true);
      setImportProgress(0);
      bulkImport.mutate(items, {
        onSuccess: () => {
          toast({ title: `${items.length} ingredientes importados` });
          setImporting(false);
          setImportProgress(100);
        },
        onError: (err: any) => {
          toast({ title: "Error al importar", description: err.message, variant: "destructive" });
          setImporting(false);
        },
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveRecipe = () => {
    if (!selectedItemId) return;
    const valid = recipeRows.filter((r) => r.ingredient_id && Number(r.quantity) > 0);
    saveAll.mutate(
      { itemId: selectedItemId, ingredients: valid.map((r) => ({ ingredient_id: r.ingredient_id, quantity: Number(r.quantity) })) },
      {
        onSuccess: () => {
          // Also update the menu item cost
          upsertMenuItem.mutate(
            { id: selectedItemId, name: selectedItem!.name, cost: Number(recipeCost.toFixed(2)) },
            { onSuccess: () => toast({ title: "Receta y costo guardados" }) }
          );
        },
      }
    );
  };

  const handleApplyPrice = (price: number) => {
    if (!selectedItemId || !selectedItem) return;
    upsertMenuItem.mutate(
      { id: selectedItemId, name: selectedItem.name, price },
      { onSuccess: () => toast({ title: `Precio actualizado a $${price}` }) }
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.costCalculator")}</h1>

      <Tabs defaultValue="recipe">
        <TabsList>
          <TabsTrigger value="recipe"><Calculator className="h-4 w-4 mr-1" />Recetas y precios</TabsTrigger>
          <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
          <TabsTrigger value="simple">Cálculo rápido</TabsTrigger>
        </TabsList>

        {/* ── RECIPE BUILDER ─────────────────────────── */}
        <TabsContent value="recipe" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Costear platillo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Selecciona un platillo del menú</Label>
                <Select value={selectedItemId} onValueChange={handleSelectItem}>
                  <SelectTrigger><SelectValue placeholder="— Seleccionar platillo —" /></SelectTrigger>
                  <SelectContent>
                    {menuItems.map((mi) => (
                      <SelectItem key={mi.id} value={mi.id}>{mi.name} — ${Number(mi.price).toFixed(0)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedItemId && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Ingredientes de la receta</Label>
                      <Button size="sm" variant="outline" onClick={addRecipeRow}><Plus className="h-3.5 w-3.5 mr-1" />Ingrediente</Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingrediente</TableHead>
                          <TableHead className="w-28">Cantidad</TableHead>
                          <TableHead className="w-24">Unidad</TableHead>
                          <TableHead className="w-28 text-right">Costo</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipeRows.map((row, idx) => {
                          const ing = ingredients.find((i) => i.id === row.ingredient_id);
                          const rowCost = ing ? ing.unit_cost * (Number(row.quantity) || 0) : 0;
                          return (
                            <TableRow key={idx}>
                              <TableCell>
                                <Select value={row.ingredient_id} onValueChange={(v) => updateRecipeRow(idx, "ingredient_id", v)}>
                                  <SelectTrigger className="h-8"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                  <SelectContent>
                                    {ingredients.map((i) => (
                                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input className="h-8" type="number" step="any" value={row.quantity}
                                  onChange={(e) => updateRecipeRow(idx, "quantity", e.target.value)} />
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">{ing?.unit ?? "—"}</TableCell>
                              <TableCell className="text-right font-mono">${rowCost.toFixed(2)}</TableCell>
                              <TableCell>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeRecipeRow(idx)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {recipeRows.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Agrega ingredientes a la receta</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {recipeCost > 0 && (
                    <Card className="bg-muted/50 border-dashed">
                      <CardContent className="pt-4 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">Costo ingredientes</p>
                            <p className="text-lg font-semibold font-mono">${recipeCost.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">+ 5% merma</p>
                            <p className="text-lg font-semibold font-mono">${realCost.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Precio sugerido</p>
                            <p className="text-2xl font-bold text-primary">${suggested}</p>
                            <p className="text-[10px] text-muted-foreground">×3 + 5% tarjeta, redondeado</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Precio actual</p>
                            <p className="text-lg font-semibold font-mono">${Number(currentPrice).toFixed(0)}</p>
                          </div>
                        </div>

                        <div className="border-t pt-3">
                          <p className="text-xs text-muted-foreground mb-1">Márgenes con precio actual (${Number(currentPrice).toFixed(0)})</p>
                          <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div>
                              <p className="text-muted-foreground">Ganancia bruta</p>
                              <p className="font-semibold">${(currentPrice - realCost).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Margen bruto</p>
                              <p className={`font-semibold ${currentPrice > 0 && ((currentPrice - realCost) / currentPrice * 100) >= 60 ? "text-emerald-600" : "text-amber-600"}`}>
                                {currentPrice > 0 ? ((currentPrice - realCost) / currentPrice * 100).toFixed(1) : 0}%
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Food cost</p>
                              <p className={`font-semibold ${currentPrice > 0 && (realCost / currentPrice * 100) <= 35 ? "text-emerald-600" : "text-amber-600"}`}>
                                {currentPrice > 0 ? (realCost / currentPrice * 100).toFixed(1) : 0}%
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button size="sm" onClick={handleSaveRecipe}>Guardar receta</Button>
                          {suggested !== currentPrice && (
                            <Button size="sm" variant="outline" onClick={() => handleApplyPrice(suggested)}>
                              Aplicar ${suggested} al menú
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── INGREDIENTS ────────────────────────────── */}
        <TabsContent value="ingredients" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Ingredientes</CardTitle>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={importing} onClick={() => document.getElementById("csv-import")?.click()}>
                    <Upload className="h-4 w-4 mr-1" />{importing ? "Importando..." : "Importar CSV"}
                  </Button>
                  <input id="csv-import" type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
                  <Button size="sm" onClick={() => { setEditingIng(null); setIngDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1" />Agregar
                  </Button>
                </div>
              )}
            </CardHeader>
            {importing && (
              <div className="px-6 pb-2">
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">Importando ingredientes...</p>
              </div>
            )}
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Presentación</TableHead>
                    <TableHead>Costo/unidad</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing) => (
                    <TableRow key={ing.id}>
                      <TableCell className="font-medium">{ing.name}</TableCell>
                      <TableCell className="text-sm">
                        {Number(ing.presentation_qty)} {ing.unit} — ${Number(ing.presentation_cost).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">${Number(ing.unit_cost).toFixed(4)}/{ing.unit}</TableCell>
                      <TableCell className="text-sm">
                        <span className="text-muted-foreground">{ing.notes}</span>
                        {ing.provider_link && (
                          <a href={ing.provider_link} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex text-primary hover:underline">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingIng(ing); setIngDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(ing.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {ingredients.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("common.noResults")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SIMPLE MODE ────────────────────────────── */}
        <TabsContent value="simple" className="mt-4">
          <Card className="max-w-md">
            <CardHeader><CardTitle className="text-base">Cálculo rápido de margen</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Costo total (MXN)</Label>
                  <Input type="number" step="0.01" value={simpleCost} onChange={(e) => setSimpleCost(e.target.value)} />
                </div>
                <div>
                  <Label>Precio de venta (MXN)</Label>
                  <Input type="number" step="0.01" value={simplePrice} onChange={(e) => setSimplePrice(e.target.value)} />
                </div>
              </div>
              {simpleMargin !== null && (
                <div className="p-3 rounded-md bg-muted text-center">
                  <p className="text-sm text-muted-foreground">Margen de ganancia</p>
                  <p className={`text-3xl font-bold ${Number(simpleMargin) >= 30 ? "text-emerald-600" : "text-amber-600"}`}>{simpleMargin}%</p>
                  <p className="text-sm text-muted-foreground mt-1">Ganancia: ${(Number(simplePrice) - Number(simpleCost)).toFixed(2)} MXN</p>
                  {Number(simpleCost) > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">Precio sugerido: <span className="font-semibold text-primary">${suggestPrice(Number(simpleCost))}</span></p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <IngredientFormDialog
        open={ingDialogOpen}
        onOpenChange={setIngDialogOpen}
        initial={editingIng}
        onSave={handleSaveIngredient}
      />
    </div>
  );
};

export default CostCalculatorPage;
