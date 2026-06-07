import { normalizeSearch } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  AlertTriangle,
  XCircle,
  Search,
  Minus,
  Plus,
  Save,
  RotateCcw,
  Play,
  Square,
  ScanBarcode,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { BarcodeScannerDialog } from "@/components/stock/BarcodeScannerDialog";
import { PotentialEarnings } from "@/components/PotentialEarnings";

const LOW_STOCK_THRESHOLD = 5;

const StockPage = () => {
  const { t, language } = useLanguage();
  const { isAdmin } = useAuth();
  const { data: items = [] } = useMenuItems();
  const { data: categories = [] } = useMenuCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out" | "tracked">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "unavailable">("all");
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const trackedItems = useMemo(
    () => items.filter((i) => i.inventory_count !== null),
    [items]
  );

  const withStockItems = useMemo(
    () => items.filter((i) => (i.inventory_count ?? 0) > 0),
    [items]
  );

  const outOfStock = useMemo(
    () => trackedItems.filter((i) => (i.inventory_count ?? 0) <= 0),
    [trackedItems]
  );

  const lowStock = useMemo(
    () =>
      trackedItems.filter(
        (i) =>
          (i.inventory_count ?? 0) > 0 &&
          (i.inventory_count ?? 0) <= LOW_STOCK_THRESHOLD
      ),
    [trackedItems]
  );

  const filteredItems = useMemo(() => {
    let list = items;
    if (filter === "tracked") list = trackedItems;
    else if (filter === "out") list = outOfStock;
    else if (filter === "low") list = lowStock;

    if (categoryFilter !== "all") {
      list = list.filter((i) => i.category_id === categoryFilter);
    }

    if (availabilityFilter !== "all") {
      list = list.filter((i) =>
        availabilityFilter === "available" ? i.is_available : !i.is_available
      );
    }

    if (search.trim()) {
      const q = normalizeSearch(search);
      list = list.filter(
        (i) =>
          normalizeSearch(i.name).includes(q) ||
          normalizeSearch(i.name_en).includes(q)
      );
    }
    return list;
  }, [items, trackedItems, outOfStock, lowStock, filter, categoryFilter, availabilityFilter, search]);

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "-";
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return "-";
    return language === "en" && cat.name_en ? cat.name_en : cat.name;
  };

  const getStockBadge = (count: number | null) => {
    if (count === null)
      return <Badge variant="outline" className="text-xs">{t("stock.notTracked")}</Badge>;
    if (count <= 0)
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <XCircle className="h-3 w-3" /> {t("stock.outOfStock")}
        </Badge>
      );
    if (count <= LOW_STOCK_THRESHOLD)
      return (
        <Badge className="bg-amber-500 text-white text-xs gap-1">
          <AlertTriangle className="h-3 w-3" /> {t("stock.lowStock")} ({count})
        </Badge>
      );
    return (
      <Badge variant="secondary" className="text-xs">
        {count} {t("stock.inStock")}
      </Badge>
    );
  };

  const currentCount = (item: { id: string; inventory_count: number | null }) =>
    edits[item.id] !== undefined ? edits[item.id] : (item.inventory_count ?? 0);

  const updateEdit = (id: string, value: number) => {
    setEdits((prev) => ({ ...prev, [id]: Math.max(0, value) }));
  };

  const hasEdits = Object.keys(edits).length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [id, count] of Object.entries(edits)) {
        const { error } = await supabase
          .from("menu_items")
          .update({ inventory_count: count })
          .eq("id", id);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["menu_items"] });
      setEdits({});
      toast({ title: t("stock.saved") });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleTracking = async (id: string, currentlyTracked: boolean) => {
    try {
      const { error } = await supabase
        .from("menu_items")
        .update({ inventory_count: currentlyTracked ? null : 0 })
        .eq("id", id);
      if (error) throw error;
      // remove any pending edit for this item
      setEdits((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      queryClient.invalidateQueries({ queryKey: ["menu_items"] });
      toast({
        title: currentlyTracked
          ? t("stock.trackingStopped")
          : t("stock.trackingStarted"),
      });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const toggleAvailable = async (id: string, value: boolean) => {
    try {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_available: value })
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["menu_items"] });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const itemName = (i: { name: string; name_en: string }) =>
    language === "en" && i.name_en ? i.name_en : i.name;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" /> {t("stock.title")}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setScanOpen(true)}>
            <ScanBarcode className="h-4 w-4" /> {t("stock.scan")}
          </Button>
          {isAdmin && hasEdits && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEdits({})}
                className="gap-1"
              >
                <RotateCcw className="h-3 w-3" /> {t("billing.cashCountReset")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                <Save className="h-3 w-3" /> {t("stock.save")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Potential earnings */}
      <PotentialEarnings />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground">
              {t("stock.tracked")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold">{trackedItems.length}</p>
          </CardContent>
        </Card>
        <Card className={lowStock.length > 0 ? "border-amber-400" : ""}>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-amber-600">
              {t("stock.lowStock")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold text-amber-600">{lowStock.length}</p>
          </CardContent>
        </Card>
        <Card className={outOfStock.length > 0 ? "border-destructive" : ""}>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-destructive">
              {t("stock.outOfStock")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold text-destructive">
              {outOfStock.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("stock.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px] h-9">
            <SelectValue placeholder={t("menu.category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("stock.all")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {language === "en" && c.name_en ? c.name_en : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={availabilityFilter} onValueChange={(v) => setAvailabilityFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("stock.all")}</SelectItem>
            <SelectItem value="available">{t("stock.available")}</SelectItem>
            <SelectItem value="unavailable">{t("stock.unavailable")}</SelectItem>
          </SelectContent>
        </Select>
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as any)}
          className="shrink-0"
        >
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">
              {t("stock.all")} ({items.length})
            </TabsTrigger>
            <TabsTrigger value="tracked" className="text-xs">
              {t("stock.tracked")} ({trackedItems.length})
            </TabsTrigger>
            <TabsTrigger value="low" className="text-xs">
              ⚠ ({lowStock.length})
            </TabsTrigger>
            <TabsTrigger value="out" className="text-xs">
              ✕ ({outOfStock.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("menu.name")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("menu.category")}
                </TableHead>
                <TableHead className="text-center">{t("stock.status")}</TableHead>
                {isAdmin && (
                  <TableHead className="text-center w-[110px]">
                    {t("stock.available")}
                  </TableHead>
                )}
                {isAdmin && (
                  <TableHead className="text-center w-[140px]">
                    {t("stock.count")}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t("stock.noItems")}
                  </TableCell>
                </TableRow>
              )}
              {filteredItems.map((item) => {
                const count = currentCount(item);
                const edited = edits[item.id] !== undefined;
                return (
                  <TableRow
                    key={item.id}
                    className={
                      item.inventory_count !== null && (item.inventory_count ?? 0) <= 0
                        ? "bg-destructive/5"
                        : item.inventory_count !== null &&
                          (item.inventory_count ?? 0) <= LOW_STOCK_THRESHOLD
                        ? "bg-amber-50 dark:bg-amber-950/20"
                        : ""
                    }
                  >
                    <TableCell className="font-medium">
                      {itemName(item)}
                      {!item.is_available && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {t("stock.unavailable")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {getCategoryName(item.category_id)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStockBadge(
                        edited ? edits[item.id] : item.inventory_count
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center">
                        <Switch
                          checked={item.is_available}
                          onCheckedChange={(v) => toggleAvailable(item.id, v)}
                        />
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell>
                        {item.inventory_count !== null ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateEdit(item.id, count - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              value={count}
                              onChange={(e) =>
                                updateEdit(item.id, parseInt(e.target.value) || 0)
                              }
                              className={`w-14 h-7 text-center text-sm ${
                                edited ? "border-primary" : ""
                              }`}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateEdit(item.id, count + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              title={t("stock.stopTracking")}
                              onClick={() => toggleTracking(item.id, true)}
                            >
                              <Square className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => toggleTracking(item.id, false)}
                            >
                              <Play className="h-3 w-3" />
                              {t("stock.startTracking")}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <BarcodeScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResolved={(item) => {
          setSearch(item.name);
          if (item.inventory_count === null) {
            toggleTracking(item.id, false);
          }
        }}
      />
    </div>
  );
};

export default StockPage;
