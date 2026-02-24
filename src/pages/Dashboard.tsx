import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid3X3, UtensilsCrossed, Receipt, Users } from "lucide-react";

const Dashboard = () => {
  const { user, roles } = useAuth();
  const { t } = useLanguage();

  const stats = [
    { key: "nav.tables", icon: Grid3X3, value: "12", color: "text-emerald-600" },
    { key: "nav.menu", icon: UtensilsCrossed, value: "0", color: "text-amber-600" },
    { key: "nav.orders", icon: Receipt, value: "0", color: "text-blue-600" },
    { key: "nav.users", icon: Users, value: "1", color: "text-violet-600" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("dashboard.welcome")}, {user?.user_metadata?.full_name || user?.email}
        </h1>
        <p className="text-muted-foreground mt-1">
          {roles.map((r) => t(`role.${r}` as any)).join(", ") || "—"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(stat.key)}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
