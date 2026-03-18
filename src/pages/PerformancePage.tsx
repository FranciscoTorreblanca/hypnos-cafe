import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subWeeks, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, BarChart3, Clock, Award, X, Filter, Download } from "lucide-react";
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
    menu_items: { name: string; name_en: string } | null;
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
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [rangeCount, setRangeCount] = useState(4);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

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

  const ordersQuery = useQuery({
    queryKey: ["performance-orders"],
    queryFn: async () => {
      const since = subMonths(new Date(), 6).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_number, total, created_at, order_items(menu_item_id, quantity, unit_price, discount, menu_items(name, name_en))")
        .in("status", ["paid", "completed"])
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PaidOrder[];
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ["performance-payments"],
    queryFn: async () => {
      const since = subMonths(new Date(), 6).toISOString();
      const { data, error } = await supabase
        .from("payments")
        .select("id, order_id, amount, tip, payment_method, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });

  const orders = ordersQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];

  // Build time periods
  const periods = useMemo(() => {
    const now = new Date();
    if (period === "week") {
      return Array.from({ length: rangeCount }, (_, i) => {
        const w = subWeeks(now, i);
        return { start: startOfWeek(w, { weekStartsOn: 1 }), end: endOfWeek(w, { weekStartsOn: 1 }) };
      }).reverse();
    }
    return Array.from({ length: rangeCount }, (_, i) => {
      const m = subMonths(now, i);
      return { start: startOfMonth(m), end: endOfMonth(m) };
    }).reverse();
  }, [period, rangeCount]);

  const currentPeriod = periods[periods.length - 1];
  const prevPeriod = periods.length > 1 ? periods[periods.length - 2] : null;

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

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const revChange = pctChange(totalRevenue, prevRevenue);
  const ordersChange = pctChange(totalOrders, prevTotalOrders);
  const ticketChange = pctChange(avgTicket, prevAvgTicket);

  const topSellers = getTopSellers(currentPeriod.start, currentPeriod.end, selectedCategories);

  // Revenue by period for trend
  const trendData = periods.map((p) => {
    const pPayments = getPaymentsInRange(p.start, p.end);
    const pOrders = getOrdersInRange(p.start, p.end);
    return {
      label: period === "week"
        ? `${format(p.start, "dd/MM", { locale: loc })}`
        : format(p.start, "MMM yyyy", { locale: loc }),
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
    period === "week"
      ? `${format(p.start, "dd MMM", { locale: loc })} – ${format(p.end, "dd MMM", { locale: loc })}`
      : format(p.start, "MMMM yyyy", { locale: loc });

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

  const exportTrend = () => {
    downloadCsv(
      `trend-${period}`,
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
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{t("billing.weekly")}</SelectItem>
              <SelectItem value="month">{t("billing.monthly")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(rangeCount)} onValueChange={(v) => setRangeCount(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">{language === "es" ? "Últ. 4" : "Last 4"}</SelectItem>
              <SelectItem value="8">{language === "es" ? "Últ. 8" : "Last 8"}</SelectItem>
              <SelectItem value="12">{language === "es" ? "Últ. 12" : "Last 12"}</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title={language === "es" ? "Exportar CSV" : "Export CSV"}>
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportTopSellers}>{t("performance.topSellers")}</DropdownMenuItem>
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
              <TabsTrigger value="trend">{t("performance.trend")}</TabsTrigger>
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
