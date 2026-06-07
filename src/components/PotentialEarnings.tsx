import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronDown, ChevronUp, TrendingUp, Coins, Package, Filter } from "lucide-react";
import { useMenuItems, getEffectivePrice } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

interface Props {
  /** When true, shows category breakdown collapsed by default. */
  defaultOpen?: boolean;
}

const NONE_CAT = "__none__";

export const PotentialEarnings = ({ defaultOpen = false }: Props) => {
  const { t, language } = useLanguage();
  const { data: items = [] } = useMenuItems();
  const { data: categories = [] } = useMenuCategories();
  const [open, setOpen] = useState(defaultOpen);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const catName = (catId: string | null) => {
    const id = catId ?? NONE_CAT;
    const obj = categories.find((c) => c.id === id);
    if (!obj) return t("stock.notTracked");
    return language === "en" && obj.name_en ? obj.name_en : obj.name;
  };

  // Categories present in tracked inventory (for filter options)
  const trackedCategories = useMemo(() => {
    const set = new Map<string, string>();
    items
      .filter((i) => i.inventory_count !== null && (i.inventory_count ?? 0) > 0)
      .forEach((i) => {
        const id = i.category_id ?? NONE_CAT;
        if (!set.has(id)) set.set(id, catName(i.category_id));
      });
    return Array.from(set.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, categories, language]);

  const { totalRevenue, totalProfit, totalInvested, byCategory, trackedCount } = useMemo(() => {
    const tracked = items.filter(
      (i) =>
        i.inventory_count !== null &&
        (i.inventory_count ?? 0) > 0 &&
        !excluded.has(i.category_id ?? NONE_CAT)
    );
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalInvested = 0;
    const cat = new Map<string, { name: string; revenue: number; profit: number; invested: number; items: number }>();

    for (const it of tracked) {
      const qty = it.inventory_count ?? 0;
      const price = getEffectivePrice(it);
      const cost = it.cost || 0;
      const revenue = qty * price;
      const profit = qty * (price - cost);
      const invested = qty * cost;
      totalRevenue += revenue;
      totalProfit += profit;
      totalInvested += invested;

      const catId = it.category_id ?? NONE_CAT;
      const cur = cat.get(catId) ?? { name: catName(it.category_id), revenue: 0, profit: 0, invested: 0, items: 0 };
      cur.revenue += revenue;
      cur.profit += profit;
      cur.invested += invested;
      cur.items += qty;
      cat.set(catId, cur);
    }

    const byCategory = Array.from(cat.values()).sort((a, b) => b.revenue - a.revenue);
    return { totalRevenue, totalProfit, totalInvested, byCategory, trackedCount: tracked.length };
  }, [items, categories, language, t, excluded]);

  const totalTrackedItems = items.filter((i) => i.inventory_count !== null && (i.inventory_count ?? 0) > 0).length;
  if (totalTrackedItems === 0) return null;

  const toggleExcluded = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const includedCount = trackedCategories.length - excluded.size;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm flex items-center gap-2 justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("potential.title")}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs font-normal">
                <Filter className="h-3 w-3" />
                {includedCount}/{trackedCategories.length}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <div className="flex items-center justify-between pb-2 mb-2 border-b">
                <span className="text-xs font-medium">{t("potential.byCategory")}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setExcluded(new Set())}
                  >
                    {t("stock.all")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setExcluded(new Set(trackedCategories.map((c) => c.id)))}
                  >
                    ✕
                  </Button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {trackedCategories.map((c) => {
                  const checked = !excluded.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-1 py-1 rounded hover:bg-accent cursor-pointer text-xs"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleExcluded(c.id)}
                      />
                      <span className="flex-1 truncate">{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-3">
        {excluded.size > 0 && (
          <div className="flex flex-wrap gap-1">
            {Array.from(excluded).map((id) => {
              const c = trackedCategories.find((tc) => tc.id === id);
              if (!c) return null;
              return (
                <Badge
                  key={id}
                  variant="secondary"
                  className="text-[10px] cursor-pointer gap-1"
                  onClick={() => toggleExcluded(id)}
                >
                  {c.name} ✕
                </Badge>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" /> {t("potential.invested")}
            </div>
            <div className="text-base font-bold">{fmt(totalInvested)}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Coins className="h-3 w-3" /> {t("potential.revenue")}
            </div>
            <div className="text-base font-bold">{fmt(totalRevenue)}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {t("potential.netProfit")}
            </div>
            <div className="text-base font-bold text-primary">{fmt(totalProfit)}</div>
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
              <div className="flex items-center text-[10px] text-muted-foreground pb-1 px-1 border-b">
                <span className="flex-1" />
                <span className="w-16 text-right">{t("potential.invested")}</span>
                <span className="w-10 text-right">#</span>
                <span className="w-20 text-right">{t("potential.revenue")}</span>
                <span className="w-20 text-right">{t("potential.netProfit")}</span>
              </div>
              {byCategory.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center text-xs py-1 border-b last:border-b-0"
                >
                  <span className="font-medium truncate flex-1 pr-1">{c.name}</span>
                  <span className="tabular-nums w-16 text-right">{fmt(c.invested)}</span>
                  <span className="text-muted-foreground tabular-nums w-10 text-right">{c.items}</span>
                  <span className="text-muted-foreground tabular-nums w-20 text-right">
                    {fmt(c.revenue)}
                  </span>
                  <span className="text-primary font-medium tabular-nums w-20 text-right">
                    {fmt(c.profit)}
                  </span>
                </div>
              ))}
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
