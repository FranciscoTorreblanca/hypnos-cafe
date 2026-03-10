import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useOrders } from "@/hooks/useOrders";
import { useTableNames } from "@/hooks/useTableNames";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderDialog } from "@/components/orders/OrderDialog";
import { Plus, Eye } from "lucide-react";

const TablesPage = () => {
  const { t } = useLanguage();
  const { data: orders = [] } = useOrders();
  const { getTableLabel } = useTableNames();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<number>(1);

  const tableCount = 12;
  const tables = Array.from({ length: tableCount }, (_, i) => {
    const num = i + 1;
    const activeOrder = (orders ?? []).find(
      (o) => o.table_number === num && !["paid", "cancelled"].includes(o.status)
    );
    return { number: num, order: activeOrder };
  });

  const getStatus = (table: (typeof tables)[0]) => {
    if (!table.order) return "available";
    if (table.order.status === "ready") return "ready";
    if (table.order.status === "served") return "served";
    return "occupied";
  };

  const statusColors: Record<string, string> = {
    available: "bg-emerald-100 text-emerald-800 border-emerald-200",
    occupied: "bg-amber-100 text-amber-800 border-amber-200",
    ready: "bg-blue-100 text-blue-800 border-blue-200",
    served: "bg-purple-100 text-purple-800 border-purple-200",
  };

  const openTable = (num: number) => {
    setSelectedTable(num);
    setDialogOpen(true);
  };

  const activeOrder = (orders ?? []).find(
    (o) => o.table_number === selectedTable && !["paid", "cancelled"].includes(o.status)
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{t("tables.title")}</h1>
      <div className="grid gap-2 sm:gap-4 grid-cols-3 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((table) => {
          const status = getStatus(table);
          const label = getTableLabel(table.number);
          return (
            <Card
              key={table.number}
              className="cursor-pointer hover:shadow-md active:shadow-sm transition-shadow"
              onClick={() => openTable(table.number)}
            >
              <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-lg truncate">
                    {label}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-2 sm:p-4 pt-0 sm:pt-0">
                <Badge className={`${statusColors[status]} text-[10px] sm:text-xs`} variant="outline">
                  {t(`tables.${status}` as any)}
                </Badge>
                {table.order && (
                  <div className="mt-1 sm:mt-2">
                    <p className="text-xs sm:text-sm font-medium">${table.order.total.toFixed(0)}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {(table.order.order_items ?? []).length} items
                    </p>
                  </div>
                )}
                <div className="mt-1 sm:mt-2">
                  <Button variant="outline" size="sm" className="w-full gap-1 h-7 sm:h-8 text-xs">
                    {table.order ? (
                      <><Eye className="h-3 w-3" /><span className="hidden sm:inline">{t("orders.viewOrder")}</span></>
                    ) : (
                      <><Plus className="h-3 w-3" /><span className="hidden sm:inline">{t("orders.newOrder")}</span></>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <OrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tableNumber={selectedTable}
        tableName={getTableLabel(selectedTable)}
        order={activeOrder}
      />
    </div>
  );
};

export default TablesPage;
