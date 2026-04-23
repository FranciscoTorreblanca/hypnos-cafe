import { useMemo } from "react";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, X } from "lucide-react";

export interface MenuItemFilterState {
  query: string;
  categoryId: string; // "all" | "uncategorized" | <uuid>
  minPrice: string;
  maxPrice: string;
  minCost: string;
  maxCost: string;
}

export const emptyFilters: MenuItemFilterState = {
  query: "",
  categoryId: "all",
  minPrice: "",
  maxPrice: "",
  minCost: "",
  maxCost: "",
};

interface Props {
  value: MenuItemFilterState;
  onChange: (next: MenuItemFilterState) => void;
  /** Compact = smaller controls used inside dialogs */
  compact?: boolean;
}

export const MenuItemFilters = ({ value, onChange, compact = false }: Props) => {
  const { language } = useLanguage();
  const { data: categories = [] } = useMenuCategories();

  const activeCount = useMemo(() => {
    let n = 0;
    if (value.categoryId !== "all") n++;
    if (value.minPrice) n++;
    if (value.maxPrice) n++;
    if (value.minCost) n++;
    if (value.maxCost) n++;
    return n;
  }, [value]);

  const inputClass = compact ? "h-8 text-xs" : "h-9";

  const update = <K extends keyof MenuItemFilterState>(
    key: K,
    v: MenuItemFilterState[K],
  ) => onChange({ ...value, [key]: v });

  const reset = () =>
    onChange({ ...emptyFilters, query: value.query });

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search
          className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
        />
        <Input
          placeholder={language === "es" ? "Buscar artículo..." : "Search item..."}
          value={value.query}
          onChange={(e) => update("query", e.target.value)}
          className={`pl-8 ${inputClass}`}
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            className={`shrink-0 ${compact ? "h-8 px-2" : ""}`}
          >
            <SlidersHorizontal className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                {activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="end">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {language === "es" ? "Filtros" : "Filters"}
            </p>
            {activeCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={reset}
              >
                <X className="h-3 w-3 mr-1" />
                {language === "es" ? "Limpiar" : "Clear"}
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {language === "es" ? "Categoría" : "Category"}
            </Label>
            <Select
              value={value.categoryId}
              onValueChange={(v) => update("categoryId", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "es" ? "Todas" : "All"}
                </SelectItem>
                <SelectItem value="uncategorized">
                  {language === "es" ? "Sin categoría" : "Uncategorized"}
                </SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {language === "es" ? c.name : c.name_en || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {language === "es" ? "Rango de precio" : "Price range"}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder={language === "es" ? "Mín" : "Min"}
                value={value.minPrice}
                onChange={(e) => update("minPrice", e.target.value)}
                className="h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder={language === "es" ? "Máx" : "Max"}
                value={value.maxPrice}
                onChange={(e) => update("maxPrice", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {language === "es" ? "Rango de costo" : "Cost range"}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder={language === "es" ? "Mín" : "Min"}
                value={value.minCost}
                onChange={(e) => update("minCost", e.target.value)}
                className="h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder={language === "es" ? "Máx" : "Max"}
                value={value.maxCost}
                onChange={(e) => update("maxCost", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

/** Filter a list of menu items by the current filter state. */
export const applyMenuItemFilters = <
  T extends {
    name: string;
    name_en?: string;
    price: number;
    cost: number;
    category_id: string | null;
    [key: string]: any;
  },
>(
  items: T[],
  filters: MenuItemFilterState,
  getName: (i: T) => string,
): T[] => {
  const q = filters.query.trim().toLowerCase();
  const minP = filters.minPrice ? Number(filters.minPrice) : null;
  const maxP = filters.maxPrice ? Number(filters.maxPrice) : null;
  const minC = filters.minCost ? Number(filters.minCost) : null;
  const maxC = filters.maxCost ? Number(filters.maxCost) : null;

  return items.filter((i) => {
    if (q && !getName(i).toLowerCase().includes(q)) return false;
    if (filters.categoryId === "uncategorized" && i.category_id) return false;
    if (
      filters.categoryId !== "all" &&
      filters.categoryId !== "uncategorized" &&
      i.category_id !== filters.categoryId
    )
      return false;
    const price = Number(i.price) || 0;
    const cost = Number(i.cost) || 0;
    if (minP != null && price < minP) return false;
    if (maxP != null && price > maxP) return false;
    if (minC != null && cost < minC) return false;
    if (maxC != null && cost > maxC) return false;
    return true;
  });
};
