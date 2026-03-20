import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useMenuItems, MenuItem } from "@/hooks/useMenuItems";
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
import { Plus, Search, Pencil, Trash2, Calculator, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useCombos } from "@/hooks/useCombos";

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
    const headers = ["Type", "Name", "Name (EN)", "Category", "Description", "Description (EN)", "Price", "Cost", "Margin %", "Available", "Inventory"];
    const rows: string[][] = [];

    items.forEach((item) => {
      const margin = item.price > 0 && item.cost > 0
        ? (((item.price - item.cost) / item.price) * 100).toFixed(1)
        : "";
      rows.push([
        "Item",
        item.name,
        item.name_en,
        getCategoryName(item.category_id),
        item.description,
        item.description_en,
        String(item.price),
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
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered = items.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.name_en.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "all" || 
      (activeCategory === "uncategorized" ? !i.category_id : i.category_id === activeCategory);
    return matchSearch && matchCat;
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
      </div>

      {/* Section 1: Category Management (admin only, collapsible) */}
      {isAdmin && <CategoryManager />}

      {/* Section 2: Combos (admin only) */}
      {isAdmin && <ComboManager />}

      {/* Section 3: Menu Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-foreground">
            {language === "es" ? "Artículos del Menú" : "Menu Items"}
          </h2>
          {isAdmin && (
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> {t("menu.addItem")}
            </Button>
          )}
        </div>

        {/* Search + filters bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
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
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">{t("common.noResults")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const margin = item.price > 0 && item.cost > 0
              ? (((item.price - item.cost) / item.price) * 100).toFixed(0)
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
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">${Number(item.price).toFixed(2)}</span>
                    {margin && <span className="text-muted-foreground">Margen {margin}%</span>}
                    {item.inventory_count !== null && (
                      <span className="text-muted-foreground">Inv: {item.inventory_count}</span>
                    )}
                    {isAdmin && item.cost > 0 && (
                      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => navigate(`/cost-calculator`)}>
                        <Calculator className="h-3 w-3 mr-0.5" />Costear
                      </Button>
                    )}
                  </div>
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

      <MenuItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        onSave={handleSave}
      />
    </div>
  );
};

export default MenuPage;
