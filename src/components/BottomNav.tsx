import { APP_VERSION } from "@/version";
import { Grid3X3, ChefHat, Menu } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Calculator,
  FileText,
  Receipt,
  Users,
  Settings,
  LogOut,
  BarChart3,
  Heart,
  ScanLine,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";

export const BottomNav = () => {
  const { t } = useLanguage();
  const { isAdmin, hasRole, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const showTables = isAdmin || hasRole("waiter") || hasRole("kitchen");
  const showKitchen = isAdmin || hasRole("waiter") || hasRole("kitchen");

  const moreItems = [
    { key: "nav.dashboard" as const, icon: LayoutDashboard, path: "/dashboard", roles: ["admin"] },
    { key: "nav.tables" as const, icon: Grid3X3, path: "/tables", roles: ["admin", "waiter", "kitchen"] },
    { key: "nav.menu" as const, icon: UtensilsCrossed, path: "/menu", roles: ["admin"] },
    { key: "nav.costCalculator" as const, icon: Calculator, path: "/cost-calculator", roles: ["admin"] },
    { key: "nav.menuGenerator" as const, icon: FileText, path: "/menu-generator", roles: ["admin"] },
    { key: "nav.kitchen" as const, icon: ChefHat, path: "/kitchen", roles: ["admin", "waiter", "kitchen"] },
    { key: "nav.billing" as const, icon: Receipt, path: "/billing", roles: ["admin", "billing"] },
    { key: "nav.performance" as const, icon: BarChart3, path: "/performance", roles: ["admin"] },
    { key: "nav.orderHistory" as const, icon: History, path: "/order-history", roles: ["admin"] },
    { key: "loyalty.admin" as const, icon: Heart, path: "/loyalty-admin", roles: ["admin"] },
    { key: "loyalty.scan" as const, icon: ScanLine, path: "/loyalty-scan", roles: ["admin", "waiter"] },
    { key: "nav.users" as const, icon: Users, path: "/users", roles: ["admin"] },
    { key: "nav.settings" as const, icon: Settings, path: "/settings", roles: ["admin"] },
  ];

  const visibleMore = moreItems.filter(
    (item) => item.roles.length === 0 || isAdmin || item.roles.some((r) => hasRole(r as any))
  );

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur h-16 pb-[env(safe-area-inset-bottom)]">
        {showTables && (
          <button
            onClick={() => navigate("/tables")}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors ${
              isActive("/tables") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Grid3X3 className="h-5 w-5" />
            <span>{t("nav.tables")}</span>
          </button>
        )}
        {showKitchen && (
          <button
            onClick={() => navigate("/kitchen")}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors ${
              isActive("/kitchen") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <ChefHat className="h-5 w-5" />
            <span>{t("nav.kitchen")}</span>
          </button>
        )}
        {visibleMore.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors ${
              moreOpen ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Menu className="h-5 w-5" />
            <span>{t("common.more")}</span>
          </button>
        )}
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)] max-h-[70dvh] flex flex-col">
          <SheetHeader className="pb-2 shrink-0">
            <SheetTitle className="text-base">Hypnos Cafe</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 py-2 overflow-y-auto min-h-0">
            {visibleMore.map((item) => (
              <SheetClose asChild key={item.path}>
                <Button
                  variant={isActive(item.path) ? "secondary" : "ghost"}
                  className="w-full justify-start gap-3 h-11"
                  onClick={() => navigate(item.path)}
                >
                  <item.icon className="h-4 w-4" />
                  {t(item.key)}
                </Button>
              </SheetClose>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3 mt-2">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                {user?.email}
              </span>
              <span className="text-[10px] text-muted-foreground">v{APP_VERSION}</span>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
