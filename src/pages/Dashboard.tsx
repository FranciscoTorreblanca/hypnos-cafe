import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useOrders } from "@/hooks/useOrders";
import { useMenuItems } from "@/hooks/useMenuItems";
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

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { data: orders = [] } = useOrders();
  const { data: menuItems = [] } = useMenuItems();

  // Profiles (active users)
  const { data: profiles = [] } = useQuery({
    queryKey: ["dashboard-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, is_active");
      return data ?? [];
    },
  });

  // Loyalty members
  const { data: loyaltyStats } = useQuery({
    queryKey: ["dashboard-loyalty"],
    queryFn: async () => {
      const { data: members } = await supabase
        .from("loyalty_members")
        .select("id, total_visits, is_active");
      const total = members?.length ?? 0;
      const active = members?.filter((m) => m.is_active).length ?? 0;
      const totalVisits = members?.reduce((s, m) => s + (m.total_visits ?? 0), 0) ?? 0;
      return { total, active, totalVisits };
    },
  });

  // Today's payments
  const { data: todayPayments = [] } = useQuery({
    queryKey: ["dashboard-payments-today"],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const { data } = await supabase
        .from("payments")
        .select("id, amount, tip, payment_method, created_at")
        .gte("created_at", todayStart);
      return data ?? [];
    },
  });

  // Recent paid orders (last 7 days) for top sellers
  const { data: recentPaidOrders = [] } = useQuery({
    queryKey: ["dashboard-recent-orders"],
    queryFn: async () => {
      const since = subDays(new Date(), 7).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("id, total, created_at, status, order_items(quantity, unit_price, menu_item_id)")
        .in("status", ["paid", "completed"])
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Recent payments (last 7 days) for revenue/tips trend
  const { data: recentPayments = [] } = useQuery({
    queryKey: ["dashboard-recent-payments"],
    queryFn: async () => {
      const since = subDays(new Date(), 7).toISOString();
      const { data } = await supabase
        .from("payments")
        .select("amount, tip, created_at")
        .gte("created_at", since);
      return data ?? [];
    },
  });

  if (!isAdmin) return <Navigate to="/tables" replace />;

  // Computed stats
  const tableCount = 12;
  const occupiedTables = orders.filter(
    (o) => !["paid", "cancelled"].includes(o.status)
  ).length;
  const availableItems = menuItems.filter((i) => i.is_available).length;
  const activeUsers = profiles.filter((p) => p.is_active).length;

  const todayRevenue = todayPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const todayTips = todayPayments.reduce((s, p) => s + (p.tip ?? 0), 0);
  const todayOrderCount = todayPayments.length;
  const todayAvgTicket = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;

  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const inProgressOrders = orders.filter((o) => o.status === "in_progress").length;
  const readyOrders = orders.filter((o) => o.status === "ready").length;
  const servedOrders = orders.filter((o) => o.status === "served").length;

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
  const maxStack = Math.max(...last7Days.map((d) => d.revenue + d.tips), 1);

  const cashPayments = todayPayments.filter((p) => p.payment_method === "cash").length;
  const cardPayments = todayPayments.filter((p) => p.payment_method === "card").length;

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
          onClick={() => navigate("/performance")}
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
          onClick={() => navigate("/performance")}
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

      {/* Bottom sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 7-day trend (stacked: coffee revenue + tips) */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/performance")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t("dash.weekTrend")}
              </span>
              <span className="flex items-center gap-3 text-[10px] font-normal text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-primary/80" />
                  {t("performance.revenue")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-amber-500" />
                  {t("performance.tips")}
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-28">
              {last7Days.map((d) => {
                const total = d.revenue + d.tips;
                const totalH = (total / maxStack) * 80;
                const revH = total > 0 ? (d.revenue / total) * totalH : 0;
                const tipH = total > 0 ? (d.tips / total) * totalH : 0;
                return (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      ${total > 0 ? total.toFixed(0) : ""}
                    </span>
                    <div className="w-full flex flex-col-reverse min-h-[2px]">
                      <div
                        className="w-full bg-primary/80 transition-all"
                        style={{ height: `${revH}px` }}
                      />
                      <div
                        className="w-full rounded-t bg-amber-500 transition-all"
                        style={{ height: `${tipH}px` }}
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
      </div>
    </div>
  );
};

export default Dashboard;
