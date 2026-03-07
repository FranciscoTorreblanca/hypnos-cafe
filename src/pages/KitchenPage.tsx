import { useLanguage } from "@/i18n/LanguageContext";
import { useOrders } from "@/hooks/useOrders";
import { useIngredients } from "@/hooks/useIngredients";
import { useMenuItems } from "@/hooks/useMenuItems";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, Clock, ChevronDown, BookOpen } from "lucide-react";

const KitchenPage = () => {
  const { t, language } = useLanguage();
  const { data: orders = [], updateOrderStatus, updateItemStatus } = useOrders();
  const { data: ingredients = [] } = useIngredients();
  const { data: menuItems = [] } = useMenuItems();

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

  const getRecipeForItem = (menuItemId: string) => {
    return allRecipes.filter((r) => r.menu_item_id === menuItemId);
  };

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.kitchen")}</h1>

      {activeOrders.length === 0 ? (
        <p className="text-muted-foreground">{t("orders.noActive")}</p>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {activeOrders.map((order) => (
            <Card key={order.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {t("tables.title")} {order.table_number}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      order.status === "pending"
                        ? "bg-amber-100 text-amber-800 border-amber-200"
                        : "bg-blue-100 text-blue-800 border-blue-200"
                    }
                  >
                    {order.status === "pending" ? t("orders.pending") : t("orders.inProgress")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleTimeString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {(order.order_items ?? []).map((oi) => (
                    <Collapsible key={oi.id}>
                      <div className="flex items-center justify-between text-sm gap-1">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="truncate">
                            {oi.quantity}x{" "}
                            {language === "es" ? oi.menu_item?.name : oi.menu_item?.name_en}
                          </span>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${itemStatusColor[oi.status] ?? itemStatusColor.pending}`}>
                            {itemStatusLabel[oi.status] ?? itemStatusLabel.pending}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <BookOpen className="h-3 w-3" />
                            </Button>
                          </CollapsibleTrigger>
                          {oi.status === "pending" && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleStartItem(oi.id, order.id)}>
                              <Clock className="h-3 w-3" />
                            </Button>
                          )}
                          {(oi.status === "pending" || oi.status === "in_progress") && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600" onClick={() => handleMarkItemReady(oi.id, order.id)}>
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {oi.notes && <span className="text-xs text-muted-foreground italic block">📝 {oi.notes}</span>}
                      <CollapsibleContent className="pt-1 pb-2">
                        {renderRecipe(oi.menu_item_id)}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
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
          ))}
        </div>
      )}
    </div>
  );
};

export default KitchenPage;
