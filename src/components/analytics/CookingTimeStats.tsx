import { fetchAllPages } from "@/lib/fetchAllPages";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, ComposedChart, Line, Legend,
} from "recharts";
import { subDays } from "date-fns";
import { ChefHat } from "lucide-react";

type Row = {
  id: string;
  menu_item_id: string;
  created_at: string;
  started_at: string | null;
  ready_at: string | null;
  menu_items: {
    name: string;
    name_en: string;
    cooking_time_seconds: number | null;
  } | null;
};

const RANGES: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function fmt(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CookingTimeStats() {
  const { language } = useLanguage();
  const { currentBusinessId, user, isAdmin } = useAuth();
  const [range, setRange] = useState<keyof typeof RANGES>("30d");
  const [selectedItem, setSelectedItem] = useState<string | "">("");

  const since = useMemo(() => subDays(new Date(), RANGES[range]).toISOString(), [range]);

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["cooking_stats", currentBusinessId, user?.id, range],
    enabled: Boolean(isAdmin && currentBusinessId && user),
    queryFn: async ({ signal }) => {
      const data = await fetchAllPages((from, to) => supabase
        .from("order_items")
        .select("id, menu_item_id, created_at, started_at, ready_at, menu_items(name, name_en, cooking_time_seconds)")
        .not("ready_at", "is", null)
        .gte("ready_at", since)
        .eq("business_id", currentBusinessId ?? "").order("ready_at").order("id")
        .range(from, to).abortSignal(signal), signal);
      return (data ?? []) as unknown as Row[];
    },
  });

  // Build per-item stats
  const itemStats = useMemo(() => {
    const groups = new Map<string, { name: string; target: number | null; durations: number[] }>();
    for (const r of rows) {
      if (!r.ready_at || !r.menu_items) continue;
      const start = r.started_at ? new Date(r.started_at).getTime() : new Date(r.created_at).getTime();
      const end = new Date(r.ready_at).getTime();
      const sec = Math.max(0, (end - start) / 1000);
      if (sec <= 0 || sec > 6 * 3600) continue; // sanity cap 6h
      const key = r.menu_item_id;
      if (!groups.has(key)) {
        groups.set(key, {
          name: language === "es" ? r.menu_items.name : (r.menu_items.name_en || r.menu_items.name),
          target: r.menu_items.cooking_time_seconds,
          durations: [],
        });
      }
      groups.get(key)?.durations.push(sec);
    }
    return Array.from(groups.entries())
      .map(([id, g]) => {
        const sorted = [...g.durations].sort((a, b) => a - b);
        const sum = sorted.reduce((s, x) => s + x, 0);
        const avg = sorted.length ? sum / sorted.length : 0;
        const median = quantile(sorted, 0.5);
        const p95 = quantile(sorted, 0.95);
        const p99 = quantile(sorted, 0.99);
        const min = sorted[0] ?? 0;
        const max = sorted[sorted.length - 1] ?? 0;
        return { id, ...g, count: sorted.length, avg, median, p95, p99, min, max, durations: sorted };
      })
      .sort((a, b) => b.count - a.count);
  }, [rows, language]);

  const selected = itemStats.find((i) => i.id === selectedItem) ?? itemStats[0];

  // Histogram for selected item: 20 bins
  const histogram = useMemo(() => {
    if (!selected || selected.durations.length === 0) return [];
    const min = selected.min;
    const max = Math.max(selected.max, selected.p99 || selected.max);
    const bins = 20;
    const width = Math.max(1, (max - min) / bins);
    const out = Array.from({ length: bins }, (_, i) => ({
      bucket: min + i * width,
      label: fmt(min + i * width),
      count: 0,
    }));
    for (const d of selected.durations) {
      let idx = Math.floor((d - min) / width);
      if (idx >= bins) idx = bins - 1;
      if (idx < 0) idx = 0;
      out[idx].count += 1;
    }
    return out;
  }, [selected]);

  // Top items overview chart: p50/p95/p99 vs target
  const overviewData = useMemo(
    () =>
      itemStats.slice(0, 12).map((s) => ({
        name: s.name.length > 14 ? s.name.slice(0, 13) + "…" : s.name,
        median: Math.round(s.median),
        p95: Math.round(s.p95),
        p99: Math.round(s.p99),
        target: s.target ?? null,
      })),
    [itemStats],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {language === "es" ? "Datos basados en órdenes marcadas como listas" : "Based on items marked as ready"}
          </span>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as any)}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">{language === "es" ? "7 días" : "7 days"}</SelectItem>
            <SelectItem value="30d">{language === "es" ? "30 días" : "30 days"}</SelectItem>
            <SelectItem value="90d">{language === "es" ? "90 días" : "90 days"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <p role="alert" className="text-sm text-destructive">{language === "es" ? "No se pudo cargar el informe completo." : "Could not load the complete report."}</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">{language === "es" ? "Cargando…" : "Loading…"}</p>
      ) : itemStats.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {language === "es" ? "Aún no hay datos suficientes." : "Not enough data yet."}
        </p>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {language === "es" ? "Top ítems: mediana, p95, p99 vs objetivo" : "Top items: median, p95, p99 vs target"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={overviewData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" angle={-20} textAnchor="end" height={70} fontSize={11} interval={0} />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 60)}m`} fontSize={11} />
                    <Tooltip formatter={(v: any) => fmt(Number(v))} />
                    <Legend />
                    <Bar dataKey="median" name={language === "es" ? "Mediana" : "Median"} fill="hsl(var(--primary))" />
                    <Bar dataKey="p95" name="p95" fill="hsl(var(--accent))" />
                    <Bar dataKey="p99" name="p99" fill="hsl(var(--destructive))" />
                    <Line dataKey="target" name={language === "es" ? "Objetivo" : "Target"} stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>{language === "es" ? "Distribución del ítem" : "Item distribution"}</span>
                <Select value={selected?.id ?? ""} onValueChange={setSelectedItem}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {itemStats.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.count})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selected && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs mb-3">
                    <Stat label={language === "es" ? "Muestras" : "Samples"} value={selected.count.toString()} />
                    <Stat label={language === "es" ? "Promedio" : "Avg"} value={fmt(selected.avg)} />
                    <Stat label={language === "es" ? "Mediana" : "Median"} value={fmt(selected.median)} />
                    <Stat label="p95" value={fmt(selected.p95)} />
                    <Stat label="p99" value={fmt(selected.p99)} />
                    <Stat label={language === "es" ? "Objetivo" : "Target"} value={selected.target ? fmt(selected.target) : "—"} />
                  </div>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histogram}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" fontSize={10} angle={-30} textAnchor="end" height={60} interval={1} />
                        <YAxis fontSize={11} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))">
                          {histogram.map((h, i) => {
                            const t = selected.target ?? 0;
                            const over = t > 0 && h.bucket >= t;
                            return <Cell key={i} fill={over ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />;
                          })}
                        </Bar>
                        {selected.target ? (
                          <ReferenceLine
                            x={fmt(selected.target)}
                            stroke="hsl(var(--muted-foreground))"
                            strokeDasharray="4 4"
                            label={{ value: language === "es" ? "Objetivo" : "Target", position: "top", fontSize: 10 }}
                          />
                        ) : null}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {language === "es" ? "Detalle por ítem" : "Per-item detail"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "es" ? "Ítem" : "Item"}</TableHead>
                    <TableHead className="text-right">{language === "es" ? "Muestras" : "Samples"}</TableHead>
                    <TableHead className="text-right">{language === "es" ? "Promedio" : "Avg"}</TableHead>
                    <TableHead className="text-right">{language === "es" ? "Mediana" : "Median"}</TableHead>
                    <TableHead className="text-right">p95</TableHead>
                    <TableHead className="text-right">p99</TableHead>
                    <TableHead className="text-right">{language === "es" ? "Objetivo" : "Target"}</TableHead>
                    <TableHead className="text-right">Δ p95</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemStats.map((s) => {
                    const diff = s.target ? s.p95 - s.target : null;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-right">{s.count}</TableCell>
                        <TableCell className="text-right">{fmt(s.avg)}</TableCell>
                        <TableCell className="text-right">{fmt(s.median)}</TableCell>
                        <TableCell className="text-right">{fmt(s.p95)}</TableCell>
                        <TableCell className="text-right">{fmt(s.p99)}</TableCell>
                        <TableCell className="text-right">{s.target ? fmt(s.target) : "—"}</TableCell>
                        <TableCell className="text-right">
                          {diff == null ? "—" : (
                            <Badge variant="outline" className={diff > 0 ? "border-red-400 text-red-700" : "border-emerald-400 text-emerald-700"}>
                              {diff > 0 ? "+" : ""}{fmt(Math.abs(diff))}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-mono">{value}</div>
    </div>
  );
}
