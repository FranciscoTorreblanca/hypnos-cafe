import { fetchAllPages } from "@/lib/fetchAllPages";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity, Clock, Users, MousePointerClick, TrendingUp, Lightbulb, ArrowRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { subDays } from "date-fns";
import CookingTimeStats from "@/components/analytics/CookingTimeStats";

type UsageRow = {
  id: string;
  user_id: string;
  role: string;
  event_type: string;
  path: string;
  action_name: string;
  from_path: string;
  duration_ms: number | null;
  metadata: any;
  created_at: string;
};

const PATH_LABELS: Record<string, { es: string; en: string }> = {
  "/dashboard": { es: "Panel", en: "Dashboard" },
  "/tables": { es: "Mesas", en: "Tables" },
  "/menu": { es: "Menú", en: "Menu" },
  "/cost-calculator": { es: "Calculadora de costos", en: "Cost Calculator" },
  "/menu-generator": { es: "Generador de menú", en: "Menu Generator" },
  "/kitchen": { es: "Cocina", en: "Kitchen" },
  "/billing": { es: "Caja", en: "Billing" },
  "/tickets": { es: "Tickets", en: "Tickets" },
  "/performance": { es: "Rendimiento", en: "Performance" },
  "/order-history": { es: "Historial", en: "Order History" },
  "/stock": { es: "Inventario", en: "Stock" },
  "/calendar": { es: "Calendario", en: "Calendar" },
  "/loyalty-admin": { es: "Lealtad admin", en: "Loyalty admin" },
  "/loyalty-scan": { es: "Escanear lealtad", en: "Loyalty scan" },
  "/users": { es: "Usuarios", en: "Users" },
  "/settings": { es: "Configuración", en: "Settings" },
  "/analytics": { es: "Analítica de uso", en: "Usage Analytics" },
  "/budget": { es: "Presupuesto", en: "Budget" },
  "/wifi": { es: "Wifi", en: "Wifi" },
};

function labelForPath(path: string, lang: "es" | "en"): string {
  return PATH_LABELS[path]?.[lang] ?? path;
}

function fmtDuration(ms: number): string {
  if (!ms || ms < 1000) return `${Math.round(ms)} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "hsl(var(--muted-foreground))"];

export default function AnalyticsPage() {
  const { t, language } = useLanguage();
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const since = useMemo(() => subDays(new Date(), rangeDays).toISOString(), [rangeDays]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["usage-events", rangeDays],
    queryFn: async ({ signal }) => fetchAllPages<UsageRow>((from, to) =>
      (supabase.from("usage_events") as any).select("*").gte("created_at", since)
        .order("created_at", { ascending: false }).order("id").range(from, to).abortSignal(signal), signal),
    staleTime: 60_000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["analytics-profiles"],
    queryFn: async ({ signal }) => fetchAllPages((from, to) => supabase.from("profiles")
      .select("id, full_name, email").order("id").range(from, to).abortSignal(signal), signal),
    staleTime: 5 * 60_000,
  });

  const filteredEvents = useMemo(() => {
    if (roleFilter === "all") return events;
    return events.filter((e) => e.role === roleFilter);
  }, [events, roleFilter]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.role));
    return Array.from(set);
  }, [events]);

  // Aggregations
  const screenStats = useMemo(() => {
    type Acc = {
      path: string;
      views: number;
      uniqueUsers: Set<string>;
      totalDuration: number;
      durationSamples: number;
      actions: number;
    };
    const map = new Map<string, Acc>();
    for (const e of filteredEvents) {
      if (!e.path) continue;
      if (!map.has(e.path)) {
        map.set(e.path, {
          path: e.path,
          views: 0,
          uniqueUsers: new Set(),
          totalDuration: 0,
          durationSamples: 0,
          actions: 0,
        });
      }
      const acc = map.get(e.path)!;
      acc.uniqueUsers.add(e.user_id);
      if (e.event_type === "page_view") acc.views++;
      if (e.event_type === "action") acc.actions++;
      if (e.event_type === "page_leave" && e.duration_ms && e.duration_ms < 60 * 60 * 1000) {
        acc.totalDuration += e.duration_ms;
        acc.durationSamples++;
      }
    }
    return Array.from(map.values())
      .map((a) => ({
        path: a.path,
        label: labelForPath(a.path, language),
        views: a.views,
        uniqueUsers: a.uniqueUsers.size,
        avgDuration: a.durationSamples ? a.totalDuration / a.durationSamples : 0,
        totalDuration: a.totalDuration,
        actions: a.actions,
        // Engagement score: combines views, time spent, and unique users
        engagement:
          a.views * 1 +
          a.uniqueUsers.size * 5 +
          a.actions * 2 +
          Math.min(a.totalDuration / 1000 / 60, 1000), // capped minutes
      }))
      .sort((a, b) => b.views - a.views);
  }, [filteredEvents, language]);

  const totalViews = screenStats.reduce((s, x) => s + x.views, 0);
  const totalUsers = new Set(filteredEvents.map((e) => e.user_id)).size;
  const totalDuration = screenStats.reduce((s, x) => s + x.totalDuration, 0);
  const totalActions = screenStats.reduce((s, x) => s + x.actions, 0);

  // Role breakdown
  const roleStats = useMemo(() => {
    const map = new Map<string, { role: string; views: number; users: Set<string> }>();
    for (const e of events) {
      if (!map.has(e.role)) map.set(e.role, { role: e.role, views: 0, users: new Set() });
      const r = map.get(e.role)!;
      r.users.add(e.user_id);
      if (e.event_type === "page_view") r.views++;
    }
    return Array.from(map.values()).map((r) => ({
      role: r.role,
      views: r.views,
      users: r.users.size,
    }));
  }, [events]);

  // Top user flows (from -> to)
  const flows = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filteredEvents) {
      if (e.event_type !== "page_view") continue;
      if (!e.from_path || !e.path) continue;
      const key = `${e.from_path}__${e.path}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([k, v]) => {
        const [from, to] = k.split("__");
        return { from, to, count: v };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [filteredEvents]);

  // Top users
  const topUsers = useMemo(() => {
    const map = new Map<string, { user_id: string; views: number; duration: number; role: string }>();
    for (const e of filteredEvents) {
      if (!map.has(e.user_id))
        map.set(e.user_id, { user_id: e.user_id, views: 0, duration: 0, role: e.role });
      const u = map.get(e.user_id)!;
      if (e.event_type === "page_view") u.views++;
      if (e.event_type === "page_leave" && e.duration_ms && e.duration_ms < 60 * 60 * 1000) {
        u.duration += e.duration_ms;
      }
    }
    return Array.from(map.values())
      .map((u) => {
        const profile: any = profiles.find((p: any) => p.id === u.user_id);
        return {
          ...u,
          name: profile?.full_name || profile?.email || u.user_id.slice(0, 8),
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [filteredEvents, profiles]);

  // Insights / recommendations
  const insights = useMemo(() => {
    const out: { type: "warning" | "info" | "success"; message: string }[] = [];
    if (screenStats.length === 0) return out;

    // Low engagement screens (visited but very little time)
    const lowEngagement = screenStats.filter(
      (s) => s.views >= 5 && s.avgDuration > 0 && s.avgDuration < 5000
    );
    lowEngagement.slice(0, 3).forEach((s) => {
      out.push({
        type: "warning",
        message:
          language === "es"
            ? `${s.label}: visitada ${s.views} veces pero solo ${fmtDuration(s.avgDuration)} promedio. Quizá los usuarios no encuentran lo que buscan o regresan rápido.`
            : `${s.label}: visited ${s.views} times but only ${fmtDuration(s.avgDuration)} on average. Users may not be finding what they need or bouncing quickly.`,
      });
    });

    // High traffic screens — confirm value
    const top = screenStats[0];
    if (top && top.views > 10) {
      out.push({
        type: "success",
        message:
          language === "es"
            ? `${top.label} es la pantalla más usada (${top.views} vistas). Considera optimizar su rendimiento y poner las acciones más comunes al alcance.`
            : `${top.label} is the most used screen (${top.views} views). Consider optimizing performance and surfacing the most common actions there.`,
      });
    }

    // Unused screens
    const allKnownPaths = Object.keys(PATH_LABELS);
    const visitedSet = new Set(screenStats.map((s) => s.path));
    const unused = allKnownPaths.filter((p) => !visitedSet.has(p));
    if (unused.length > 0) {
      out.push({
        type: "info",
        message:
          language === "es"
            ? `Pantallas sin uso en este rango: ${unused.map((p) => labelForPath(p, "es")).join(", ")}. Considera ocultarlas, promoverlas o eliminarlas.`
            : `Screens with no usage in this range: ${unused.map((p) => labelForPath(p, "en")).join(", ")}. Consider hiding, promoting, or removing them.`,
      });
    }

    // Long average time = workflow friction
    const slow = screenStats.filter((s) => s.avgDuration > 5 * 60 * 1000 && s.views > 3);
    slow.slice(0, 2).forEach((s) => {
      out.push({
        type: "warning",
        message:
          language === "es"
            ? `${s.label} toma en promedio ${fmtDuration(s.avgDuration)} por sesión. Puede haber fricción — revisa si hay pasos lentos o formularios complejos.`
            : `${s.label} averages ${fmtDuration(s.avgDuration)} per session. There may be friction — check for slow steps or complex forms.`,
      });
    });

    return out;
  }, [screenStats, language]);

  const chartData = screenStats.slice(0, 10).map((s) => ({
    name: s.label,
    views: s.views,
    avgMin: Number((s.avgDuration / 1000 / 60).toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("analytics.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("analytics.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{language === "es" ? "Último día" : "Last day"}</SelectItem>
              <SelectItem value="7">{language === "es" ? "Últimos 7 días" : "Last 7 days"}</SelectItem>
              <SelectItem value="30">{language === "es" ? "Últimos 30 días" : "Last 30 days"}</SelectItem>
              <SelectItem value="90">{language === "es" ? "Últimos 90 días" : "Last 90 days"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === "es" ? "Todos los roles" : "All roles"}</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">{t("analytics.totalViews")}</div>
              <div className="text-xl font-bold">{totalViews}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">{t("analytics.activeUsers")}</div>
              <div className="text-xl font-bold">{totalUsers}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">{t("analytics.totalTime")}</div>
              <div className="text-xl font-bold">{fmtDuration(totalDuration)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MousePointerClick className="h-8 w-8 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">{t("analytics.actions")}</div>
              <div className="text-xl font-bold">{totalActions}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-primary" />
              {t("analytics.insights")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((i, idx) => (
              <div
                key={idx}
                className={`text-sm rounded-md border p-3 ${
                  i.type === "warning"
                    ? "border-destructive/30 bg-destructive/5"
                    : i.type === "success"
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/30"
                }`}
              >
                {i.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="screens">
        <TabsList>
          <TabsTrigger value="screens">{t("analytics.screens")}</TabsTrigger>
          <TabsTrigger value="flows">{t("analytics.flows")}</TabsTrigger>
          <TabsTrigger value="users">{t("analytics.users")}</TabsTrigger>
          <TabsTrigger value="roles">{t("analytics.roles")}</TabsTrigger>
          <TabsTrigger value="cooking">{language === "es" ? "Cocina" : "Cooking"}</TabsTrigger>
        </TabsList>

        <TabsContent value="cooking" className="space-y-4">
          <CookingTimeStats />
        </TabsContent>


        <TabsContent value="screens" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("analytics.topScreens")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" width={120} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("analytics.screen")}</TableHead>
                    <TableHead className="text-right">{t("analytics.views")}</TableHead>
                    <TableHead className="text-right">{t("analytics.unique")}</TableHead>
                    <TableHead className="text-right">{t("analytics.avgTime")}</TableHead>
                    <TableHead className="text-right">{t("analytics.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {screenStats.map((s) => (
                    <TableRow key={s.path}>
                      <TableCell className="font-medium">{s.label}</TableCell>
                      <TableCell className="text-right">{s.views}</TableCell>
                      <TableCell className="text-right">{s.uniqueUsers}</TableCell>
                      <TableCell className="text-right">{fmtDuration(s.avgDuration)}</TableCell>
                      <TableCell className="text-right">{s.actions}</TableCell>
                    </TableRow>
                  ))}
                  {screenStats.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        {t("analytics.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flows">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t("analytics.topFlows")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {flows.map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-sm rounded-md border border-border p-2.5">
                  <span className="font-medium">{labelForPath(f.from, language)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{labelForPath(f.to, language)}</span>
                  <Badge variant="secondary" className="ml-auto">{f.count}</Badge>
                </div>
              ))}
              {flows.length === 0 && (
                <div className="text-center text-muted-foreground py-6">{t("analytics.empty")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("analytics.user")}</TableHead>
                    <TableHead>{t("analytics.role")}</TableHead>
                    <TableHead className="text-right">{t("analytics.views")}</TableHead>
                    <TableHead className="text-right">{t("analytics.totalTime")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsers.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                      <TableCell className="text-right">{u.views}</TableCell>
                      <TableCell className="text-right">{fmtDuration(u.duration)}</TableCell>
                    </TableRow>
                  ))}
                  {topUsers.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        {t("analytics.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("analytics.role")}</TableHead>
                    <TableHead className="text-right">{t("analytics.views")}</TableHead>
                    <TableHead className="text-right">{t("analytics.uniqueUsers")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleStats.map((r) => (
                    <TableRow key={r.role}>
                      <TableCell><Badge>{r.role}</Badge></TableCell>
                      <TableCell className="text-right">{r.views}</TableCell>
                      <TableCell className="text-right">{r.users}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
