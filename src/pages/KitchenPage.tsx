import { useLanguage } from "@/i18n/LanguageContext";
import { useOrders } from "@/hooks/useOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock } from "lucide-react";

const KitchenPage = () => {
  const { t, language } = useLanguage();
  const { data: orders = [], updateOrderStatus } = useOrders();

  const activeOrders = orders.filter((o) => o.status === "pending" || o.status === "in_progress");

  const handleMarkReady = async (orderId: string) => {
    await updateOrderStatus.mutateAsync({ id: orderId, status: "completed" });
  };

  const handleStart = async (orderId: string) => {
    await updateOrderStatus.mutateAsync({ id: orderId, status: "in_progress" });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.kitchen")}</h1>

      {activeOrders.length === 0 ? (
        <p className="text-muted-foreground">{t("orders.noActive")}</p>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {activeOrders.map((order) => (
            <Card key={order.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {t("tables.title")} {order.table_number}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      order.status === "pending"
                        ? "bg-amber-100 text-amber-800 border-amber-200"
                        : "bg-blue-100 text-blue-800 border-blue-200"
                    }
                  >
                    {order.status === "pending" ? t("orders.pending") : t("orders.inProgress")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleTimeString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  {(order.order_items ?? []).map((oi) => (
                    <div key={oi.id} className="flex justify-between text-sm">
                      <span>
                        {oi.quantity}x{" "}
                        {language === "es" ? oi.menu_item?.name : oi.menu_item?.name_en}
                      </span>
                      {oi.notes && <span className="text-xs text-muted-foreground italic">{oi.notes}</span>}
                    </div>
                  ))}
                </div>
                {order.notes && (
                  <p className="text-xs italic text-muted-foreground border-t pt-2">{order.notes}</p>
                )}
                <div className="flex gap-2">
                  {order.status === "pending" && (
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => handleStart(order.id)}>
                      <Clock className="h-3 w-3" />
                      {t("orders.start")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => handleMarkReady(order.id)}
                  >
                    <CheckCircle className="h-3 w-3" />
                    {t("orders.markReady")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default KitchenPage;
