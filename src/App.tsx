import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
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

const queryClient = new QueryClient();

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
                <Route path="/cost-calculator" element={<CostCalculatorPage />} />
                <Route path="/menu-generator" element={<MenuGeneratorPage />} />
                <Route path="/kitchen" element={<KitchenPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/performance" element={<PerformancePage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/loyalty-admin" element={<LoyaltyAdminPage />} />
                <Route path="/loyalty-scan" element={<LoyaltyScanPage />} />
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
