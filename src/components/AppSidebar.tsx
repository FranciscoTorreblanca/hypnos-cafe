import { APP_VERSION } from "@/version";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Grid3X3,
  Receipt,
  Users,
  Settings,
  Calculator,
  FileText,
  LogOut,
  ChefHat,
  BarChart3,
  Heart,
  ScanLine,
  History,
  Package,
  CalendarDays,
  Ticket,
  Activity,
  Wallet,
  Building2,
  Fingerprint,
  Clock,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BusinessSwitcher } from "@/components/BusinessSwitcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export const AppSidebar = () => {
  const { user, isAdmin, isSuperAdmin, hasRole, hasFeature, currentBusiness, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { key: "nav.dashboard" as const, icon: LayoutDashboard, path: "/dashboard", roles: ["admin"], feature: null },
    { key: "nav.tables" as const, icon: Grid3X3, path: "/tables", roles: ["admin", "waiter", "kitchen"], feature: null },
    { key: "nav.menu" as const, icon: UtensilsCrossed, path: "/menu", roles: ["admin"], feature: null },
    { key: "nav.costCalculator" as const, icon: Calculator, path: "/cost-calculator", roles: ["admin"], feature: "cost_calculator" as const },
    { key: "nav.menuGenerator" as const, icon: FileText, path: "/menu-generator", roles: ["admin"], feature: "menu_generator" as const },
    { key: "nav.kitchen" as const, icon: ChefHat, path: "/kitchen", roles: ["admin", "waiter", "kitchen"], feature: "kitchen" as const },
    { key: "nav.billing" as const, icon: Receipt, path: "/billing", roles: ["admin", "billing"], feature: null },
    { key: "nav.tickets" as const, icon: Ticket, path: "/tickets", roles: ["admin", "billing", "waiter"], feature: "tickets" as const },
    { key: "nav.performance" as const, icon: BarChart3, path: "/performance", roles: ["admin"], feature: null },
    { key: "nav.analytics" as const, icon: Activity, path: "/analytics", roles: ["admin"], feature: "analytics" as const },
    { key: "nav.budget" as const, icon: Wallet, path: "/budget", roles: ["admin"], feature: "budget" as const },
    { key: "nav.orderHistory" as const, icon: History, path: "/order-history", roles: ["admin"], feature: null },
    { key: "nav.stock" as const, icon: Package, path: "/stock", roles: ["admin"], feature: "stock" as const },
    { key: "nav.calendar" as const, icon: CalendarDays, path: "/calendar", roles: ["admin", "waiter", "billing"], feature: "calendar" as const },
    { key: "loyalty.admin" as const, icon: Heart, path: "/loyalty-admin", roles: ["admin"], feature: "loyalty" as const },
    { key: "loyalty.scan" as const, icon: ScanLine, path: "/loyalty-scan", roles: ["admin", "waiter"], feature: "loyalty" as const },
    { key: "nav.checkIn" as const, icon: Fingerprint, path: "/check-in", roles: ["admin", "waiter", "billing", "kitchen"], feature: "time_attendance" as const },
    { key: "nav.timeClock" as const, icon: Clock, path: "/time-clock", roles: ["admin"], feature: "time_attendance" as const },
    { key: "nav.users" as const, icon: Users, path: "/users", roles: ["admin"], feature: null },
    { key: "nav.settings" as const, icon: Settings, path: "/settings", roles: ["admin"], feature: null },
  ];

  const visibleItems = navItems.filter(
    (item) =>
      (item.roles.length === 0 || isAdmin || item.roles.some((r) => hasRole(r as any))) &&
      (!item.feature || hasFeature(item.feature))
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            {(currentBusiness?.name ?? "H").charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold tracking-tight truncate">{currentBusiness?.name ?? "Hypnos Cafe"}</span>
        </div>
        <BusinessSwitcher />
        {isSuperAdmin && (
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => navigate("/backoffice")}>
            <Building2 className="h-4 w-4" />
            Backoffice
          </Button>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.menu")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    tooltip={t(item.key)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{t(item.key)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">
            {user?.email}
          </span>
          <LanguageToggle />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </Button>
        <span className="text-[10px] text-muted-foreground text-center">v{APP_VERSION}</span>
      </SidebarFooter>
    </Sidebar>
  );
};
