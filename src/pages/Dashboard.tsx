import { fetchAllPages } from "@/lib/fetchAllPages";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useOrders } from "@/hooks/useOrders";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useTableNames } from "@/hooks/useTableNames";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Grid3X3,
  UtensilsCrossed,
  Receipt,
  Users,
  Heart,
  DollarSign,
  TrendingUp,
  Clock,
  ShoppingBag,
  BarChart3,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { startOfDay, subDays, format } from "date-fns";
import { es, enUS } from "date-fns/locale";

const Dashboard = () => {
  const { user, isAdmin, currentBusinessId, hasFeature } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { data: orders = [] } = useOrders();
  const { data: menuItems = [] } = useMenuItems();
  const { tableNames } = useTableNames();

  // Active users in current business
  const { data: profiles = [] } = useQuery({
    queryKey: ["dashboard-profiles", currentBusinessId],
    enabled: !!currentBusinessId,
    queryFn: async () => {
      const members = await fetchAllPages((from, to) => supabase
        .from("business_members")
        .select("user_id")
        .eq("business_id", currentBusinessId ?? "").order("id").range(from, to));
      const ids = (members ?? []).map((m: any) => m.user_id);
      if (ids.length === 0) return [];
      const data = await fetchAllPages((from, to) => supabase
        .from("profiles")
        .select("id, is_active")
        .in("id", ids).order("id").range(from, to));
      return data ?? [];
    },
  });

  // Loyalty members
  const loyaltyEnabled = hasFeature("loyalty");
  const { data: loyaltyStats } = useQuery({
    queryKey: ["dashboard-loyalty", currentBusinessId],
    enabled: !!currentBusinessId && loyaltyEnabled,
    queryFn: async () => {
      const members = await fetchAllPages((from, to) => supabase
        .from("loyalty_members")
        .select("id, total_visits, is_active")
        .eq("business_id", currentBusinessId ?? "").order("id").range(from, to));
      const total = members?.length ?? 0;
      const active = members?.filter((m) => m.is_active).length ?? 0;
      const totalVisits = members?.reduce((s, m) => s + (m.total_visits ?? 0), 0) ?? 0;
      return { total, active, totalVisits };
    },
  });

  // Today's payments
  const { data: todayPayments = [] } = useQuery({
    queryKey: ["dashboard-payments-today", currentBusinessId, user?.id],
    enabled: Boolean(isAdmin && currentBusinessId && user),
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const data = await fetchAllPages((from, to) => supabase
        .from("payments")
        .select("id, amount, tip, payment_method, created_at")
        .eq("business_id", currentBusinessId ?? "").gte("created_at", todayStart).order("created_at").order("id").range(from, to));
      return data ?? [];
    },
  });

  // Recent paid orders (last 7 days) for top sellers
  const { data: recentPaidOrders = [] } = useQuery({
    queryKey: ["dashboard-recent-orders", currentBusinessId, user?.id],
    enabled: Boolean(isAdmin && currentBusinessId && user),
    queryFn: async () => {
      const since = subDays(new Date(), 7).toISOString();
      const data = await fetchAllPages((from, to) => supabase
        .from("orders")
        .select("id, total, created_at, status, order_items(quantity, unit_price, menu_item_id)")
        .in("status", ["paid", "completed"])
        .gte("created_at", since)
        .eq("business_id", currentBusinessId ?? "").order("created_at", { ascending: false }).order("id").range(from, to));
      return data ?? [];
    },
  });

  // Recent payments (last 7 days) for revenue/tips trend
  const { data: recentPayments = [] } = useQuery({
    queryKey: ["dashboard-recent-payments", currentBusinessId, user?.id],
    enabled: Boolean(isAdmin && currentBusinessId && user),
    queryFn: async () => {
      const since = subDays(new Date(), 7).toISOString();
      const data = await fetchAllPages((from, to) => supabase
        .from("payments")
        .select("amount, tip, created_at")
        .eq("business_id", currentBusinessId ?? "").gte("created_at", since).order("created_at").order("id").range(from, to));
      return data ?? [];
    },
  });

  // Heatmap: payments for last 4 weeks (28 days, ending today)
  const HEATMAP_WEEKS = 4;
  const HEATMAP_DAYS = HEATMAP_WEEKS * 7;
  const { data: heatmapPayments = [] } = useQuery({
    queryKey: ["dashboard-heatmap-payments", currentBusinessId, user?.id],
    enabled: Boolean(isAdmin && currentBusinessId && user),
    queryFn: async () => {
      const since = startOfDay(subDays(new Date(), HEATMAP_DAYS - 1)).toISOString();
      const data = await fetchAllPages((from, to) => supabase
        .from("payments")
        .select("amount, created_at")
        .eq("business_id", currentBusinessId ?? "").gte("created_at", since).order("created_at").order("id").range(from, to));
      return data ?? [];
    },
  });

  // Events in heatmap window — to mark days with special events
  const { data: heatmapEvents = [] } = useQuery({
    queryKey: ["dashboard-heatmap-events", currentBusinessId, user?.id],
    enabled: Boolean(isAdmin && currentBusinessId && user),
    queryFn: async () => {
      const since = startOfDay(subDays(new Date(), HEATMAP_DAYS - 1)).toISOString();
      const data = await fetchAllPages((from, to) => supabase
        .from("events")
        .select("id, name, color, starts_at, ends_at")
        .eq("business_id", currentBusinessId ?? "").gte("starts_at", since).order("starts_at").order("id").range(from, to));
      return data ?? [];
    },
  });

  if (!isAdmin) return <Navigate to="/tables" replace />;

  // Computed stats
  const tableCount = Object.keys(tableNames).length;
  // Delivery orders (e.g. Rappi) run on their own status flow and their own tab,
  // so exclude them from dine-in table/status metrics.
  const dineInOrders = orders.filter((o: any) => !o.is_delivery);
  const occupiedTables = dineInOrders.filter(
    (o) => !["paid", "cancelled"].includes(o.status)
  ).length;
  const availableItems = menuItems.filter((i) => i.is_available).length;
  const activeUsers = profiles.filter((p) => p.is_active).length;

  const todayRevenue = todayPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const todayTips = todayPayments.reduce((s, p) => s + (p.tip ?? 0), 0);
  const todayOrderCount = todayPayments.length;
  const todayAvgTicket = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;
  const todayParam = format(new Date(), "yyyy-MM-dd");

  const pendingOrders = dineInOrders.filter((o) => o.status === "pending").length;
  const inProgressOrders = dineInOrders.filter((o) => o.status === "in_progress").length;
  const readyOrders = dineInOrders.filter((o) => o.status === "ready").length;
  const servedOrders = dineInOrders.filter((o) => o.status === "served").length;

  // Top sellers (last 7 days)
  const itemSalesMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const order of recentPaidOrders) {
    for (const item of (order as any).order_items ?? []) {
      const mi = menuItems.find((m) => m.id === item.menu_item_id);
      const name = mi ? (language === "en" && mi.name_en ? mi.name_en : mi.name) : "—";
      const existing = itemSalesMap.get(item.menu_item_id) ?? { name, qty: 0, revenue: 0 };
      existing.qty += item.quantity ?? 1;
      existing.revenue += (item.quantity ?? 1) * (item.unit_price ?? 0);
      itemSalesMap.set(item.menu_item_id, existing);
    }
  }
  const topSellers = [...itemSalesMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // 7-day revenue + tips trend (from payments — coffee revenue excludes tips)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(d);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayPayments = recentPayments.filter((p) => {
      const created = new Date(p.created_at);
      return created >= dayStart && created < dayEnd;
    });
    return {
      label: format(d, "EEE"),
      revenue: dayPayments.reduce((s, p) => s + (p.amount ?? 0), 0),
      tips: dayPayments.reduce((s, p) => s + (p.tip ?? 0), 0),
      orders: dayPayments.length,
    };
  });
  const maxRevenue = Math.max(...last7Days.map((d) => d.revenue), 1);
  const maxTips = Math.max(...last7Days.map((d) => d.tips), 1);
  const totalWeekRevenue = last7Days.reduce((s, d) => s + d.revenue, 0);
  const avgDailyRevenue = totalWeekRevenue / 7;
  const totalWeekTips = last7Days.reduce((s, d) => s + d.tips, 0);
  const avgDailyTips = totalWeekTips / 7;

  const cashPayments = todayPayments.filter((p) => p.payment_method === "cash").length;
  const cardPayments = todayPayments.filter((p) => p.payment_method === "card").length;

  // Heatmap data: 4 weeks × 7 weekdays grid.
  // Columns = weekdays with today's weekday in the rightmost column.
  // Rows = weeks (top = oldest, bottom = current week containing today).
  const today = startOfDay(new Date());
  const heatmapGrid = Array.from({ length: HEATMAP_WEEKS }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => {
      const daysBack = (HEATMAP_WEEKS - 1 - r) * 7 + (6 - c);
      const d = subDays(today, daysBack);
      const dayEnd = new Date(d);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const revenue = heatmapPayments
        .filter((p) => {
          const cr = new Date(p.created_at);
          return cr >= d && cr < dayEnd;
        })
        .reduce((s, p) => s + (p.amount ?? 0), 0);
      const dayEvents = heatmapEvents.filter((e) => {
        const s = new Date(e.starts_at);
        const en = new Date(e.ends_at);
        return s < dayEnd && en >= d;
      });
      return { date: d, revenue, events: dayEvents };
    })
  );
  const allCells = heatmapGrid.flat();
  const maxHeatmapRevenue = Math.max(...allCells.map((d) => d.revenue), 1);
  const dateLocale = language === "es" ? es : enUS;
  // Column headers = weekdays in rotated order (today's weekday last).
  const weekdayHeaders = Array.from({ length: 7 }, (_, c) => {
    const d = subDays(today, 6 - c);
    return { letter: format(d, "EEEEE", { locale: dateLocale }), dow: d.getDay() };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("dashboard.welcome")}, {user?.user_metadata?.full_name || user?.email?.split("@")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">{t("dashboard.title")}</p>
      </div>

      {/* Primary KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(`/order-history?from=${todayParam}&to=${todayParam}`)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dash.todayRevenue")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${todayRevenue.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              {todayOrderCount} {t("dash.orders")} · ${todayAvgTicket.toFixed(0)} avg
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(`/billing?tab=tips&from=${todayParam}&to=${todayParam}`)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dash.todayTips")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${todayTips.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              {cashPayments} {t("billing.cash")} · {cardPayments} {t("billing.card")}
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/tables")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("nav.tables")}
            </CardTitle>
            <Grid3X3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {occupiedTables}/{tableCount}
            </div>
            <p className="text-xs text-muted-foreground">{t("dash.occupied")}</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/menu")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("nav.menu")}
            </CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableItems}</div>
            <p className="text-xs text-muted-foreground">
              {menuItems.length - availableItems} {t("dash.unavailable")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active orders breakdown */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("orders.pending"), count: pendingOrders, color: "bg-yellow-500", to: "/kitchen" },
          { label: t("orders.inProgress"), count: inProgressOrders, color: "bg-blue-500", to: "/kitchen" },
          { label: t("orders.ready"), count: readyOrders, color: "bg-emerald-500", to: "/kitchen" },
          { label: t("orders.served"), count: servedOrders, color: "bg-purple-500", to: "/billing" },
        ].map((s) => (
          <Card
            key={s.label}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(s.to)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${s.color}`} />
              <div>
                <p className="text-lg font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Heatmap: revenue by day across recent weeks */}
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate("/performance")}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              {t("dash.heatmap")}
            </span>
            <span className="text-[10px] font-normal text-muted-foreground">
              {t("dash.heatmapSub")}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {/* Y-axis: week range labels */}
            <div className="flex flex-col gap-[3px] pt-[14px]">
              {heatmapGrid.map((row, r) => {
                const first = row[0].date;
                const last = row[6].date;
                const sameMonth = first.getMonth() === last.getMonth();
                const label = sameMonth
                  ? `${format(first, "MMM d", { locale: dateLocale })}–${format(last, "d", { locale: dateLocale })}`
                  : `${format(first, "MMM d", { locale: dateLocale })}–${format(last, "MMM d", { locale: dateLocale })}`;
                return (
                  <div
                    key={r}
                    className="h-10 flex items-center text-[9px] text-muted-foreground whitespace-nowrap pr-1"
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            {/* Grid */}
            <div className="flex-1 flex flex-col gap-[3px]">
              {/* X-axis: weekday headers */}
              <div className="flex gap-[3px]">
                {weekdayHeaders.map((h, c) => (
                  <span
                    key={c}
                    className={`flex-1 text-center text-[10px] leading-none ${
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
                    const isFuture = cell.date > today;
                    const isToday = cell.date.getTime() === today.getTime();
                    const hasEvent = cell.events.length > 0;
                    const eventColor = hasEvent ? cell.events[0].color : null;
                    return (
                      <div
                        key={c}
                        title={`${format(cell.date, "EEE d MMM", { locale: dateLocale })}: $${cell.revenue.toFixed(0)}${
                          hasEvent ? ` · ${cell.events.map((e) => e.name).join(", ")}` : ""
                        }`}
                        className={`relative flex-1 h-10 rounded-sm border flex items-end justify-start p-0.5 ${
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
                          <span
                            className={`text-[8px] leading-none ${
                              intensity > 0.55 ? "text-primary-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {format(cell.date, "d")}
                          </span>
                        )}
                        {hasEvent && (
                          <span
                            className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background"
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
          {/* Legend */}
          <div className="flex items-center justify-between gap-2 mt-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent ring-1 ring-background" />
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

      {/* Bottom sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 7-day coffee revenue trend */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/performance")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t("dash.weekTrend")} · {t("performance.revenue")}
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">
                ${totalWeekRevenue.toFixed(0)} · ${avgDailyRevenue.toFixed(0)}/d
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1">
              {last7Days.map((d) => {
                const h = (d.revenue / maxRevenue) * 80;
                return (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium h-3.5">
                      {d.revenue > 0 ? `$${d.revenue.toFixed(0)}` : ""}
                    </span>
                    <div className="relative w-full h-20">
                      {/* Average line aligned with bar coordinate system */}
                      {avgDailyRevenue > 0 && d.label === last7Days[0].label && (
                        <div
                          className="absolute -left-1 right-0 border-t border-dashed border-emerald-500/60 z-10 pointer-events-none"
                          style={{ bottom: `${(avgDailyRevenue / maxRevenue) * 80}px`, width: `calc(700% + 24px)` }}
                        >
                          <span className="absolute left-0 -top-2.5 text-[9px] text-emerald-600 font-medium bg-background px-1 rounded">
                            avg
                          </span>
                        </div>
                      )}
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t bg-primary/80 transition-all"
                        style={{ height: `${h}px` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 7-day tips trend (own scale) */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/performance")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                {t("dash.weekTrend")} · {t("performance.tips")}
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">
                ${totalWeekTips.toFixed(0)} · ${avgDailyTips.toFixed(0)}/d
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-28">
              {last7Days.map((d) => {
                const h = (d.tips / maxTips) * 80;
                return (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {d.tips > 0 ? `$${d.tips.toFixed(0)}` : ""}
                    </span>
                    <div className="w-full flex flex-col-reverse min-h-[2px]">
                      <div
                        className="w-full rounded-t bg-amber-500 transition-all"
                        style={{ height: `${h}px` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top sellers */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/performance")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              {t("performance.topSellers")} (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSellers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.noResults")}</p>
            ) : (
              <div className="space-y-2">
                {topSellers.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        ×{item.qty}
                      </Badge>
                      <span className="w-16 text-right font-medium text-foreground">
                        ${item.revenue.toFixed(0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team & Loyalty */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/users")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("dash.team")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold">{activeUsers}</p>
                <p className="text-xs text-muted-foreground">{t("dash.activeUsers")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{profiles.length}</p>
                <p className="text-xs text-muted-foreground">{t("dash.totalUsers")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {loyaltyEnabled && (
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/loyalty-admin")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Heart className="h-4 w-4" />
                {t("loyalty.admin")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold">{loyaltyStats?.active ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t("dash.activeMembers")}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{loyaltyStats?.totalVisits ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t("loyalty.totalVisits")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
