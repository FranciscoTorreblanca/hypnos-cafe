import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useMenuItems, MenuItem, getEffectivePrice } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { CategoryManager } from "@/components/menu/CategoryManager";
import { ComboManager } from "@/components/menu/ComboManager";
import { MenuItemDialog } from "@/components/menu/MenuItemDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Calculator, Download, ScanLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useCombos } from "@/hooks/useCombos";
import { BarcodeScannerDialog } from "@/components/stock/BarcodeScannerDialog";

const MenuPage = () => {
  const { t, language } = useLanguage();
  const { isAdmin } = useAuth();
  const { data: items = [], upsert, remove, toggleAvailability } = useMenuItems();
  const { data: categories = [] } = useMenuCategories();
  const { data: combos = [] } = useCombos();
  const { toast } = useToast();
  const navigate = useNavigate();

  const exportToCsv = () => {
    const escCsv = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["Type", "Name", "Name (EN)", "Category", "Description", "Description (EN)", "Price", "Promo Price", "Effective Price", "Cost", "Margin %", "Available", "Inventory"];
    const rows: string[][] = [];

    items.forEach((item) => {
      const ep = getEffectivePrice(item);
      const margin = ep > 0 && item.cost > 0
        ? (((ep - item.cost) / ep) * 100).toFixed(1)
        : "";
      rows.push([
        "Item",
        item.name,
        item.name_en,
        getCategoryName(item.category_id),
        item.description,
        item.description_en,
        String(item.price),
        item.promo_price != null ? String(item.promo_price) : "",
        String(ep),
        String(item.cost),
        margin,
        item.is_available ? "Yes" : "No",
        item.inventory_count !== null ? String(item.inventory_count) : "",
      ]);
    });

    combos.forEach((combo) => {
      const fixedCost = combo.combo_items?.reduce((s, ci) => s + (ci.menu_items?.cost ?? 0) * ci.quantity, 0) ?? 0;
      const choiceCost = combo.combo_choice_groups?.reduce((s, cg) => {
        const maxCost = Math.max(0, ...(cg.combo_choice_options?.map(o => o.menu_items?.cost ?? 0) ?? []));
        return s + maxCost;
      }, 0) ?? 0;
      const totalCost = fixedCost + choiceCost;
      const margin = combo.price > 0 && totalCost > 0
        ? (((combo.price - totalCost) / combo.price) * 100).toFixed(1)
        : "";
      const itemNames = [
        ...(combo.combo_items?.map(ci => `${ci.menu_items?.name} x${ci.quantity}`) ?? []),
        ...(combo.combo_choice_groups?.map(cg => `[${cg.label}]`) ?? []),
      ].join(", ");
      rows.push([
        "Combo",
        combo.name,
        combo.name_en,
        "",
        itemNames,
        combo.description_en,
        String(combo.price),
        String(totalCost),
        margin,
        combo.is_available ? "Yes" : "No",
        "",
      ]);
    });

    const csv = [headers.join(","), ...rows.map(r => r.map(escCsv).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menu_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: language === "es" ? "CSV exportado" : "CSV exported" });
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const filtered = items.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.name_en.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "all" ||
      (activeCategory === "uncategorized" ? !i.category_id : i.category_id === activeCategory);
    const ep = getEffectivePrice(i);
    const minP = minPrice ? Number(minPrice) : null;
    const maxP = maxPrice ? Number(maxPrice) : null;
    const matchPrice = (minP == null || ep >= minP) && (maxP == null || ep <= maxP);
    return matchSearch && matchCat && matchPrice;
  });

  const handleSave = (values: Partial<MenuItem> & { name: string }) => {
    upsert.mutate(values, {
      onSuccess: () => toast({ title: t("common.success") }),
    });
  };

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "—";
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return "—";
    return language === "es" ? cat.name : cat.name_en || cat.name;
  };

  const uncategorizedCount = items.filter(i => !i.category_id).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("menu.title")}</h1>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={exportToCsv}>
            <Download className="h-4 w-4 mr-1" />
            {language === "es" ? "Exportar CSV" : "Export CSV"}
          </Button>
        )}
      </div>

      {/* Section 1: Category Management (admin only, collapsible) */}
      {isAdmin && <CategoryManager />}

      {/* Section 2: Tabs — Menu Items vs Combos */}
      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items">
            {language === "es" ? "Artículos" : "Items"}
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
              {items.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="combos">
            {language === "es" ? "Combos" : "Combos"}
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
              {combos.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-medium text-foreground">
              {language === "es" ? "Artículos del Menú" : "Menu Items"}
            </h2>
            {isAdmin && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setScannerOpen(true)}>
                  <ScanLine className="h-4 w-4 mr-1" /> {language === "es" ? "Escanear" : "Scan"}
                </Button>
                <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> {t("menu.addItem")}
                </Button>
              </div>
            )}
          </div>

          {/* Search + Price filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                inputMode="decimal"
                placeholder={language === "es" ? "Min $" : "Min $"}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-24 h-9 text-xs"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder={language === "es" ? "Máx $" : "Max $"}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-24 h-9 text-xs"
              />
            </div>
          </div>

          {/* Category filter tabs */}
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">{language === "es" ? "Todos" : "All"}</TabsTrigger>
              {categories.map((c) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {language === "es" ? c.name : c.name_en || c.name}
                </TabsTrigger>
              ))}
              <TabsTrigger value="uncategorized" className="text-muted-foreground">
                {language === "es" ? "Sin categoría" : "No category"}
                {uncategorizedCount > 0 && (
                  <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
                    {uncategorizedCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">{t("common.noResults")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => {
                const effectivePrice = getEffectivePrice(item);
                const margin = effectivePrice > 0 && item.cost > 0
                  ? (((effectivePrice - item.cost) / effectivePrice) * 100).toFixed(0)
                  : null;
                const promoDiscount = item.promo_price != null && item.price > 0
                  ? Math.round(((item.price - item.promo_price) / item.price) * 100)
                  : null;
                return (
                  <Card key={item.id} className={`transition-opacity ${!item.is_available ? "opacity-50" : ""}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{language === "es" ? item.name : item.name_en || item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {language === "es" ? item.description : item.description_en || item.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">{getCategoryName(item.category_id)}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm flex-wrap gap-1">
                        <div className="flex items-center gap-1.5">
                          {promoDiscount != null ? (
                            <>
                              <span className="font-semibold text-green-600">${effectivePrice.toFixed(2)}</span>
                              <span className="line-through text-muted-foreground text-xs">${item.price.toFixed(2)}</span>
                              <Badge variant="secondary" className="text-[10px] h-5">-{promoDiscount}%</Badge>
                            </>
                          ) : (
                            <span className="font-semibold">${item.price.toFixed(2)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.cost > 0 && (
                            <span>{language === "es" ? "Costo" : "Cost"}: ${item.cost.toFixed(2)}</span>
                          )}
                          {margin && <span>Margen {margin}%</span>}
                          {item.inventory_count !== null && (
                            <span>Inv: {item.inventory_count}</span>
                          )}
                        </div>
                      </div>
                      {isAdmin && item.cost > 0 && (
                        <div className="flex justify-end">
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => navigate(`/cost-calculator`)}>
                            <Calculator className="h-3 w-3 mr-0.5" />Costear
                          </Button>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex items-center justify-between pt-1 border-t">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={item.is_available}
                              onCheckedChange={(v) => toggleAvailability.mutate({ id: item.id, is_available: v })}
                            />
                            <span className="text-xs text-muted-foreground">{t("menu.available")}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(item); setDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(item.id)}>
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
        </TabsContent>

        <TabsContent value="combos" className="space-y-4">
          <ComboManager headerless />
        </TabsContent>
      </Tabs>
      <MenuItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        onSave={handleSave}
      />
      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onResolved={(item) => {
          setScannerOpen(false);
          setEditing(item);
          setDialogOpen(true);
        }}
      />
    </div>
  );
};

export default MenuPage;
