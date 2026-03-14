import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useCombos, ComboWithItems } from "@/hooks/useCombos";
import { ComboDialog } from "./ComboDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Package, ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const ComboManager = () => {
  const { t, language } = useLanguage();
  const { isAdmin } = useAuth();
  const { data: combos = [], upsert, remove, toggleAvailability } = useCombos();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ComboWithItems | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  const handleSave = (combo: any, items: { menu_item_id: string; quantity: number }[], choiceGroups?: any[]) => {
    upsert.mutate({ combo, items, choiceGroups }, {
      onSuccess: () => toast({ title: t("common.success") }),
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CardContent className="p-4">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Package className="h-4 w-4 text-primary" />
                <h2 className="text-base font-medium text-foreground">
                  {language === "es" ? "Combos" : "Combos"}
                </h2>
                <Badge variant="secondary" className="text-xs">{combos.length}</Badge>
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); setEditing(null); setDialogOpen(true); }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {language === "es" ? "Nuevo combo" : "New combo"}
                </Button>
              )}
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            {combos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 mt-3">
                {language === "es" ? "No hay combos creados aún" : "No combos created yet"}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                {combos.map((combo) => {
                  const fixedOrigPrice = combo.combo_items.reduce(
                    (sum, ci) => sum + ci.menu_items.price * ci.quantity, 0
                  );
                  const fixedCost = combo.combo_items.reduce(
                    (sum, ci) => sum + ci.menu_items.cost * ci.quantity, 0
                  );
                  // Use most expensive option per choice group for cost/price
                  const choiceGroupsCost = (combo.combo_choice_groups ?? []).reduce((sum, cg) => {
                    const maxCost = cg.combo_choice_options.reduce((m, o) => Math.max(m, Number(o.menu_items.cost)), 0);
                    return sum + maxCost;
                  }, 0);
                  const choiceGroupsPrice = (combo.combo_choice_groups ?? []).reduce((sum, cg) => {
                    const maxPrice = cg.combo_choice_options.reduce((m, o) => Math.max(m, Number(o.menu_items.price)), 0);
                    return sum + maxPrice;
                  }, 0);
                  const originalPrice = fixedOrigPrice + choiceGroupsPrice;
                  const productionCost = fixedCost + choiceGroupsCost;
                  const discount = originalPrice > 0
                    ? ((originalPrice - combo.price) / originalPrice * 100)
                    : 0;
                  const margin = combo.price > 0
                    ? ((combo.price - productionCost) / combo.price * 100)
                    : 0;

                  return (
                    <Card key={combo.id} className={`transition-opacity ${!combo.is_available ? "opacity-50" : ""}`}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Package className="h-3.5 w-3.5 text-primary" />
                              <p className="font-medium">
                                {language === "es" ? combo.name : combo.name_en || combo.name}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {language === "es" ? combo.description : combo.description_en || combo.description}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0">
                            {combo.combo_items.length} {language === "es" ? "items" : "items"}
                          </Badge>
                        </div>

                        {/* Fixed items list */}
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {combo.combo_items.map((ci) => (
                            <div key={ci.id} className="flex justify-between">
                              <span>{ci.quantity}× {language === "es" ? ci.menu_items.name : ci.menu_items.name_en || ci.menu_items.name}</span>
                              <span>${(ci.menu_items.price * ci.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Choice groups */}
                        {combo.combo_choice_groups && combo.combo_choice_groups.length > 0 && (
                          <div className="space-y-1.5">
                            {combo.combo_choice_groups
                              .sort((a, b) => a.display_order - b.display_order)
                              .map((cg) => (
                                <div key={cg.id} className="text-xs">
                                  <div className="flex items-center gap-1 text-primary/80 font-medium mb-0.5">
                                    <ListChecks className="h-3 w-3" />
                                    <span>{language === "es" ? cg.label : cg.label_en || cg.label}</span>
                                  </div>
                                  <div className="pl-4 space-y-0.5 text-muted-foreground">
                                    {(() => {
                                      const maxCost = Math.max(...cg.combo_choice_options.map(o => Number(o.menu_items.cost)));
                                      return cg.combo_choice_options.map((co) => {
                                        const cost = Number(co.menu_items.cost);
                                        const isMax = cost === maxCost && cg.combo_choice_options.length > 1;
                                        return (
                                          <div key={co.id} className={`flex justify-between ${isMax ? "text-destructive font-medium" : ""}`}>
                                            <span>• {language === "es" ? co.menu_items.name : co.menu_items.name_en || co.menu_items.name}</span>
                                            <span className="flex gap-2">
                                              <span className="opacity-60">${cost.toFixed(2)}</span>
                                              <span>${Number(co.menu_items.price).toFixed(2)}</span>
                                            </span>
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}

                        {/* Price analysis */}
                        <div className="pt-1 border-t space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{language === "es" ? "Costo prod." : "Prod. cost"}</span>
                            <span>${productionCost.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{language === "es" ? "Precio orig." : "Orig. price"}</span>
                            <span className="line-through">${originalPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm font-semibold">
                            <span>{language === "es" ? "Precio combo" : "Combo price"}</span>
                            <span>${Number(combo.price).toFixed(2)}</span>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {discount > 0 && (
                              <Badge variant="default" className="text-[10px] h-5">
                                -{discount.toFixed(0)}% {language === "es" ? "desc." : "off"}
                              </Badge>
                            )}
                            <Badge
                              variant={margin > 50 ? "default" : margin > 30 ? "secondary" : "destructive"}
                              className="text-[10px] h-5"
                            >
                              {language === "es" ? "Margen" : "Margin"} {margin.toFixed(0)}%
                            </Badge>
                            {productionCost > 0 && (
                              <Badge variant="outline" className="text-[10px] h-5">
                                ${(combo.price - productionCost).toFixed(2)} {language === "es" ? "ganancia" : "profit"}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Admin controls */}
                        {isAdmin && (
                          <div className="flex items-center justify-between pt-1 border-t">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={combo.is_available}
                                onCheckedChange={(v) => toggleAvailability.mutate({ id: combo.id, is_available: v })}
                              />
                              <span className="text-xs text-muted-foreground">{t("menu.available")}</span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => { setEditing(combo); setDialogOpen(true); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => remove.mutate(combo.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Card>

      <ComboDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        combo={editing}
        onSave={handleSave}
      />
    </Collapsible>
  );
};
