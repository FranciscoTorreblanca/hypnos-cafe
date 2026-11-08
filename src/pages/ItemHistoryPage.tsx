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

interface ItemSaleStats {
  id: string; first_sale: string | null; last_sale: string | null;
  units: number; revenue: number; orders: number; days: number;
}
interface ItemSalesReport {
  fetched_at: string; items: ItemSaleStats[];
  monthly: { month: string; units: number; revenue: number }[];
}

const money = (n: number) => `$${n.toFixed(2)}`;

const ItemHistoryPage = () => {
  const { currentBusinessId, user, isAdmin } = useAuth();
  const { language } = useLanguage();
  const loc = language === "es" ? es : enUS;
  const es_ = language === "es";
  const { data: items = [] } = useMenuItems();

  const [selectedId, setSelectedId] = useState<string>("");
  const [range, setRange] = useState<"all" | "30" | "90" | "month" | "year">("all");
  const [search, setSearch] = useState("");

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

  const loadReport = async (itemId: string | null, signal: AbortSignal) => {
    if (!currentBusinessId) throw new Error("No business selected");
    const { data, error } = await supabase.rpc("item_sales_report", {
      _business_id: currentBusinessId,
      _start: rangeStart?.toISOString() ?? undefined,
      _end: new Date().toISOString(),
      _item_id: itemId ?? undefined,
    }).abortSignal(signal);
    if (error) throw error;
    return data as unknown as ItemSalesReport;
  };
  const summary = useQuery({
    queryKey: ["item_sales_history", currentBusinessId, user?.id, rangeStart?.toISOString() ?? "all"],
    enabled: Boolean(currentBusinessId && user && isAdmin),
    staleTime: 60_000,
    queryFn: ({ signal }) => loadReport(null, signal),
  });
  // Monthly detail is requested only for the item the user opens.
  const detail = useQuery({
    queryKey: ["item_sales_history", currentBusinessId, user?.id, rangeStart?.toISOString() ?? "all", selectedId],
    enabled: Boolean(currentBusinessId && user && isAdmin && selectedId),
    staleTime: 60_000,
    queryFn: ({ signal }) => loadReport(selectedId, signal),
  });
  const stats = useMemo(() => new Map((summary.data?.items ?? []).map(s => [s.id, s])), [summary.data]);
  const isLoading = summary.isLoading;

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
          firstSale: s?.first_sale ?? null,
          lastSale: s?.last_sale ?? null,
          units,
          revenue,
          cost,
          profit: revenue - cost,
          margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
          ordersCount: s?.orders ?? 0,
          days: s?.days ?? 0,
        };
      })
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue);
  }, [items, stats, search, es_]);

  const selected = rows.find((r) => r.item.id === selectedId) ?? null;

  const monthly = (detail.data?.monthly ?? []).map(m => ({
    ...m, month: format(parseISO(m.month), "MMM yy", { locale: loc }),
  }));

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
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={isLoading || summary.isError}>
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

          {selected && !isLoading && !summary.isError && (
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

              {detail.isLoading && <p className="text-sm text-muted-foreground">{es_ ? "Cargando…" : "Loading…"}</p>}
              {detail.isError && <p role="alert" className="text-sm text-destructive">{es_ ? "No se pudo cargar el detalle." : "Could not load details."}</p>}
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
          {summary.isError ? (
            <div role="alert" className="text-sm text-destructive py-6">
              {es_ ? "No se pudo cargar el historial completo." : "Could not load complete history."}
              <Button variant="outline" size="sm" className="ml-3" onClick={() => summary.refetch()}>{es_ ? "Reintentar" : "Retry"}</Button>
            </div>
          ) : isLoading ? (
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
