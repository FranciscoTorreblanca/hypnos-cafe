import { normalizeSearch } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useOrders, OrderItem, Order } from "@/hooks/useOrders";
import { useIngredients } from "@/hooks/useIngredients";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useTableNames } from "@/hooks/useTableNames";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, BookOpen, Search, AlertTriangle, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { itemDisplayName, itemSearchText } from "@/hooks/useMenuItems";

type KitchenItem = OrderItem & {
  order: Order;
};

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const KitchenPage = () => {
  const { t, language } = useLanguage();
  const { data: orders = [], updateOrderStatus, updateItemStatus } = useOrders();
  const { data: ingredients = [] } = useIngredients();
  const { data: menuItems = [] } = useMenuItems();
  const { data: categories = [] } = useMenuCategories();
  const { getTableLabel } = useTableNames();
  const [recipeSearch, setRecipeSearch] = useState("");
  const [viewMode, setViewMode] = useState<"items" | "orders">("items");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(i);
  }, []);

  const { data: allRecipes = [] } = useQuery({
    queryKey: ["all_menu_item_ingredients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_item_ingredients").select("*");
      if (error) throw error;
      return data;
    },
  });

  const activeOrders = orders.filter((o) => o.status === "pending" || o.status === "in_progress");

  const handleMarkItemReady = async (itemId: string, orderId: string) => {
    await updateItemStatus.mutateAsync({ id: itemId, status: "ready", order_id: orderId });
  };
  const handleStartItem = async (itemId: string, orderId: string) => {
    await updateItemStatus.mutateAsync({ id: itemId, status: "in_progress", order_id: orderId });
  };
  const handleStart = async (orderId: string) => {
    await updateOrderStatus.mutateAsync({ id: orderId, status: "in_progress" });
  };

  const getRecipeForItem = (menuItemId: string) =>
    allRecipes.filter((r) => r.menu_item_id === menuItemId);

  const renderRecipe = (menuItemId: string, depth = 0): React.ReactNode => {
    const recipe = getRecipeForItem(menuItemId);
    if (recipe.length === 0) return <p className="text-xs text-muted-foreground italic ml-2">{t("orders.noRecipe")}</p>;
    return (
      <ul className={`space-y-0.5 ${depth > 0 ? "ml-4 border-l border-border pl-2" : "ml-2"}`}>
        {recipe.map((r) => {
          if (r.ingredient_id) {
            const ing = ingredients.find((i) => i.id === r.ingredient_id);
            return (
              <li key={r.id} className="text-xs text-muted-foreground">
                {r.quantity} {ing?.unit ?? ""} — {ing?.name ?? "?"}
              </li>
            );
          }
          if (r.source_menu_item_id) {
            const mi = menuItems.find((m) => m.id === r.source_menu_item_id);
            return (
              <li key={r.id} className="text-xs">
                <span className="font-medium text-foreground">
                  {r.quantity}x {language === "es" ? mi?.name : mi?.name_en}
                </span>
                {renderRecipe(r.source_menu_item_id, depth + 1)}
              </li>
            );
          }
          return null;
        })}
      </ul>
    );
  };

  // Flatten all active kitchen items (skip items that don't require kitchen prep)
  const allItems: KitchenItem[] = useMemo(() => {
    const arr: KitchenItem[] = [];
    for (const o of activeOrders) {
      for (const oi of o.order_items ?? []) {
        if (oi.menu_item?.requires_kitchen === false) continue;
        if (oi.status === "pending" || oi.status === "in_progress") {
          arr.push({ ...oi, order: o });
        }
      }
    }
    // Oldest first by received time
    arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return arr;
  }, [activeOrders]);

  const computeTiming = (oi: KitchenItem) => {
    const target = oi.menu_item?.cooking_time_seconds ?? null;
    const warn = oi.menu_item?.cooking_warning_seconds ?? 60;
    const startAt = oi.started_at ? new Date(oi.started_at).getTime() : new Date(oi.created_at).getTime();
    const elapsedSec = Math.max(0, Math.floor((now - startAt) / 1000));
    let state: "neutral" | "ok" | "warn" | "over" = "neutral";
    let pct = 0;
    if (target && target > 0) {
      pct = Math.min(100, Math.round((elapsedSec / target) * 100));
      if (elapsedSec >= target) state = "over";
      else if (elapsedSec >= target - warn) state = "warn";
      else state = "ok";
    }
    return { target, warn, elapsedSec, state, pct, startAt };
  };

  const stateClasses: Record<string, { bar: string; border: string; text: string; bg: string }> = {
    neutral: { bar: "[&>div]:bg-muted-foreground/40", border: "border-border", text: "text-muted-foreground", bg: "" },
    ok:      { bar: "[&>div]:bg-emerald-500",          border: "border-emerald-300", text: "text-emerald-700", bg: "" },
    warn:    { bar: "[&>div]:bg-amber-500",            border: "border-amber-400", text: "text-amber-800", bg: "bg-amber-50 dark:bg-amber-950/20" },
    over:    { bar: "[&>div]:bg-red-500 animate-pulse",border: "border-red-400 ring-1 ring-red-400/40", text: "text-red-700", bg: "bg-red-50 dark:bg-red-950/20" },
  };

  const itemStatusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
  const itemStatusLabel: Record<string, string> = {
    pending: t("orders.pending"),
    in_progress: t("orders.inProgress"),
    ready: t("orders.ready"),
  };

  const renderItemRow = (oi: KitchenItem, opts?: { showTable?: boolean }) => {
    const timing = computeTiming(oi);
    const sc = stateClasses[timing.state];
    return (
      <Collapsible key={oi.id}>
        <div className={cn("rounded-md border p-2 space-y-1.5", sc.border, sc.bg)}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-sm font-medium break-words">
                  {oi.quantity}x {language === "es" ? oi.menu_item?.name : oi.menu_item?.name_en}
                </span>
                {opts?.showTable && (
                  <Badge variant="outline" className="text-[10px]">
                    {getTableLabel(oi.order.table_number)}
                  </Badge>
                )}
                <Badge variant="outline" className={cn("text-[10px]", itemStatusColor[oi.status] ?? itemStatusColor.pending)}>
                  {itemStatusLabel[oi.status] ?? itemStatusLabel.pending}
                </Badge>
                {timing.state === "warn" && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                {timing.state === "over" && <Flame className="h-3.5 w-3.5 text-red-600" />}
              </div>
              {oi.notes && <div className="text-xs text-muted-foreground italic">📝 {oi.notes}</div>}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <BookOpen className="h-3.5 w-3.5" />
                </Button>
              </CollapsibleTrigger>
              {oi.status === "pending" && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartItem(oi.id, oi.order.id)} title={t("orders.start")}>
                  <Clock className="h-3.5 w-3.5" />
                </Button>
              )}
              {(oi.status === "pending" || oi.status === "in_progress") && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => handleMarkItemReady(oi.id, oi.order.id)} title={t("orders.ready")}>
                  <CheckCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Progress value={timing.target ? timing.pct : 0} className={cn("h-1.5 flex-1", sc.bar)} />
            <span className={cn("text-[11px] font-mono tabular-nums", sc.text)}>
              {formatDuration(timing.elapsedSec * 1000)}
              {timing.target ? ` / ${formatDuration(timing.target * 1000)}` : ""}
            </span>
          </div>

          <CollapsibleContent className="pt-1">
            {renderRecipe(oi.menu_item_id)}
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  const filteredMenuItems = menuItems.filter((mi) => {
    if (!recipeSearch) return true;
    const q = normalizeSearch(recipeSearch);
    return normalizeSearch(itemSearchText(mi as any)).includes(q);
  });

  const groupedByCategory = categories
    .map((cat) => ({ ...cat, items: filteredMenuItems.filter((mi) => mi.category_id === cat.id) }))
    .filter((g) => g.items.length > 0);

  const uncategorized = filteredMenuItems.filter((mi) => !mi.category_id);

  // Summary counters
  const overCount = allItems.filter((i) => computeTiming(i).state === "over").length;
  const warnCount = allItems.filter((i) => computeTiming(i).state === "warn").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.kitchen")}</h1>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders" className="gap-1">
            <Clock className="h-3.5 w-3.5" />
            {t("orders.order")}
            {allItems.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{allItems.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="recipes" className="gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {t("kitchen.recipeBook")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4 space-y-3">
          {allItems.length === 0 ? (
            <p className="text-muted-foreground">{t("orders.noActive")}</p>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm">
                  {warnCount > 0 && (
                    <Badge variant="outline" className="border-amber-400 text-amber-800 gap-1">
                      <AlertTriangle className="h-3 w-3" /> {warnCount}
                    </Badge>
                  )}
                  {overCount > 0 && (
                    <Badge variant="outline" className="border-red-400 text-red-700 gap-1">
                      <Flame className="h-3 w-3" /> {overCount}
                    </Badge>
                  )}
                </div>
                <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)} size="sm">
                  <ToggleGroupItem value="items">
                    {language === "es" ? "Por ítem" : "By item"}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="orders">
                    {language === "es" ? "Por orden" : "By order"}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {viewMode === "items" ? (
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {allItems.map((oi) => renderItemRow(oi, { showTable: true }))}
                </div>
              ) : (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {activeOrders
                    .slice()
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((order) => {
                      const items = (order.order_items ?? [])
                        .filter((oi) => oi.status === "pending" || oi.status === "in_progress")
                        .map((oi) => ({ ...oi, order }))
                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                      if (items.length === 0) return null;
                      const worst = items.reduce<"neutral" | "ok" | "warn" | "over">((acc, it) => {
                        const s = computeTiming(it).state;
                        const rank = { neutral: 0, ok: 1, warn: 2, over: 3 } as const;
                        return rank[s] > rank[acc] ? s : acc;
                      }, "neutral");
                      return (
                        <Card key={order.id} className={cn("relative", stateClasses[worst].border)}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{getTableLabel(order.table_number)}</CardTitle>
                              <Badge variant="outline" className={order.status === "pending"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-blue-100 text-blue-800 border-blue-200"}>
                                {order.status === "pending" ? t("orders.pending") : t("orders.inProgress")}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleTimeString()}
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {items.map((oi) => renderItemRow(oi))}
                            {order.notes && (
                              <p className="text-xs italic text-muted-foreground border-t pt-2">{order.notes}</p>
                            )}
                            {order.status === "pending" && (
                              <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => handleStart(order.id)}>
                                <Clock className="h-3 w-3" />
                                {t("orders.start")}
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="recipes" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("kitchen.searchItems")}
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {groupedByCategory.length === 0 && uncategorized.length === 0 && (
            <p className="text-muted-foreground">{t("common.noResults")}</p>
          )}

          <Accordion type="multiple" className="space-y-2">
            {groupedByCategory.map((group) => (
              <AccordionItem key={group.id} value={group.id} className="border rounded-lg px-4">
                <AccordionTrigger className="text-base font-medium">
                  {language === "es" ? group.name : group.name_en || group.name}
                  <Badge variant="secondary" className="ml-2">{group.items.length}</Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {group.items.map((mi) => (
                      <div key={mi.id} className="border-b last:border-0 pb-2 last:pb-0">
                        <p className="text-sm font-medium">{itemDisplayName(mi as any, language === "es" ? mi.name : mi.name_en || mi.name)}</p>
                        {renderRecipe(mi.id)}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
            {uncategorized.length > 0 && (
              <AccordionItem value="uncategorized" className="border rounded-lg px-4">
                <AccordionTrigger className="text-base font-medium">
                  {language === "es" ? "Sin categoría" : "Uncategorized"}
                  <Badge variant="secondary" className="ml-2">{uncategorized.length}</Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {uncategorized.map((mi) => (
                      <div key={mi.id} className="border-b last:border-0 pb-2 last:pb-0">
                        <p className="text-sm font-medium">{itemDisplayName(mi as any, language === "es" ? mi.name : mi.name_en || mi.name)}</p>
                        {renderRecipe(mi.id)}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KitchenPage;
