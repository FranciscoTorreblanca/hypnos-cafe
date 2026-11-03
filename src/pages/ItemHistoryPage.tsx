import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMenuItems } from "@/hooks/useMenuItems";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO, startOfMonth, subDays, subMonths, startOfYear, differenceInCalendarDays } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { Search, History, Download } from "lucide-react";
import { normalizeSearch } from "@/lib/utils";
import { itemSearchText } from "@/hooks/useMenuItems";

interface SoldLine {
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  discount_amount: number;
  sold_at: string;
  order_id: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;

const ItemHistoryPage = () => {
  const { currentBusinessId } = useAuth();
  const { language } = useLanguage();
  const loc = language === "es" ? es : enUS;
  const es_ = language === "es";
  const { data: items = [] } = useMenuItems();

  const [selectedId, setSelectedId] = useState<string>("");
  const [range, setRange] = useState<"all" | "30" | "90" | "month" | "year">("all");
  const [search, setSearch] = useState("");

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["item_sales_history", currentBusinessId],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("menu_item_id, quantity, unit_price, discount, discount_amount, order_id, orders!inner(status, created_at)")
        .eq("orders.status", "paid")
        .limit(20000);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        menu_item_id: r.menu_item_id,
        quantity: r.quantity ?? 0,
        unit_price: Number(r.unit_price ?? 0),
        discount: Number(r.discount ?? 0),
        discount_amount: Number(r.discount_amount ?? 0),
        order_id: r.order_id,
        sold_at: r.orders?.created_at,
      })) as SoldLine[];
    },
  });

  const rangeStart = useMemo(() => {
    const now = new Date();
    switch (range) {
      case "30": return subDays(now, 30);
      case "90": return subDays(now, 90);
      case "month": return startOfMonth(now);
      case "year": return startOfYear(now);
      default: return null;
    }
  }, [range]);

  const lineNet = (l: SoldLine) =>
    Math.max(0, l.quantity * l.unit_price * (1 - (l.discount || 0) / 100) - (l.discount_amount || 0));

  // Aggregate per item (all-time + range)
  const stats = useMemo(() => {
    const map = new Map<string, {
      firstSale: string | null; lastSale: string | null; unitsAll: number;
      units: number; revenue: number; orders: Set<string>; days: Set<string>;
    }>();
    for (const l of lines) {
      if (!l.menu_item_id || !l.sold_at) continue;
      let s = map.get(l.menu_item_id);
      if (!s) {
        s = { firstSale: null, lastSale: null, unitsAll: 0, units: 0, revenue: 0, orders: new Set(), days: new Set() };
        map.set(l.menu_item_id, s);
      }
      if (!s.firstSale || l.sold_at < s.firstSale) s.firstSale = l.sold_at;
      if (!s.lastSale || l.sold_at > s.lastSale) s.lastSale = l.sold_at;
      s.unitsAll += l.quantity;
      if (rangeStart && new Date(l.sold_at) < rangeStart) continue;
      s.units += l.quantity;
      s.revenue += lineNet(l);
      s.orders.add(l.order_id);
      s.days.add(l.sold_at.slice(0, 10));
    }
    return map;
  }, [lines, rangeStart]);

  const rows = useMemo(() => {
    return items
      .filter((i) =>
        !search ||
        normalizeSearch(itemSearchText(i as any)).includes(normalizeSearch(search)) ||
        normalizeSearch(i.name_en).includes(normalizeSearch(search)))
      .map((i) => {
        const s = stats.get(i.id);
        const units = s?.units ?? 0;
        const revenue = s?.revenue ?? 0;
        const cost = (i.cost ?? 0) * units;
        return {
          item: i,
          name: es_ ? i.name : i.name_en || i.name,
          firstSale: s?.firstSale ?? null,
          lastSale: s?.lastSale ?? null,
          units,
          revenue,
          cost,
          profit: revenue - cost,
          margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
          ordersCount: s?.orders.size ?? 0,
          days: s?.days.size ?? 0,
        };
      })
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue);
  }, [items, stats, search, es_]);

  const selected = rows.find((r) => r.item.id === selectedId) ?? null;

  const monthly = useMemo(() => {
    if (!selectedId) return [];
    const m = new Map<string, { units: number; revenue: number }>();
    for (const l of lines) {
      if (l.menu_item_id !== selectedId || !l.sold_at) continue;
      if (rangeStart && new Date(l.sold_at) < rangeStart) continue;
      const key = l.sold_at.slice(0, 7);
      const e = m.get(key) ?? { units: 0, revenue: 0 };
      e.units += l.quantity;
      e.revenue += lineNet(l);
      m.set(key, e);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ month: format(parseISO(k + "-01"), "MMM yy", { locale: loc }), ...v }));
  }, [lines, selectedId, rangeStart, loc]);

  const fmtDate = (d: string | null) =>
    d ? format(parseISO(d), "dd MMM yyyy", { locale: loc }) : "—";

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = [
      es_ ? "Artículo" : "Item", es_ ? "Primera venta" : "First sale", es_ ? "Última venta" : "Last sale",
      es_ ? "Unidades" : "Units", es_ ? "Órdenes" : "Orders", es_ ? "Ingresos" : "Revenue",
      es_ ? "Costo" : "Cost", es_ ? "Ganancia" : "Profit", es_ ? "Margen %" : "Margin %",
    ];
    const csv = [headers.join(","), ...rows.map((r) => [
      r.name, r.firstSale ?? "", r.lastSale ?? "", r.units, r.ordersCount,
      r.revenue.toFixed(2), r.cost.toFixed(2), r.profit.toFixed(2), r.margin.toFixed(1),
    ].map(esc).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `item_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const daysSpan = selected?.firstSale
    ? Math.max(1, differenceInCalendarDays(new Date(), parseISO(selected.firstSale)))
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <History className="h-5 w-5" />
          {es_ ? "Historial de artículos" : "Item history"}
        </h1>
        <div className="flex gap-2 items-center">
          <Select value={range} onValueChange={(v) => setRange(v as any)}>
            <SelectTrigger className="w-[190px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{es_ ? "Todo el historial" : "All history"}</SelectItem>
              <SelectItem value="month">{es_ ? "Este mes" : "This month"}</SelectItem>
              <SelectItem value="30">{es_ ? "Últimos 30 días" : "Last 30 days"}</SelectItem>
              <SelectItem value="90">{es_ ? "Últimos 90 días" : "Last 90 days"}</SelectItem>
              <SelectItem value="year">{es_ ? "Este año" : "This year"}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" />CSV
          </Button>
        </div>
      </div>

      {/* Item detail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{es_ ? "Analizar un artículo" : "Analyze an item"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full sm:w-[320px]">
              <SelectValue placeholder={es_ ? "Selecciona un artículo" : "Select an item"} />
            </SelectTrigger>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.id} value={i.id}>{es_ ? i.name : i.name_en || i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selected && (
            <>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <Stat label={es_ ? "Primera venta" : "First sale"} value={fmtDate(selected.firstSale)}
                  hint={selected.firstSale ? `${daysSpan} ${es_ ? "días en venta" : "days on sale"}` : (es_ ? "Nunca vendido" : "Never sold")} />
                <Stat label={es_ ? "Última venta" : "Last sale"} value={fmtDate(selected.lastSale)} />
                <Stat label={es_ ? "Unidades vendidas" : "Units sold"} value={String(selected.units)}
                  hint={`${selected.ordersCount} ${es_ ? "órdenes" : "orders"} · ${selected.days} ${es_ ? "días con venta" : "days with sales"}`} />
                <Stat label={es_ ? "Ingresos netos" : "Net revenue"} value={money(selected.revenue)}
                  hint={selected.units > 0 ? `${es_ ? "Prom." : "Avg"} ${money(selected.revenue / selected.units)}/u` : undefined} />
                <Stat label={es_ ? "Costo estimado" : "Estimated cost"} value={money(selected.cost)}
                  hint={`${money(selected.item.cost ?? 0)}/u`} />
                <Stat label={es_ ? "Ganancia" : "Profit"} value={money(selected.profit)}
                  className={selected.profit >= 0 ? "text-green-600" : "text-destructive"} />
                <Stat label={es_ ? "Margen" : "Margin"} value={`${selected.margin.toFixed(1)}%`} />
                <Stat label={es_ ? "Ritmo de venta" : "Sales pace"}
                  value={daysSpan > 0 ? `${(selected.units / daysSpan).toFixed(2)} u/${es_ ? "día" : "day"}` : "—"} />
              </div>

              {monthly.length > 0 && (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="units" name={es_ ? "Unidades" : "Units"} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* All items table */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">{es_ ? "Todos los artículos" : "All items"}</CardTitle>
          <div className="relative w-full max-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder={es_ ? "Buscar" : "Search"} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{es_ ? "Cargando…" : "Loading…"}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{es_ ? "Artículo" : "Item"}</TableHead>
                  <TableHead>{es_ ? "Primera venta" : "First sale"}</TableHead>
                  <TableHead className="text-right">{es_ ? "Unidades" : "Units"}</TableHead>
                  <TableHead className="text-right">{es_ ? "Ingresos" : "Revenue"}</TableHead>
                  <TableHead className="text-right">{es_ ? "Ganancia" : "Profit"}</TableHead>
                  <TableHead className="text-right">{es_ ? "Margen" : "Margin"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.item.id} className="cursor-pointer" onClick={() => setSelectedId(r.item.id)}>
                    <TableCell className="font-medium">
                      {r.name}
                      {!r.firstSale && <Badge variant="outline" className="ml-2 text-[10px]">{es_ ? "Sin ventas" : "No sales"}</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{fmtDate(r.firstSale)}</TableCell>
                    <TableCell className="text-right">{r.units}</TableCell>
                    <TableCell className="text-right">{money(r.revenue)}</TableCell>
                    <TableCell className={`text-right ${r.profit >= 0 ? "" : "text-destructive"}`}>{money(r.profit)}</TableCell>
                    <TableCell className="text-right">{r.units > 0 ? `${r.margin.toFixed(0)}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Stat = ({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) => (
  <div className="rounded-lg border border-border p-3">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`text-lg font-semibold ${className ?? ""}`}>{value}</p>
    {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

export default ItemHistoryPage;
