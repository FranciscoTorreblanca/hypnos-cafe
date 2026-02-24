import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TablesPage = () => {
  const { t } = useLanguage();

  // Placeholder grid — will be dynamic once orders are implemented
  const tables = Array.from({ length: 12 }, (_, i) => ({
    number: i + 1,
    status: i === 2 ? "occupied" : i === 5 ? "reserved" : "available",
    total: i === 2 ? 450 : 0,
  }));

  const statusColors: Record<string, string> = {
    available: "bg-emerald-100 text-emerald-800 border-emerald-200",
    occupied: "bg-amber-100 text-amber-800 border-amber-200",
    reserved: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("tables.title")}</h1>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((table) => (
          <Card
            key={table.number}
            className="cursor-pointer hover:shadow-md transition-shadow"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {t("tables.title")} {table.number}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Badge className={statusColors[table.status]} variant="outline">
                {t(`tables.${table.status}` as any)}
              </Badge>
              {table.total > 0 && (
                <p className="mt-2 text-sm font-medium">${table.total.toFixed(2)} MXN</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TablesPage;
