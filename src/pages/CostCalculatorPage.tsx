import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useIngredients, Ingredient } from "@/hooks/useIngredients";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CostCalculatorPage = () => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { data: ingredients = [], upsert, remove } = useIngredients();
  const { toast } = useToast();

  // Simple mode state
  const [simpleCost, setSimpleCost] = useState("");
  const [simplePrice, setSimplePrice] = useState("");

  const simpleMargin = (() => {
    const c = Number(simpleCost);
    const p = Number(simplePrice);
    if (p > 0 && c >= 0) return (((p - c) / p) * 100).toFixed(1);
    return null;
  })();

  // Ingredient form
  const [newIng, setNewIng] = useState({ name: "", unit: "kg", unit_cost: "" });

  const handleAddIngredient = () => {
    if (!newIng.name.trim()) return;
    upsert.mutate(
      { name: newIng.name.trim(), unit: newIng.unit, unit_cost: Number(newIng.unit_cost) || 0 },
      {
        onSuccess: () => {
          setNewIng({ name: "", unit: "kg", unit_cost: "" });
          toast({ title: t("common.success") });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.costCalculator")}</h1>

      <Tabs defaultValue="simple">
        <TabsList>
          <TabsTrigger value="simple">Simple</TabsTrigger>
          <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="mt-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-base">Cálculo rápido de margen</CardTitle>
            </CardHeader>
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
                  <p className={`text-3xl font-bold ${Number(simpleMargin) >= 30 ? "text-emerald-600" : "text-amber-600"}`}>
                    {simpleMargin}%
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ganancia: ${(Number(simplePrice) - Number(simpleCost)).toFixed(2)} MXN
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingredients" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ingredientes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Costo/unidad (MXN)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing) => (
                    <TableRow key={ing.id}>
                      <TableCell>{ing.name}</TableCell>
                      <TableCell>{ing.unit}</TableCell>
                      <TableCell>${Number(ing.unit_cost).toFixed(2)}</TableCell>
                      <TableCell>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(ing.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {ingredients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {t("common.noResults")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {isAdmin && (
                <div className="flex gap-2 mt-4 items-end">
                  <div>
                    <Label>Nombre</Label>
                    <Input value={newIng.name} onChange={(e) => setNewIng({ ...newIng, name: e.target.value })} className="w-40" />
                  </div>
                  <div>
                    <Label>Unidad</Label>
                    <Input value={newIng.unit} onChange={(e) => setNewIng({ ...newIng, unit: e.target.value })} className="w-20" />
                  </div>
                  <div>
                    <Label>Costo</Label>
                    <Input type="number" step="0.01" value={newIng.unit_cost} onChange={(e) => setNewIng({ ...newIng, unit_cost: e.target.value })} className="w-24" />
                  </div>
                  <Button size="sm" onClick={handleAddIngredient} disabled={!newIng.name.trim()}>
                    <Plus className="h-4 w-4 mr-1" /> {t("common.add")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CostCalculatorPage;
