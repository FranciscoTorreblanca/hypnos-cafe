import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subWeeks, subDays, startOfDay, endOfDay, differenceInCalendarDays, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, BarChart3, Clock, Award, X, Filter, Download, CalendarIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface PaidOrder {
  id: string;
  table_number: number;
  total: number;
  created_at: string;
  order_items: {
    menu_item_id: string;
    quantity: number;
    unit_price: number;
    discount: number;
    menu_items: { name: string; name_en: string; cost: number | null } | null;
  }[];
}

interface Payment {
  id: string;
  order_id: string;
  amount: number;
  tip: number;
  payment_method: string;
  created_at: string;
}

const PerformancePage = () => {
  const { isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const loc = language === "es" ? es : enUS;

  // Date range state — default to current month
  type PresetKey =
    | "today" | "yesterday" | "last7" | "last30"
    | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth"
    | "last3Months" | "last6Months" | "custom";

  const buildPreset = (key: PresetKey): { start: Date; end: Date } => {
    const now = new Date();
    switch (key) {
      case "today": return { start: startOfDay(now), end: endOfDay(now) };
      case "yesterday": { const d = subDays(now, 1); return { start: startOfDay(d), end: endOfDay(d) }; }
      case "last7": return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
      case "last30": return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
      case "thisWeek": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "lastWeek": { const w = subWeeks(now, 1); return { start: startOfWeek(w, { weekStartsOn: 1 }), end: endOfWeek(w, { weekStartsOn: 1 }) }; }
      case "thisMonth": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "lastMonth": { const m = subMonths(now, 1); return { start: startOfMonth(m), end: endOfMonth(m) }; }
      case "last3Months": return { start: startOfDay(subMonths(now, 3)), end: endOfDay(now) };
      case "last6Months": return { start: startOfDay(subMonths(now, 6)), end: endOfDay(now) };
      default: return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const [preset, setPreset] = useState<PresetKey>("thisMonth");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const range = useMemo(() => {
    if (preset === "custom" && customStart && customEnd) {
      return { start: startOfDay(customStart), end: endOfDay(customEnd) };
    }
    return buildPreset(preset === "custom" ? "thisMonth" : preset);
  }, [preset, customStart, customEnd]);

  const menuItemsQuery = useMenuItems();
  const categoriesQuery = useMenuCategories();
  const menuItems = menuItemsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  // Build a map: menu_item_id -> category_id
  const itemCategoryMap = useMemo(() => {
    const map = new Map<string, string | null>();
    menuItems.forEach((mi) => map.set(mi.id, mi.category_id));
    return map;
  }, [menuItems]);

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  // Fetch enough history to cover the selected range + previous period for comparison.
  // Daily-comparison tab also needs at least last 14 days. Always fetch >= 6 months for trend convenience.
  const fetchSince = useMemo(() => {
    const rangeSpanDays = differenceInCalendarDays(range.end, range.start) + 1;
    const needed = subDays(range.start, rangeSpanDays + 14);
    const sixMonths = subMonths(new Date(), 6);
    return (needed < sixMonths ? needed : sixMonths).toISOString();
  }, [range]);

  const ordersQuery = useQuery({
    queryKey: ["performance-orders", fetchSince],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_number, total, created_at, order_items(menu_item_id, quantity, unit_price, discount, menu_items(name, name_en, cost))")
        .in("status", ["paid", "completed"])
        .gte("created_at", fetchSince)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PaidOrder[];
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ["performance-payments", fetchSince],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, order_id, amount, tip, payment_method, created_at")
        .gte("created_at", fetchSince)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });

  const orders = ordersQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];

  // Heatmap: last 4 weeks of events (payments already fetched above)
  const HEATMAP_WEEKS = 4;
  const HEATMAP_DAYS = HEATMAP_WEEKS * 7;
  const heatmapEventsQuery = useQuery({
    queryKey: ["performance-heatmap-events"],
    queryFn: async () => {
      const since = startOfDay(subDays(new Date(), HEATMAP_DAYS - 1)).toISOString();
      const { data } = await supabase
        .from("events")
        .select("id, name, color, starts_at, ends_at")
        .gte("starts_at", since);
      return data ?? [];
    },
  });
  const heatmapEvents = heatmapEventsQuery.data ?? [];

  const heatmapToday = startOfDay(new Date());
  const heatmapGrid = Array.from({ length: HEATMAP_WEEKS }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => {
      const daysBack = (HEATMAP_WEEKS - 1 - r) * 7 + (6 - c);
      const d = subDays(heatmapToday, daysBack);
      const dayEnd = new Date(d);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const revenue = payments
        .filter((p) => {
          const cr = new Date(p.created_at);
          return cr >= d && cr < dayEnd;
        })
        .reduce((s, p) => s + (p.amount ?? 0), 0);
      const dayEvents = heatmapEvents.filter((e: any) => {
        const s = new Date(e.starts_at);
        const en = new Date(e.ends_at);
        return s < dayEnd && en >= d;
      });
      return { date: d, revenue, events: dayEvents };
    })
  );
  const heatmapCells = heatmapGrid.flat();
  const maxHeatmapRevenue = Math.max(...heatmapCells.map((d) => d.revenue), 1);
  const weekdayHeaders = Array.from({ length: 7 }, (_, c) => {
    const d = subDays(heatmapToday, 6 - c);
    return { letter: format(d, "EEEEE", { locale: loc }), dow: d.getDay() };
  });

  // Current selected range and an equally-sized previous range for comparison
  const currentPeriod = range;
  const prevPeriod = useMemo(() => {
    const spanMs = range.end.getTime() - range.start.getTime();
    const prevEnd = new Date(range.start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanMs);
    return { start: prevStart, end: prevEnd };
  }, [range]);

  // Auto-bucketed trend periods: daily ≤45d, weekly ≤183d, monthly otherwise
  const { periods, bucketKind } = useMemo(() => {
    const days = differenceInCalendarDays(range.end, range.start) + 1;
    if (days <= 45) {
      const ds = eachDayOfInterval({ start: range.start, end: range.end });
      return {
        bucketKind: "day" as const,
        periods: ds.map((d) => ({ start: startOfDay(d), end: endOfDay(d) })),
      };
    }
    if (days <= 183) {
      const ws = eachWeekOfInterval({ start: range.start, end: range.end }, { weekStartsOn: 1 });
      return {
        bucketKind: "week" as const,
        periods: ws.map((d) => ({ start: startOfWeek(d, { weekStartsOn: 1 }), end: endOfWeek(d, { weekStartsOn: 1 }) })),
      };
    }
    const ms = eachMonthOfInterval({ start: range.start, end: range.end });
    return {
      bucketKind: "month" as const,
      periods: ms.map((d) => ({ start: startOfMonth(d), end: endOfMonth(d) })),
    };
  }, [range]);

  const getOrdersInRange = (start: Date, end: Date) =>
    orders.filter((o) => {
      const d = new Date(o.created_at);
      return d >= start && d <= end;
    });

  const getPaymentsInRange = (start: Date, end: Date) =>
    payments.filter((p) => {
      const d = new Date(p.created_at);
      return d >= start && d <= end;
    });

  // Top sellers for a range, optionally filtered by categories
  const getTopSellers = (start: Date, end: Date, categoryFilter: string[] = [], limit = 10) => {
    const rangeOrders = getOrdersInRange(start, end);
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    rangeOrders.forEach((o) =>
      o.order_items.forEach((item) => {
        // Filter by category if any selected
        if (categoryFilter.length > 0) {
          const catId = itemCategoryMap.get(item.menu_item_id);
          const matchesFilter = categoryFilter.includes(catId ?? "__none__");
          if (!matchesFilter) return;
        }
        const name = language === "en" && item.menu_items?.name_en ? item.menu_items.name_en : item.menu_items?.name ?? "?";
        const key = item.menu_item_id;
        const existing = map.get(key) ?? { name, qty: 0, revenue: 0 };
        existing.qty += item.quantity;
        existing.revenue += item.quantity * item.unit_price * (1 - (item.discount ?? 0) / 100);
        map.set(key, existing);
      })
    );
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
  };

  // KPIs
  const currentOrders = getOrdersInRange(currentPeriod.start, currentPeriod.end);
  const currentPayments = getPaymentsInRange(currentPeriod.start, currentPeriod.end);
  const prevOrders = prevPeriod ? getOrdersInRange(prevPeriod.start, prevPeriod.end) : [];
  const prevPayments = prevPeriod ? getPaymentsInRange(prevPeriod.start, prevPeriod.end) : [];

  const totalRevenue = currentPayments.reduce((s, p) => s + p.amount, 0);
  const prevRevenue = prevPayments.reduce((s, p) => s + p.amount, 0);
  const totalOrders = currentOrders.length;
  const prevTotalOrders = prevOrders.length;
  const totalItems = currentOrders.reduce((s, o) => s + o.order_items.reduce((ss, i) => ss + i.quantity, 0), 0);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const prevAvgTicket = prevTotalOrders > 0 ? prevRevenue / prevTotalOrders : 0;
  const totalTips = currentPayments.reduce((s, p) => s + p.tip, 0);

  // Production-cost-based net profit (excludes tips). Item cost comes from menu_items.cost.
  const sumItemCost = (os: PaidOrder[]) =>
    os.reduce((s, o) => s + o.order_items.reduce((ss, i) => ss + i.quantity * (i.menu_items?.cost ?? 0), 0), 0);
  const totalItemCost = sumItemCost(currentOrders);
  const prevItemCost = sumItemCost(prevOrders);
  const netProfit = totalRevenue - totalItemCost;
  const prevNetProfit = prevRevenue - prevItemCost;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const revChange = pctChange(totalRevenue, prevRevenue);
  const ordersChange = pctChange(totalOrders, prevTotalOrders);
  const ticketChange = pctChange(avgTicket, prevAvgTicket);
  const netProfitChange = pctChange(netProfit, prevNetProfit);

  const topSellers = getTopSellers(currentPeriod.start, currentPeriod.end, selectedCategories);

  // Category breakdown for current period
  const categoryBreakdown = useMemo(() => {
    const rangeOrders = getOrdersInRange(currentPeriod.start, currentPeriod.end);
    type Agg = { catId: string; name: string; qty: number; revenue: number; uniqueItems: Set<string>; bestItem: string; bestItemQty: number; itemQty: Map<string, { name: string; qty: number }> };
    const map = new Map<string, Agg>();
    rangeOrders.forEach((o) =>
      o.order_items.forEach((item) => {
        const catId = itemCategoryMap.get(item.menu_item_id) ?? "__none__";
        const cat = categories.find((c) => c.id === catId);
        const catName = catId === "__none__"
          ? t("performance.noCategory")
          : (language === "en" && cat?.name_en ? cat.name_en : cat?.name ?? "?");
        const itemName = language === "en" && item.menu_items?.name_en ? item.menu_items.name_en : item.menu_items?.name ?? "?";
        const existing = map.get(catId) ?? { catId, name: catName, qty: 0, revenue: 0, uniqueItems: new Set(), bestItem: "", bestItemQty: 0, itemQty: new Map() };
        existing.qty += item.quantity;
        existing.revenue += item.quantity * item.unit_price * (1 - (item.discount ?? 0) / 100);
        existing.uniqueItems.add(item.menu_item_id);
        const ie = existing.itemQty.get(item.menu_item_id) ?? { name: itemName, qty: 0 };
        ie.qty += item.quantity;
        existing.itemQty.set(item.menu_item_id, ie);
        if (ie.qty > existing.bestItemQty) {
          existing.bestItemQty = ie.qty;
          existing.bestItem = itemName;
        }
        map.set(catId, existing);
      })
    );
    return [...map.values()]
      .map((c) => ({
        catId: c.catId,
        name: c.name,
        qty: c.qty,
        revenue: c.revenue,
        uniqueItems: c.uniqueItems.size,
        avgPrice: c.qty > 0 ? c.revenue / c.qty : 0,
        bestItem: c.bestItem,
        bestItemQty: c.bestItemQty,
      }))
      .sort((a, b) => b.revenue - a.revenue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, currentPeriod, itemCategoryMap, categories, language, t]);

  const totalCategoryRevenue = categoryBreakdown.reduce((s, c) => s + c.revenue, 0);


  // Revenue by period for trend
  const trendData = periods.map((p) => {
    const pPayments = getPaymentsInRange(p.start, p.end);
    const pOrders = getOrdersInRange(p.start, p.end);
    const label =
      bucketKind === "day"
        ? format(p.start, "dd/MM", { locale: loc })
        : bucketKind === "week"
          ? `${format(p.start, "dd/MM", { locale: loc })}`
          : format(p.start, "MMM yyyy", { locale: loc });
    return {
      label,
      revenue: pPayments.reduce((s, pp) => s + pp.amount, 0),
      orders: pOrders.length,
      tips: pPayments.reduce((s, pp) => s + pp.tip, 0),
    };
  });

  // Payment method breakdown
  const cashPayments = currentPayments.filter((p) => p.payment_method === "cash");
  const cardPayments = currentPayments.filter((p) => p.payment_method === "card");
  const cashTotal = cashPayments.reduce((s, p) => s + p.amount, 0);
  const cardGross = cardPayments.reduce((s, p) => s + p.amount, 0);
  const cardCommission = cardGross * 0.05;
  const cardNet = cardGross - cardCommission;

  // Peak hours
  const hourCounts = new Array(24).fill(0);
  currentOrders.forEach((o) => {
    const h = new Date(o.created_at).getHours();
    hourCounts[h]++;
  });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const peakHourLabel = peakHour >= 0 ? `${peakHour}:00 - ${peakHour + 1}:00` : "-";

  const formatLabel = (p: typeof currentPeriod) =>
    `${format(p.start, "dd MMM yyyy", { locale: loc })} – ${format(p.end, "dd MMM yyyy", { locale: loc })}`;

  // CSV export helpers
  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTopSellers = () => {
    const sellers = getTopSellers(currentPeriod.start, currentPeriod.end, selectedCategories, 999);
    downloadCsv(
      `top-sellers-${format(currentPeriod.start, "yyyy-MM-dd")}`,
      [t("menu.name"), t("performance.qtySold"), t("billing.income")],
      sellers.map((s) => [s.name, s.qty, s.revenue.toFixed(2)])
    );
  };

  const exportCategories = () => {
    downloadCsv(
      `categories-${format(currentPeriod.start, "yyyy-MM-dd")}`,
      [t("performance.category"), t("performance.qtySold"), t("billing.income"), t("performance.share"), t("performance.uniqueItems"), t("performance.avgPrice"), t("performance.bestItem")],
      categoryBreakdown.map((c) => [
        c.name,
        c.qty,
        c.revenue.toFixed(2),
        totalCategoryRevenue > 0 ? `${((c.revenue / totalCategoryRevenue) * 100).toFixed(1)}%` : "0%",
        c.uniqueItems,
        c.avgPrice.toFixed(2),
        `${c.bestItem} (${c.bestItemQty})`,
      ])
    );
  };

  const exportTrend = () => {
    downloadCsv(
      `trend-${bucketKind}-${format(currentPeriod.start, "yyyy-MM-dd")}_${format(currentPeriod.end, "yyyy-MM-dd")}`,
      [t("performance.period"), t("billing.income"), t("performance.totalOrders"), t("billing.tipsLabel")],
      trendData.map((r) => [r.label, r.revenue.toFixed(2), r.orders, r.tips.toFixed(2)])
    );
  };

  const exportPayments = () => {
    downloadCsv(
      `payments-${format(currentPeriod.start, "yyyy-MM-dd")}`,
      [t("performance.period"), t("billing.cash"), t("billing.card"), t("billing.cardCommission"), t("billing.tipsLabel")],
      [[formatLabel(currentPeriod), cashTotal.toFixed(2), cardGross.toFixed(2), cardCommission.toFixed(2), totalTips.toFixed(2)]]
    );
  };

  const exportHourly = () => {
    downloadCsv(
      `hourly-${format(currentPeriod.start, "yyyy-MM-dd")}`,
      [language === "es" ? "Hora" : "Hour", t("performance.totalOrders")],
      hourCounts.map((count, h) => [`${h}:00`, count])
    );
  };

  const exportRawOrders = () => {
    const rows: (string | number)[][] = [];
    currentOrders.forEach((o) =>
      o.order_items.forEach((item) => {
        const name = language === "en" && item.menu_items?.name_en ? item.menu_items.name_en : item.menu_items?.name ?? "?";
        rows.push([
          format(new Date(o.created_at), "yyyy-MM-dd HH:mm"),
          o.table_number,
          name,
          item.quantity,
          item.unit_price,
          item.discount,
          (item.quantity * item.unit_price * (1 - item.discount / 100)).toFixed(2),
        ]);
      })
    );
    downloadCsv(
      `orders-detail-${format(currentPeriod.start, "yyyy-MM-dd")}`,
      [t("billing.date"), t("billing.table"), t("menu.name"), language === "es" ? "Cant." : "Qty", t("menu.price"), "Desc. %", t("billing.amount")],
      rows
    );
  };

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">{t("common.error")}</div>;
  }

  const loading = ordersQuery.isLoading || paymentsQuery.isLoading;

  const ChangeIndicator = ({ value }: { value: number }) => (
    <span className={`flex items-center gap-1 text-xs ${value >= 0 ? "text-green-600" : "text-destructive"}`}>
      {value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("performance.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("performance.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as PresetKey)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t("performance.preset.today")}</SelectItem>
              <SelectItem value="yesterday">{t("performance.preset.yesterday")}</SelectItem>
              <SelectItem value="last7">{t("performance.preset.last7")}</SelectItem>
              <SelectItem value="last30">{t("performance.preset.last30")}</SelectItem>
              <SelectItem value="thisWeek">{t("performance.preset.thisWeek")}</SelectItem>
              <SelectItem value="lastWeek">{t("performance.preset.lastWeek")}</SelectItem>
              <SelectItem value="thisMonth">{t("performance.preset.thisMonth")}</SelectItem>
              <SelectItem value="lastMonth">{t("performance.preset.lastMonth")}</SelectItem>
              <SelectItem value="last3Months">{t("performance.preset.last3Months")}</SelectItem>
              <SelectItem value="last6Months">{t("performance.preset.last6Months")}</SelectItem>
              <SelectItem value="custom">{t("performance.preset.custom")}</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-2 font-normal", preset === "custom" && "border-primary")}
              >
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {format(currentPeriod.start, "dd MMM", { locale: loc })} – {format(currentPeriod.end, "dd MMM yyyy", { locale: loc })}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 max-h-[80vh] overflow-y-auto" align="end">
              <div className="p-3 border-b">
                <p className="text-xs font-medium text-muted-foreground mb-1">{t("performance.from")}</p>
                <Calendar
                  mode="single"
                  selected={customStart ?? currentPeriod.start}
                  onSelect={(d) => {
                    if (!d) return;
                    setCustomStart(d);
                    if (!customEnd || d > customEnd) setCustomEnd(d);
                    setPreset("custom");
                  }}
                  disabled={(date) => date > new Date()}
                  className={cn("p-0 pointer-events-auto")}
                />
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">{t("performance.to")}</p>
                <Calendar
                  mode="single"
                  selected={customEnd ?? currentPeriod.end}
                  onSelect={(d) => {
                    if (!d) return;
                    setCustomEnd(d);
                    if (!customStart || d < customStart) setCustomStart(d);
                    setPreset("custom");
                  }}
                  disabled={(date) => date > new Date() || (customStart ? date < customStart : false)}
                  className={cn("p-0 pointer-events-auto")}
                />
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title={language === "es" ? "Exportar CSV" : "Export CSV"}>
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportTopSellers}>{t("performance.topSellers")}</DropdownMenuItem>
              <DropdownMenuItem onClick={exportCategories}>{t("performance.byCategory")}</DropdownMenuItem>
              <DropdownMenuItem onClick={exportTrend}>{t("performance.trend")}</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPayments}>{t("performance.paymentBreakdown")}</DropdownMenuItem>
              <DropdownMenuItem onClick={exportHourly}>{t("performance.hourlyDistribution")}</DropdownMenuItem>
              <DropdownMenuItem onClick={exportRawOrders}>{language === "es" ? "Detalle de órdenes" : "Order details"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("billing.income")}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                <ChangeIndicator value={revChange} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("performance.totalOrders")}</CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders}</div>
                <ChangeIndicator value={ordersChange} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("performance.avgTicket")}</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${avgTicket.toFixed(0)}</div>
                <ChangeIndicator value={ticketChange} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("performance.peakHour")}</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{peakHourLabel}</div>
                <span className="text-xs text-muted-foreground">{hourCounts[peakHour]} {t("performance.totalOrders").toLowerCase()}</span>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="top-sellers" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="top-sellers">{t("performance.topSellers")}</TabsTrigger>
              <TabsTrigger value="categories">{t("performance.byCategory")}</TabsTrigger>
              <TabsTrigger value="comparison">{t("performance.comparison")}</TabsTrigger>
              <TabsTrigger value="trend">{t("performance.trend")}</TabsTrigger>
              <TabsTrigger value="heatmap">{t("dash.heatmap")}</TabsTrigger>
              <TabsTrigger value="payment-breakdown">{t("performance.paymentBreakdown")}</TabsTrigger>
              <TabsTrigger value="hours">{t("performance.hourlyDistribution")}</TabsTrigger>
            </TabsList>

            {/* Top Sellers */}
            <TabsContent value="top-sellers">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      {t("performance.topSellers")} — {formatLabel(currentPeriod)}
                    </CardTitle>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Filter className="h-4 w-4" />
                          {t("performance.filterByCategory")}
                          {selectedCategories.length > 0 && (
                            <Badge variant="secondary" className="ml-1">{selectedCategories.length}</Badge>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" align="end">
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {categories.map((cat) => (
                            <label key={cat.id} className="flex items-center gap-2 cursor-pointer text-sm">
                              <Checkbox
                                checked={selectedCategories.includes(cat.id)}
                                onCheckedChange={() => toggleCategory(cat.id)}
                              />
                              {language === "en" && cat.name_en ? cat.name_en : cat.name}
                            </label>
                          ))}
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
                            <Checkbox
                              checked={selectedCategories.includes("__none__")}
                              onCheckedChange={() => toggleCategory("__none__")}
                            />
                            {t("performance.noCategory")}
                          </label>
                        </div>
                        {selectedCategories.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setSelectedCategories([])}
                          >
                            {t("performance.allCategories")}
                          </Button>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  {selectedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedCategories.map((catId) => {
                        const cat = categories.find((c) => c.id === catId);
                        const label = catId === "__none__"
                          ? t("performance.noCategory")
                          : (language === "en" && cat?.name_en ? cat.name_en : cat?.name ?? "?");
                        return (
                          <Badge key={catId} variant="outline" className="gap-1 cursor-pointer" onClick={() => toggleCategory(catId)}>
                            {label}
                            <X className="h-3 w-3" />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {topSellers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t("billing.noData")}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>{t("menu.name")}</TableHead>
                          <TableHead className="text-right">{t("performance.qtySold")}</TableHead>
                          <TableHead className="text-right">{t("billing.income")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topSellers.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {idx < 3 ? (
                                <Badge variant={idx === 0 ? "default" : "secondary"}>
                                  {idx + 1}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">{idx + 1}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">{item.qty}</TableCell>
                            <TableCell className="text-right">${item.revenue.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* By Category */}
            <TabsContent value="categories">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      {t("performance.revenueByCategory")} — {formatLabel(currentPeriod)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {categoryBreakdown.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">{t("billing.noData")}</p>
                    ) : (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                            <XAxis type="number" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                            <YAxis type="category" dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} width={110} />
                            <Tooltip formatter={(value: number, name: string) => name === "revenue" ? [`$${Math.round(value).toLocaleString()}`, t("billing.income")] : [value, t("performance.qtySold")]} />
                            <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t("performance.qtyByCategory")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {categoryBreakdown.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">{t("billing.noData")}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("performance.category")}</TableHead>
                              <TableHead className="text-right">{t("performance.qtySold")}</TableHead>
                              <TableHead className="text-right">{t("billing.income")}</TableHead>
                              <TableHead className="text-right">{t("performance.share")}</TableHead>
                              <TableHead className="text-right hidden sm:table-cell">{t("performance.uniqueItems")}</TableHead>
                              <TableHead className="text-right hidden sm:table-cell">{t("performance.avgPrice")}</TableHead>
                              <TableHead className="hidden md:table-cell">{t("performance.bestItem")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {categoryBreakdown.map((c, idx) => {
                              const share = totalCategoryRevenue > 0 ? (c.revenue / totalCategoryRevenue) * 100 : 0;
                              return (
                                <TableRow key={c.catId}>
                                  <TableCell className="font-medium">
                                    {idx < 3 ? (
                                      <Badge variant={idx === 0 ? "default" : "secondary"} className="mr-2">{idx + 1}</Badge>
                                    ) : (
                                      <span className="text-muted-foreground mr-2">{idx + 1}</span>
                                    )}
                                    {c.name}
                                  </TableCell>
                                  <TableCell className="text-right">{c.qty}</TableCell>
                                  <TableCell className="text-right font-medium">${c.revenue.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="text-xs text-muted-foreground">{share.toFixed(1)}%</span>
                                      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full bg-primary" style={{ width: `${share}%` }} />
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right hidden sm:table-cell">{c.uniqueItems}</TableCell>
                                  <TableCell className="text-right hidden sm:table-cell">${c.avgPrice.toFixed(0)}</TableCell>
                                  <TableCell className="hidden md:table-cell text-sm">
                                    {c.bestItem} <span className="text-muted-foreground text-xs">({c.bestItemQty})</span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Comparison */}
            <TabsContent value="comparison">
              <div className="space-y-4">
                {/* Daily comparison: each of last 7 days vs same day previous week */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      {t("performance.dailyComparison")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const rows = Array.from({ length: 7 }, (_, i) => {
                        const day = subDays(new Date(), 6 - i);
                        const dayStart = startOfDay(day);
                        const dayEndD = endOfDay(day);
                        const prevDay = subDays(day, 7);
                        const prevDayStart = startOfDay(prevDay);
                        const prevDayEnd = endOfDay(prevDay);

                        const curP = getPaymentsInRange(dayStart, dayEndD);
                        const prevP = getPaymentsInRange(prevDayStart, prevDayEnd);
                        const curO = getOrdersInRange(dayStart, dayEndD);
                        const prevO = getOrdersInRange(prevDayStart, prevDayEnd);

                        const curRev = curP.reduce((s, p) => s + p.amount, 0);
                        const prevRev = prevP.reduce((s, p) => s + p.amount, 0);
                        const curTips = curP.reduce((s, p) => s + p.tip, 0);
                        const prevTips = prevP.reduce((s, p) => s + p.tip, 0);
                        const curOrds = curO.length;
                        const prevOrds = prevO.length;
                        const curAvg = curOrds > 0 ? curRev / curOrds : 0;
                        const prevAvg = prevOrds > 0 ? prevRev / prevOrds : 0;

                        return {
                          label: format(day, "EEE dd/MM", { locale: loc }),
                          shortLabel: format(day, "EEE", { locale: loc }),
                          prevLabel: format(prevDay, "dd/MM", { locale: loc }),
                          curRev, prevRev, curOrds, prevOrds, curAvg, prevAvg, curTips, prevTips,
                        };
                      });

                      const chartData = rows.map(r => ({
                        name: r.shortLabel,
                        [language === "es" ? "Esta semana" : "This week"]: r.curRev,
                        [language === "es" ? "Sem. anterior" : "Prev. week"]: r.prevRev,
                      }));

                      const ordersChartData = rows.map(r => ({
                        name: r.shortLabel,
                        [language === "es" ? "Esta semana" : "This week"]: r.curOrds,
                        [language === "es" ? "Sem. anterior" : "Prev. week"]: r.prevOrds,
                      }));

                      const curLabel = language === "es" ? "Esta semana" : "This week";
                      const prevLabel = language === "es" ? "Sem. anterior" : "Prev. week";

                      return (
                        <div className="space-y-6">
                          {/* Revenue chart */}
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">{t("performance.revenue")}</p>
                            <div className="h-[250px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barGap={2}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                  <XAxis dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                                  <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]} />
                                  <Legend />
                                  <Bar dataKey={curLabel} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey={prevLabel} fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Orders chart */}
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">{t("performance.totalOrders")}</p>
                            <div className="h-[200px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ordersChartData} barGap={2}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                  <XAxis dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                                  <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                                  <Tooltip />
                                  <Legend />
                                  <Bar dataKey={curLabel} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey={prevLabel} fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Table */}
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t("performance.day")}</TableHead>
                                  <TableHead className="text-right">{t("performance.revenue")}</TableHead>
                                  <TableHead className="text-right">{t("performance.prevWeekDay")}</TableHead>
                                  <TableHead className="text-right">{t("performance.change")}</TableHead>
                                  <TableHead className="text-right">{t("performance.totalOrders")}</TableHead>
                                  <TableHead className="text-right">{t("performance.avgTicket")}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map((r, idx) => {
                                  const revChg = pctChange(r.curRev, r.prevRev);
                                  return (
                                    <TableRow key={idx}>
                                      <TableCell className="font-medium">{r.label}</TableCell>
                                      <TableCell className="text-right">${r.curRev.toLocaleString()}</TableCell>
                                      <TableCell className="text-right text-muted-foreground">${r.prevRev.toLocaleString()}</TableCell>
                                      <TableCell className="text-right">
                                        <ChangeIndicator value={revChg} />
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {r.curOrds} <span className="text-muted-foreground text-xs">({r.prevOrds})</span>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        ${r.curAvg.toFixed(0)} <span className="text-muted-foreground text-xs">(${r.prevAvg.toFixed(0)})</span>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Current week vs same week previous month + vs previous week */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      {t("performance.weekVsPrevMonth")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const now = new Date();
                      const curWeekStart = startOfWeek(now, { weekStartsOn: 1 });
                      const curWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
                      const prevWeekStart = subWeeks(curWeekStart, 1);
                      const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });
                      const prevMonthStart = startOfMonth(subMonths(now, 1));
                      const prevMonthEnd = endOfMonth(subMonths(now, 1));

                      const calcMetrics = (start: Date, end: Date) => {
                        const p = getPaymentsInRange(start, end);
                        const o = getOrdersInRange(start, end);
                        const revenue = p.reduce((s, pp) => s + pp.amount, 0);
                        const tips = p.reduce((s, pp) => s + pp.tip, 0);
                        const ordersCount = o.length;
                        const items = o.reduce((s, oo) => s + oo.order_items.reduce((ss, ii) => ss + ii.quantity, 0), 0);
                        const avgTicketVal = ordersCount > 0 ? revenue / ordersCount : 0;
                        const avgItemsPerOrder = ordersCount > 0 ? items / ordersCount : 0;
                        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                        const dailyAvgRev = revenue / days;
                        return { revenue, tips, ordersCount, avgTicketVal, avgItemsPerOrder, dailyAvgRev, items };
                      };

                      const cur = calcMetrics(curWeekStart, curWeekEnd);
                      const prevW = calcMetrics(prevWeekStart, prevWeekEnd);
                      const prevM = calcMetrics(prevMonthStart, prevMonthEnd);

                      const curLbl = language === "es" ? "Actual" : "Current";
                      const prevWkLbl = language === "es" ? "Sem. ant." : "Prev. week";
                      const prevMoLbl = language === "es" ? "Mes ant." : "Prev. month";

                      const weeklyChartData = [
                        { name: t("performance.revenue"), [curLbl]: cur.revenue, [prevWkLbl]: prevW.revenue, [prevMoLbl]: prevM.dailyAvgRev * 7 },
                        { name: t("performance.tips"), [curLbl]: cur.tips, [prevWkLbl]: prevW.tips, [prevMoLbl]: prevM.tips / Math.max(1, Math.ceil((prevMonthEnd.getTime() - prevMonthStart.getTime()) / (1000*60*60*24*7))) },
                      ];

                      const weeklyOrdersChart = [
                        { name: t("performance.totalOrders"), [curLbl]: cur.ordersCount, [prevWkLbl]: prevW.ordersCount, [prevMoLbl]: prevM.ordersCount / Math.max(1, Math.ceil((prevMonthEnd.getTime() - prevMonthStart.getTime()) / (1000*60*60*24*7))) },
                      ];

                      const weeklyAvgChart = [
                        { name: t("performance.avgTicket"), [curLbl]: Math.round(cur.avgTicketVal), [prevWkLbl]: Math.round(prevW.avgTicketVal), [prevMoLbl]: Math.round(prevM.avgTicketVal) },
                        { name: t("performance.avgItems"), [curLbl]: parseFloat(cur.avgItemsPerOrder.toFixed(1)), [prevWkLbl]: parseFloat(prevW.avgItemsPerOrder.toFixed(1)), [prevMoLbl]: parseFloat(prevM.avgItemsPerOrder.toFixed(1)) },
                      ];

                      const metrics = [
                        { label: t("performance.revenue"), cur: `$${cur.revenue.toLocaleString()}`, prevWk: `$${prevW.revenue.toLocaleString()}`, chgWk: pctChange(cur.revenue, prevW.revenue), prevMo: `$${prevM.dailyAvgRev.toFixed(0)}/d`, chgMo: pctChange(cur.dailyAvgRev, prevM.dailyAvgRev) },
                        { label: t("performance.totalOrders"), cur: String(cur.ordersCount), prevWk: String(prevW.ordersCount), chgWk: pctChange(cur.ordersCount, prevW.ordersCount), prevMo: `${(prevM.ordersCount / Math.max(1, Math.ceil((prevMonthEnd.getTime() - prevMonthStart.getTime()) / (1000*60*60*24*7)))).toFixed(0)}/sem`, chgMo: pctChange(cur.ordersCount, prevM.ordersCount / Math.max(1, Math.ceil((prevMonthEnd.getTime() - prevMonthStart.getTime()) / (1000*60*60*24*7)))) },
                        { label: t("performance.avgTicket"), cur: `$${cur.avgTicketVal.toFixed(0)}`, prevWk: `$${prevW.avgTicketVal.toFixed(0)}`, chgWk: pctChange(cur.avgTicketVal, prevW.avgTicketVal), prevMo: `$${prevM.avgTicketVal.toFixed(0)}`, chgMo: pctChange(cur.avgTicketVal, prevM.avgTicketVal) },
                        { label: t("performance.tips"), cur: `$${cur.tips.toLocaleString()}`, prevWk: `$${prevW.tips.toLocaleString()}`, chgWk: pctChange(cur.tips, prevW.tips), prevMo: `$${prevM.tips.toLocaleString()}`, chgMo: pctChange(cur.tips, prevM.tips) },
                        { label: t("performance.avgItems"), cur: cur.avgItemsPerOrder.toFixed(1), prevWk: prevW.avgItemsPerOrder.toFixed(1), chgWk: pctChange(cur.avgItemsPerOrder, prevW.avgItemsPerOrder), prevMo: prevM.avgItemsPerOrder.toFixed(1), chgMo: pctChange(cur.avgItemsPerOrder, prevM.avgItemsPerOrder) },
                      ];

                      return (
                        <div className="space-y-6">
                          {/* Revenue & Tips chart */}
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">{t("performance.revenue")} & {t("performance.tips")}</p>
                            <div className="h-[250px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyChartData} barGap={2}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                  <XAxis dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                                  <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                                  <Tooltip formatter={(value: number) => [`$${Math.round(value).toLocaleString()}`, undefined]} />
                                  <Legend />
                                  <Bar dataKey={curLbl} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey={prevWkLbl} fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey={prevMoLbl} fill="hsl(var(--muted-foreground) / 0.15)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Avg ticket & items chart */}
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">{t("performance.avgTicket")} & {t("performance.avgItems")}</p>
                            <div className="h-[200px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyAvgChart} barGap={2}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                  <XAxis dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                                  <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                                  <Tooltip />
                                  <Legend />
                                  <Bar dataKey={curLbl} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey={prevWkLbl} fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey={prevMoLbl} fill="hsl(var(--muted-foreground) / 0.15)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Table */}
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead></TableHead>
                                  <TableHead className="text-right">{t("performance.current")}</TableHead>
                                  <TableHead className="text-right">{prevWkLbl}</TableHead>
                                  <TableHead className="text-right">%</TableHead>
                                  <TableHead className="text-right">{prevMoLbl}</TableHead>
                                  <TableHead className="text-right">%</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {metrics.map((m, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-medium">{m.label}</TableCell>
                                    <TableCell className="text-right font-bold">{m.cur}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{m.prevWk}</TableCell>
                                    <TableCell className="text-right"><ChangeIndicator value={m.chgWk} /></TableCell>
                                    <TableCell className="text-right text-muted-foreground">{m.prevMo}</TableCell>
                                    <TableCell className="text-right"><ChangeIndicator value={m.chgMo} /></TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Trend */}
            <TabsContent value="trend">
              <Card>
                <CardHeader>
                  <CardTitle>{t("performance.trend")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {trendData.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t("billing.noData")}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("performance.period")}</TableHead>
                          <TableHead className="text-right">{t("billing.income")}</TableHead>
                          <TableHead className="text-right">{t("performance.totalOrders")}</TableHead>
                          <TableHead className="text-right">{t("billing.tipsLabel")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trendData.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{row.label}</TableCell>
                            <TableCell className="text-right font-medium">${row.revenue.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{row.orders}</TableCell>
                            <TableCell className="text-right">${row.tips.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Heatmap: revenue by day across last 4 weeks */}
            <TabsContent value="heatmap">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      {t("dash.heatmap")}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {t("dash.heatmapSub")}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <div className="flex flex-col gap-[3px] pt-[18px]">
                      {heatmapGrid.map((row, r) => {
                        const first = row[0].date;
                        const last = row[6].date;
                        const sameMonth = first.getMonth() === last.getMonth();
                        const label = sameMonth
                          ? `${format(first, "MMM d", { locale: loc })}–${format(last, "d", { locale: loc })}`
                          : `${format(first, "MMM d", { locale: loc })}–${format(last, "MMM d", { locale: loc })}`;
                        return (
                          <div
                            key={r}
                            className="h-12 flex items-center text-[10px] text-muted-foreground whitespace-nowrap pr-1"
                          >
                            {label}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex-1 flex flex-col gap-[3px]">
                      <div className="flex gap-[3px]">
                        {weekdayHeaders.map((h, c) => (
                          <span
                            key={c}
                            className={`flex-1 text-center text-xs leading-none ${
                              c === 6 ? "text-primary font-semibold" : "text-muted-foreground"
                            }`}
                          >
                            {h.letter}
                          </span>
                        ))}
                      </div>
                      {heatmapGrid.map((row, r) => (
                        <div key={r} className="flex gap-[3px]">
                          {row.map((cell, c) => {
                            const intensity = cell.revenue / maxHeatmapRevenue;
                            const isFuture = cell.date > heatmapToday;
                            const isToday = cell.date.getTime() === heatmapToday.getTime();
                            const hasEvent = cell.events.length > 0;
                            const eventColor = hasEvent ? (cell.events[0] as any).color : null;
                            return (
                              <div
                                key={c}
                                title={`${format(cell.date, "EEE d MMM", { locale: loc })}: $${cell.revenue.toFixed(0)}${
                                  hasEvent ? ` · ${cell.events.map((e: any) => e.name).join(", ")}` : ""
                                }`}
                                className={`relative flex-1 h-12 rounded-sm border flex flex-col items-start justify-between p-1 ${
                                  isToday ? "border-primary border-2" : "border-border/40"
                                }`}
                                style={{
                                  backgroundColor: isFuture
                                    ? "transparent"
                                    : cell.revenue === 0
                                    ? "hsl(var(--muted))"
                                    : `hsl(var(--primary) / ${0.15 + intensity * 0.85})`,
                                }}
                              >
                                {!isFuture && (
                                  <>
                                    <span
                                      className={`text-[10px] leading-none font-medium ${
                                        intensity > 0.55 ? "text-primary-foreground" : "text-muted-foreground"
                                      }`}
                                    >
                                      {format(cell.date, "d")}
                                    </span>
                                    {cell.revenue > 0 && (
                                      <span
                                        className={`text-[9px] leading-none ${
                                          intensity > 0.55 ? "text-primary-foreground" : "text-foreground"
                                        }`}
                                      >
                                        ${Math.round(cell.revenue)}
                                      </span>
                                    )}
                                  </>
                                )}
                                {hasEvent && (
                                  <span
                                    className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full ring-1 ring-background"
                                    style={{ backgroundColor: eventColor ?? "hsl(var(--accent))" }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-accent ring-1 ring-background" />
                      <span>{language === "en" ? "Event day" : "Día con evento"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>$0</span>
                      {[0.15, 0.4, 0.65, 0.9, 1].map((v) => (
                        <div
                          key={v}
                          className="h-3 w-3 rounded-sm border border-border/40"
                          style={{ backgroundColor: `hsl(var(--primary) / ${v})` }}
                        />
                      ))}
                      <span>${maxHeatmapRevenue.toFixed(0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment Breakdown */}
            <TabsContent value="payment-breakdown">
              <Card>
                <CardHeader>
                  <CardTitle>{t("performance.paymentBreakdown")} — {formatLabel(currentPeriod)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border p-4 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{t("billing.cash")}</p>
                      <p className="text-2xl font-bold">${cashTotal.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{cashPayments.length} {t("billing.transactions").toLowerCase()}</p>
                    </div>
                    <div className="rounded-lg border p-4 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{t("billing.card")}</p>
                      <p className="text-2xl font-bold">${cardNet.toLocaleString()}</p>
                      <div className="text-xs space-y-0.5">
                        <p className="text-muted-foreground">{t("billing.cardGross")}: ${cardGross.toLocaleString()}</p>
                        <p className="text-destructive">{t("billing.cardCommission")}: -${cardCommission.toLocaleString()}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{cardPayments.length} {t("billing.transactions").toLowerCase()}</p>
                    </div>
                    <div className="rounded-lg border p-4 space-y-2 sm:col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">{t("billing.tipsLabel")}</p>
                      <p className="text-2xl font-bold">${totalTips.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hourly Distribution */}
            <TabsContent value="hours">
              <Card>
                <CardHeader>
                  <CardTitle>{t("performance.hourlyDistribution")} — {formatLabel(currentPeriod)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
                    {hourCounts.map((count, h) => {
                      if (count === 0 && (h < 6 || h > 23)) return null;
                      const max = Math.max(...hourCounts, 1);
                      const intensity = count / max;
                      return (
                        <div key={h} className="text-center">
                          <div
                            className="mx-auto w-8 rounded-t"
                            style={{
                              height: `${Math.max(intensity * 80, 4)}px`,
                              backgroundColor: `hsl(var(--primary) / ${0.2 + intensity * 0.8})`,
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-1">{h}h</p>
                          <p className="text-xs font-medium">{count}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Items sold summary */}
          <Card>
            <CardHeader>
              <CardTitle>{t("performance.summary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="text-center p-4 rounded-lg border">
                  <p className="text-3xl font-bold text-primary">{totalItems}</p>
                  <p className="text-sm text-muted-foreground">{t("performance.itemsSold")}</p>
                </div>
                <div className="text-center p-4 rounded-lg border">
                  <p className="text-3xl font-bold text-primary">${(cashTotal + cardNet).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">{t("billing.netIncome")}</p>
                </div>
                <div className="text-center p-4 rounded-lg border">
                  <p className="text-3xl font-bold text-primary">{peakHourLabel}</p>
                  <p className="text-sm text-muted-foreground">{t("performance.peakHour")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default PerformancePage;
