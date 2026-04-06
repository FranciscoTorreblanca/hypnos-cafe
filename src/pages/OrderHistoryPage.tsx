import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Download, Calendar, Receipt, Clock } from "lucide-react";

interface HistoryOrderItem {
  id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  notes: string;
  status: string;
  created_at: string;
  menu_items: { name: string; name_en: string } | null;
}

interface HistoryOrder {
  id: string;
  table_number: number;
  status: string;
  notes: string;
  total: number;
  general_discount: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  order_items: HistoryOrderItem[];
  waiterName?: string;
  cashierName?: string;
  payments: { amount: number; tip: number; payment_method: string; created_at: string; created_by: string }[];
}

const OrderHistoryPage = () => {
  const { t, language } = useLanguage();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["order-history", dateFrom, dateTo],
    queryFn: async () => {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(*, menu_items(name, name_en)),
          payments(amount, tip, payment_method, created_at, created_by)
        `)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Collect unique user IDs for waiter/cashier names
      const userIds = new Set<string>();
      (data ?? []).forEach((o: any) => {
        if (o.created_by) userIds.add(o.created_by);
        (o.payments ?? []).forEach((p: any) => { if (p.created_by) userIds.add(p.created_by); });
      });

      let profileMap: Record<string, { full_name: string; email: string }> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", Array.from(userIds));
        (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });
      }

      return (data ?? []).map((o: any) => ({
        ...o,
        waiterName: profileMap[o.created_by]?.full_name || profileMap[o.created_by]?.email || "",
        cashierName: o.payments?.[0]?.created_by ? (profileMap[o.payments[0].created_by]?.full_name || profileMap[o.payments[0].created_by]?.email || "") : "",
      })) as HistoryOrder[];
    },
  });

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter((o) => {
        const tableMatch = String(o.table_number).includes(s);
        const itemMatch = o.order_items.some((oi) => {
          const name = language === "en" && oi.menu_items?.name_en ? oi.menu_items.name_en : oi.menu_items?.name ?? "";
          return name.toLowerCase().includes(s);
        });
        const waiterMatch = o.waiterName?.toLowerCase().includes(s);
        return tableMatch || itemMatch || waiterMatch;
      });
    }
    return result;
  }, [orders, statusFilter, search, language]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid");
    const totalRevenue = paid.reduce((s, o) => {
      const payment = o.payments?.[0];
      return s + (payment?.amount ?? o.total);
    }, 0);
    const totalTips = paid.reduce((s, o) => s + (o.payments?.[0]?.tip ?? 0), 0);
    const totalItems = paid.reduce((s, o) => s + o.order_items.reduce((si, oi) => si + oi.quantity, 0), 0);
    return { totalRevenue, totalTips, paidCount: paid.length, totalItems, totalOrders: orders.length };
  }, [orders]);

  const exportCsv = () => {
    const rows = [["Fecha", "Mesa", "Mesero", "Producto", "Cant", "P.Unit", "Desc%", "Subtotal", "Notas", "Estado Orden", "Método Pago", "Total Orden", "Propina"]];
    filtered.forEach((o) => {
      const waiter = o.waiterName || "";
      const payment = o.payments?.[0];
      o.order_items.forEach((oi) => {
        const name = language === "en" && oi.menu_items?.name_en ? oi.menu_items.name_en : oi.menu_items?.name ?? "";
        const sub = oi.quantity * oi.unit_price * (1 - (oi.discount ?? 0) / 100);
        rows.push([
          format(new Date(o.created_at), "yyyy-MM-dd HH:mm"),
          String(o.table_number),
          waiter,
          name,
          String(oi.quantity),
          oi.unit_price.toFixed(2),
          String(oi.discount ?? 0),
          sub.toFixed(2),
          oi.notes,
          o.status,
          payment?.payment_method ?? "",
          o.total.toFixed(2),
          String(payment?.tip ?? 0),
        ]);
      });
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `order-history-${dateFrom}-${dateTo}.csv`;
    a.click();
  };

  if (!isAdmin) return <Navigate to="/tables" replace />;

  const dateFmt = (d: string) => format(new Date(d), "dd MMM yyyy HH:mm", { locale: language === "es" ? es : enUS });

  const statusColor = (s: string) => {
    switch (s) {
      case "paid": return "default";
      case "cancelled": return "destructive";
      case "completed": case "ready": case "served": return "secondary";
      default: return "outline";
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, Record<string, string>> = {
      pending: { es: "Pendiente", en: "Pending" },
      in_progress: { es: "En preparación", en: "In Progress" },
      completed: { es: "Completada", en: "Completed" },
      ready: { es: "Lista", en: "Ready" },
      served: { es: "Servida", en: "Served" },
      paid: { es: "Pagada", en: "Paid" },
      cancelled: { es: "Cancelada", en: "Cancelled" },
    };
    return map[s]?.[language] ?? s;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{language === "es" ? "Historial de órdenes" : "Order History"}</h1>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1">
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{language === "es" ? "Órdenes" : "Orders"}</p>
            <p className="text-xl font-bold">{stats.totalOrders}</p>
            <p className="text-[10px] text-muted-foreground">{stats.paidCount} {language === "es" ? "pagadas" : "paid"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{language === "es" ? "Ventas" : "Revenue"}</p>
            <p className="text-xl font-bold">${stats.totalRevenue.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{language === "es" ? "Propinas" : "Tips"}</p>
            <p className="text-xl font-bold">${stats.totalTips.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{language === "es" ? "Productos" : "Items"}</p>
            <p className="text-xl font-bold">{stats.totalItems}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language === "es" ? "Buscar mesa, producto, mesero..." : "Search table, item, waiter..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === "es" ? "Todos" : "All"}</SelectItem>
            <SelectItem value="paid">{language === "es" ? "Pagadas" : "Paid"}</SelectItem>
            <SelectItem value="cancelled">{language === "es" ? "Canceladas" : "Cancelled"}</SelectItem>
            <SelectItem value="in_progress">{language === "es" ? "En progreso" : "In Progress"}</SelectItem>
            <SelectItem value="ready">{language === "es" ? "Listas" : "Ready"}</SelectItem>
            <SelectItem value="served">{language === "es" ? "Servidas" : "Served"}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[130px]" />
          <span className="text-muted-foreground text-xs">–</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[130px]" />
        </div>
      </div>

      {/* Orders */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">{language === "es" ? "Sin órdenes en este rango" : "No orders in this range"}</div>
      ) : (
        <ScrollArea className="h-[calc(100dvh-380px)]">
          <Accordion type="multiple" className="space-y-2">
            {filtered.map((order) => {
              const payment = order.payments?.[0];
              const waiter = order.waiterName || "—";
              const cashier = order.cashierName;
              const itemCount = order.order_items.reduce((s, oi) => s + oi.quantity, 0);
              const discountedTotal = order.total * (1 - (order.general_discount ?? 0) / 100);

              return (
                <AccordionItem key={order.id} value={order.id} className="border rounded-lg px-3">
                  <AccordionTrigger className="py-2 hover:no-underline">
                    <div className="flex flex-wrap items-center gap-2 text-left w-full pr-2">
                      <Badge variant={statusColor(order.status) as any} className="text-[10px]">
                        {statusLabel(order.status)}
                      </Badge>
                      <span className="font-semibold text-sm">
                        {language === "es" ? "Mesa" : "Table"} {order.table_number}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {dateFmt(order.created_at)}
                      </span>
                      <span className="ml-auto font-bold text-sm">${discountedTotal.toFixed(2)}</span>
                      {payment && (
                        <Badge variant="outline" className="text-[10px]">
                          {payment.payment_method === "cash" ? "💵" : "💳"} {payment.payment_method}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 space-y-3">
                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>👤 {language === "es" ? "Mesero" : "Waiter"}: <strong className="text-foreground">{waiter}</strong></span>
                      {cashier && <span>💰 {language === "es" ? "Cobró" : "Charged by"}: <strong className="text-foreground">{cashier}</strong></span>}
                      {payment && <span>{language === "es" ? "Propina" : "Tip"}: <strong className="text-foreground">${payment.tip.toFixed(2)}</strong></span>}
                      <span>{itemCount} {language === "es" ? "productos" : "items"}</span>
                      {order.general_discount > 0 && (
                        <span className="text-destructive">{language === "es" ? "Desc. general" : "General disc."}: {order.general_discount}%</span>
                      )}
                    </div>

                    {/* Items table */}
                    <div className="border rounded overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-1.5 font-medium">{language === "es" ? "Producto" : "Item"}</th>
                            <th className="text-center p-1.5 font-medium w-10">{language === "es" ? "Cant" : "Qty"}</th>
                            <th className="text-right p-1.5 font-medium w-16">{language === "es" ? "P.Unit" : "Price"}</th>
                            <th className="text-right p-1.5 font-medium w-12">{language === "es" ? "Desc" : "Disc"}</th>
                            <th className="text-right p-1.5 font-medium w-16">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.order_items.map((oi) => {
                            const name = language === "en" && oi.menu_items?.name_en ? oi.menu_items.name_en : oi.menu_items?.name ?? "—";
                            const sub = oi.quantity * oi.unit_price * (1 - (oi.discount ?? 0) / 100);
                            return (
                              <tr key={oi.id} className="border-t border-border/50">
                                <td className="p-1.5">
                                  {name}
                                  {oi.notes && <span className="block text-[10px] text-muted-foreground italic">{oi.notes}</span>}
                                </td>
                                <td className="text-center p-1.5">{oi.quantity}</td>
                                <td className="text-right p-1.5">${oi.unit_price.toFixed(2)}</td>
                                <td className="text-right p-1.5">{oi.discount > 0 ? `${oi.discount}%` : "—"}</td>
                                <td className="text-right p-1.5 font-medium">${sub.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {order.notes && (
                      <p className="text-xs text-muted-foreground italic">📝 {order.notes}</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>
      )}
    </div>
  );
};

export default OrderHistoryPage;
