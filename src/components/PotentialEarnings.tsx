import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown, ChevronUp, TrendingUp, Coins, Package } from "lucide-react";
import { useMenuItems, getEffectivePrice } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { useLanguage } from "@/i18n/LanguageContext";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

interface Props {
  /** When true, shows category breakdown collapsed by default. */
  defaultOpen?: boolean;
}

export const PotentialEarnings = ({ defaultOpen = false }: Props) => {
  const { t, language } = useLanguage();
  const { data: items = [] } = useMenuItems();
  const { data: categories = [] } = useMenuCategories();
  const [open, setOpen] = useState(defaultOpen);

  const { totalRevenue, totalProfit, byCategory, trackedCount } = useMemo(() => {
    const tracked = items.filter((i) => i.inventory_count !== null && (i.inventory_count ?? 0) > 0);
    let totalRevenue = 0;
    let totalProfit = 0;
    const cat = new Map<string, { name: string; revenue: number; profit: number }>();

    for (const it of tracked) {
      const qty = it.inventory_count ?? 0;
      const price = getEffectivePrice(it);
      const cost = it.cost || 0;
      const revenue = qty * price;
      const profit = qty * (price - cost);
      totalRevenue += revenue;
      totalProfit += profit;

      const catId = it.category_id ?? "__none__";
      const catObj = categories.find((c) => c.id === catId);
      const catName = catObj
        ? language === "en" && catObj.name_en
          ? catObj.name_en
          : catObj.name
        : t("stock.notTracked");
      const cur = cat.get(catId) ?? { name: catName, revenue: 0, profit: 0 };
      cur.revenue += revenue;
      cur.profit += profit;
      cat.set(catId, cur);
    }

    const byCategory = Array.from(cat.values()).sort((a, b) => b.revenue - a.revenue);
    return { totalRevenue, totalProfit, byCategory, trackedCount: tracked.length };
  }, [items, categories, language, t]);

  if (trackedCount === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("potential.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Coins className="h-3 w-3" /> {t("potential.revenue")}
            </div>
            <div className="text-lg font-bold">{fmt(totalRevenue)}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {t("potential.netProfit")}
            </div>
            <div className="text-lg font-bold text-primary">{fmt(totalProfit)}</div>
          </div>
        </div>

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs gap-1">
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {t("potential.byCategory")} ({byCategory.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-1">
              {byCategory.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between text-xs py-1 border-b last:border-b-0"
                >
                  <span className="font-medium truncate flex-1">{c.name}</span>
                  <span className="text-muted-foreground tabular-nums w-20 text-right">
                    {fmt(c.revenue)}
                  </span>
                  <span className="text-primary font-medium tabular-nums w-20 text-right">
                    {fmt(c.profit)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 px-1">
                <span className="flex-1" />
                <span className="w-20 text-right">{t("potential.revenue")}</span>
                <span className="w-20 text-right">{t("potential.netProfit")}</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              {t("potential.hint")}
            </p>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
