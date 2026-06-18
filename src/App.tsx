import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BackofficeRoute } from "@/components/BackofficeRoute";
import { AppLayout } from "@/components/AppLayout";
import { FeatureGate } from "@/components/FeatureGate";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import TablesPage from "@/pages/TablesPage";
import MenuPage from "@/pages/MenuPage";
import CostCalculatorPage from "@/pages/CostCalculatorPage";
import MenuGeneratorPage from "@/pages/MenuGeneratorPage";
import BillingPage from "@/pages/BillingPage";
import KitchenPage from "@/pages/KitchenPage";
import UsersPage from "@/pages/UsersPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import PublicMenuPage from "@/pages/PublicMenuPage";
import PerformancePage from "@/pages/PerformancePage";
import LoyaltyPublicPage from "@/pages/LoyaltyPublicPage";
import LoyaltyLoginPage from "@/pages/LoyaltyLoginPage";
import LoyaltyMemberPage from "@/pages/LoyaltyMemberPage";
import LoyaltyAdminPage from "@/pages/LoyaltyAdminPage";
import LoyaltyScanPage from "@/pages/LoyaltyScanPage";
import OrderHistoryPage from "@/pages/OrderHistoryPage";
import StockPage from "@/pages/StockPage";
import CalendarPage from "@/pages/CalendarPage";
import TicketsPage from "@/pages/TicketsPage";
import WifiPage from "@/pages/WifiPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import BudgetPage from "@/pages/BudgetPage";
import CheckInPage from "@/pages/CheckInPage";
import TimeClockPage from "@/pages/TimeClockPage";
import BackofficeLayout from "@/pages/backoffice/BackofficeLayout";
import BusinessEntry from "@/pages/BusinessEntry";
import BusinessesPage from "@/pages/backoffice/BusinessesPage";
import BusinessDetailPage from "@/pages/backoffice/BusinessDetailPage";
import SuperAdminsPage from "@/pages/backoffice/SuperAdminsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
      refetchOnMount: true,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/b/:slug" element={<BusinessEntry />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tables" element={<TablesPage />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/cost-calculator" element={<FeatureGate feature="cost_calculator"><CostCalculatorPage /></FeatureGate>} />
                <Route path="/menu-generator" element={<FeatureGate feature="menu_generator"><MenuGeneratorPage /></FeatureGate>} />
                <Route path="/kitchen" element={<FeatureGate feature="kitchen"><KitchenPage /></FeatureGate>} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/performance" element={<PerformancePage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/loyalty-admin" element={<FeatureGate feature="loyalty"><LoyaltyAdminPage /></FeatureGate>} />
                <Route path="/loyalty-scan" element={<FeatureGate feature="loyalty"><LoyaltyScanPage /></FeatureGate>} />
                <Route path="/order-history" element={<OrderHistoryPage />} />
                <Route path="/stock" element={<FeatureGate feature="stock"><StockPage /></FeatureGate>} />
                <Route path="/calendar" element={<FeatureGate feature="calendar"><CalendarPage /></FeatureGate>} />
                <Route path="/tickets" element={<FeatureGate feature="tickets"><TicketsPage /></FeatureGate>} />
                <Route path="/wifi" element={<FeatureGate feature="wifi"><WifiPage /></FeatureGate>} />
                <Route path="/analytics" element={<FeatureGate feature="analytics"><AnalyticsPage /></FeatureGate>} />
                <Route path="/budget" element={<FeatureGate feature="budget"><BudgetPage /></FeatureGate>} />
              </Route>
              <Route
                path="/backoffice"
                element={
                  <BackofficeRoute>
                    <BackofficeLayout />
                  </BackofficeRoute>
                }
              >
                <Route index element={<Navigate to="businesses" replace />} />
                <Route path="businesses" element={<BusinessesPage />} />
                <Route path="businesses/:id" element={<BusinessDetailPage />} />
                <Route path="super-admins" element={<SuperAdminsPage />} />
              </Route>
              <Route path="/public-menu/:menuId" element={<PublicMenuPage />} />
              <Route path="/loyalty" element={<LoyaltyPublicPage />} />
              <Route path="/loyalty-login" element={<LoyaltyLoginPage />} />
              <Route path="/loyalty/:memberCode" element={<LoyaltyMemberPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
