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
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
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
  const { user, isAdmin, hasRole, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { key: "nav.dashboard" as const, icon: LayoutDashboard, path: "/dashboard", roles: ["admin"] },
    { key: "nav.tables" as const, icon: Grid3X3, path: "/tables", roles: ["admin", "waiter", "kitchen"] },
    { key: "nav.menu" as const, icon: UtensilsCrossed, path: "/menu", roles: ["admin"] },
    { key: "nav.costCalculator" as const, icon: Calculator, path: "/cost-calculator", roles: ["admin"] },
    { key: "nav.menuGenerator" as const, icon: FileText, path: "/menu-generator", roles: ["admin"] },
    { key: "nav.kitchen" as const, icon: ChefHat, path: "/kitchen", roles: ["admin", "waiter", "kitchen"] },
    { key: "nav.billing" as const, icon: Receipt, path: "/billing", roles: ["admin", "billing"] },
    { key: "nav.tickets" as const, icon: Ticket, path: "/tickets", roles: ["admin", "billing", "waiter"] },
    { key: "nav.performance" as const, icon: BarChart3, path: "/performance", roles: ["admin"] },
    { key: "nav.analytics" as const, icon: Activity, path: "/analytics", roles: ["admin"] },
    { key: "nav.budget" as const, icon: Wallet, path: "/budget", roles: ["admin"] },
    { key: "nav.orderHistory" as const, icon: History, path: "/order-history", roles: ["admin"] },
    { key: "nav.stock" as const, icon: Package, path: "/stock", roles: ["admin"] },
    { key: "nav.calendar" as const, icon: CalendarDays, path: "/calendar", roles: ["admin", "waiter", "billing"] },
    { key: "loyalty.admin" as const, icon: Heart, path: "/loyalty-admin", roles: ["admin"] },
    { key: "loyalty.scan" as const, icon: ScanLine, path: "/loyalty-scan", roles: ["admin", "waiter"] },
    { key: "nav.users" as const, icon: Users, path: "/users", roles: ["admin"] },
    { key: "nav.settings" as const, icon: Settings, path: "/settings", roles: ["admin"] },
  ];

  const visibleItems = navItems.filter(
    (item) => item.roles.length === 0 || isAdmin || item.roles.some((r) => hasRole(r as any))
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            H
          </div>
          <span className="text-lg font-semibold tracking-tight">Hypnos Cafe</span>
        </div>
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
