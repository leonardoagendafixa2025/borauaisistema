import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import ProtectedRoute from "@/components/ProtectedRoute";
import PlanGate from "@/components/PlanGate";
import Index from "./pages/Index";
import SalesPage from "./pages/SalesPage";
import SalesPlaybook from "./pages/SalesPlaybook";
import NotFound from "./pages/NotFound";
import MasterLogin from "./pages/master/MasterLogin";
import MasterDashboard from "./pages/master/MasterDashboard";
import RestaurantList from "./pages/master/RestaurantList";
import FinancialPage from "./pages/master/FinancialPage";
import SubscriptionsPage from "./pages/master/SubscriptionsPage";
import UsersPage from "./pages/master/UsersPage";
import SettingsPage from "./pages/master/SettingsPage";
import ReportsPage from "./pages/master/ReportsPage";
import IntegrationsPage from "./pages/master/IntegrationsPage";
import AuditLogsPage from "./pages/master/AuditLogsPage";
import HealthPage from "./pages/master/HealthPage";
import CommunicationsPage from "./pages/master/CommunicationsPage";
import OverduePage from "./pages/master/OverduePage";
import PlansPage from "./pages/master/PlansPage";
import PlatformCouponsPage from "./pages/master/PlatformCouponsPage";
import FeatureFlagsPage from "./pages/master/FeatureFlagsPage";
import PushNotificationsPage from "./pages/master/PushNotificationsPage";
import SaasMetricsPage from "./pages/master/SaasMetricsPage";
import ImpersonationLogPage from "./pages/master/ImpersonationLogPage";
import MessageTemplatesPage from "./pages/master/MessageTemplatesPage";
import OnboardingHealthPage from "./pages/master/OnboardingHealthPage";
import RestaurantLogin from "./pages/restaurant/RestaurantLogin";
import RestaurantDashboard from "./pages/restaurant/RestaurantDashboard";
import OrdersPage from "./pages/restaurant/OrdersPage";
import OperationsHub from "./pages/restaurant/OperationsHub";
import MenuManagement from "./pages/restaurant/MenuManagement";
import RestaurantSettingsPage from "./pages/restaurant/RestaurantSettingsPage";
import TeamPage from "./pages/restaurant/TeamPage";
import CustomersPage from "./pages/restaurant/CustomersPage";
import CouponsPage from "./pages/restaurant/CouponsPage";
import RestaurantReportsPage from "./pages/restaurant/RestaurantReportsPage";
import PublicMenu from "./pages/public/PublicMenu";
import DineInMenu from "./pages/public/DineInMenu";
import TableBill from "./pages/public/TableBill";
import TablesPage from "./pages/restaurant/TablesPage";
import WaiterCallsPage from "./pages/restaurant/WaiterCallsPage";
import KitchenDisplay from "./pages/restaurant/KitchenDisplay";
import CashierPage from "./pages/restaurant/CashierPage";
import DeliveryDriversPage from "./pages/restaurant/DeliveryDriversPage";
import InventoryPage from "./pages/restaurant/InventoryPage";
import GarcomApp from "./pages/restaurant/GarcomApp";
import GarcomMySales from "./pages/restaurant/GarcomMySales";
import GarcomLogin from "./pages/restaurant/GarcomLogin";
import BaladaApp from "./pages/restaurant/BaladaApp";
import WristbandsPage from "./pages/restaurant/WristbandsPage";
import BarPanelPage from "./pages/restaurant/BarPanelPage";
import BaladaLivePage from "./pages/restaurant/BaladaLivePage";
import NightlifeManagerPage from "./pages/restaurant/NightlifeManagerPage";
import DjPanelPage from "./pages/restaurant/DjPanelPage";
import NightlifeHub from "./pages/restaurant/NightlifeHub";
import NightlifeBoard from "./pages/public/NightlifeBoard";
import DemoBalada from "./pages/public/DemoBalada";
import ExpensesPage from "./pages/restaurant/ExpensesPage";
import ReservationsPage from "./pages/restaurant/ReservationsPage";
import FeedbackPage from "./pages/restaurant/FeedbackPage";
import AIInsightsPage from "./pages/restaurant/AIInsightsPage";
import ScalePage from "./pages/restaurant/ScalePage";
import BannersPage from "./pages/restaurant/BannersPage";
import BillingPage from "./pages/restaurant/BillingPage";
import BillingSuccessPage from "./pages/restaurant/BillingSuccessPage";
import FinanceHub from "./pages/restaurant/FinanceHub";
import OrderTracking from "./pages/public/OrderTracking";
import RegisterRestaurant from "./pages/public/RegisterRestaurant";
import OrderHistory from "./pages/public/OrderHistory";
import PublicReservation from "./pages/public/PublicReservation";
import PublicSurvey from "./pages/public/PublicSurvey";
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerAccount from "./pages/customer/CustomerAccount";
import CustomerResetPassword from "./pages/customer/CustomerResetPassword";
import LegalPage from "./pages/public/LegalPage";
import DriverLogin from "./pages/driver/DriverLogin";
import DriverApp from "./pages/driver/DriverApp";
import PricingPage from "./pages/public/PricingPage";
import HelpCenter from "./pages/public/HelpCenter";
import StatusPage from "./pages/public/StatusPage";
import ReferralProgramPage from "./pages/restaurant/ReferralProgramPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/vendas" element={<SalesPage />} />
            <Route path="/vendedor" element={<SalesPlaybook />} />

            {/* Driver PWA (no auth, login by PIN) */}
            <Route path="/entregador" element={<DriverLogin />} />
            <Route path="/entregador/app" element={<DriverApp />} />

            {/* Master Admin */}
            <Route path="/master/login" element={<MasterLogin />} />
            <Route path="/master" element={<ProtectedRoute requireMaster><MasterDashboard /></ProtectedRoute>} />
            <Route path="/master/restaurants" element={<ProtectedRoute requireMaster><RestaurantList /></ProtectedRoute>} />
            <Route path="/master/financial" element={<ProtectedRoute requireMaster><FinancialPage /></ProtectedRoute>} />
            <Route path="/master/subscriptions" element={<ProtectedRoute requireMaster><SubscriptionsPage /></ProtectedRoute>} />
            <Route path="/master/users" element={<ProtectedRoute requireMaster><UsersPage /></ProtectedRoute>} />
            <Route path="/master/settings" element={<ProtectedRoute requireMaster><SettingsPage /></ProtectedRoute>} />
            <Route path="/master/reports" element={<ProtectedRoute requireMaster><ReportsPage /></ProtectedRoute>} />
            <Route path="/master/integracoes" element={<ProtectedRoute requireMaster><IntegrationsPage /></ProtectedRoute>} />
            <Route path="/master/auditoria" element={<ProtectedRoute requireMaster><AuditLogsPage /></ProtectedRoute>} />
            <Route path="/master/saude" element={<ProtectedRoute requireMaster><HealthPage /></ProtectedRoute>} />
            <Route path="/master/comunicados" element={<ProtectedRoute requireMaster><CommunicationsPage /></ProtectedRoute>} />
            <Route path="/master/inadimplencia" element={<ProtectedRoute requireMaster><OverduePage /></ProtectedRoute>} />
            <Route path="/master/planos" element={<ProtectedRoute requireMaster><PlansPage /></ProtectedRoute>} />
            <Route path="/master/cupons" element={<ProtectedRoute requireMaster><PlatformCouponsPage /></ProtectedRoute>} />
            <Route path="/master/push" element={<ProtectedRoute requireMaster><PushNotificationsPage /></ProtectedRoute>} />
            <Route path="/master/feature-flags" element={<ProtectedRoute requireMaster><PushNotificationsPage /></ProtectedRoute>} />
            <Route path="/master/metricas" element={<ProtectedRoute requireMaster><SaasMetricsPage /></ProtectedRoute>} />
            <Route path="/master/onboarding" element={<ProtectedRoute requireMaster><OnboardingHealthPage /></ProtectedRoute>} />
            <Route path="/master/impersonations" element={<ProtectedRoute requireMaster><ImpersonationLogPage /></ProtectedRoute>} />
            <Route path="/master/templates" element={<ProtectedRoute requireMaster><MessageTemplatesPage /></ProtectedRoute>} />

            {/* Restaurant Admin */}
            <Route path="/restaurant/login" element={<RestaurantLogin />} />
            <Route path="/restaurant" element={<ProtectedRoute requireRestaurant><RestaurantDashboard /></ProtectedRoute>} />
            <Route path="/restaurant/orders" element={<ProtectedRoute requireRestaurant><OrdersPage /></ProtectedRoute>} />
            <Route path="/restaurant/ops" element={<ProtectedRoute requireRestaurant><OperationsHub /></ProtectedRoute>} />
            <Route path="/restaurant/menu" element={<ProtectedRoute requireRestaurant><MenuManagement /></ProtectedRoute>} />
            <Route path="/restaurant/tables" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasQrCode"><TablesPage /></PlanGate></ProtectedRoute>} />
            <Route path="/restaurant/waiter-calls" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasQrCode"><WaiterCallsPage /></PlanGate></ProtectedRoute>} />
            <Route path="/restaurant/kitchen" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasKds"><KitchenDisplay /></PlanGate></ProtectedRoute>} />
            <Route path="/restaurant/cashier" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasMultiCashier"><CashierPage /></PlanGate></ProtectedRoute>} />
            <Route path="/restaurant/deliveries" element={<ProtectedRoute requireRestaurant><DeliveryDriversPage /></ProtectedRoute>} />
            <Route path="/restaurant/inventory" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasInventory"><InventoryPage /></PlanGate></ProtectedRoute>} />
            <Route path="/restaurant/settings" element={<ProtectedRoute requireRestaurant><RestaurantSettingsPage /></ProtectedRoute>} />
            <Route path="/restaurant/team" element={<ProtectedRoute requireRestaurant><TeamPage /></ProtectedRoute>} />
            <Route path="/restaurant/customers" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasCrm"><CustomersPage /></PlanGate></ProtectedRoute>} />
            <Route path="/restaurant/coupons" element={<ProtectedRoute requireRestaurant><CouponsPage /></ProtectedRoute>} />
            <Route path="/restaurant/reports" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasAdvancedReports"><RestaurantReportsPage /></PlanGate></ProtectedRoute>} />

            <Route path="/restaurant/expenses" element={<ProtectedRoute requireRestaurant><ExpensesPage /></ProtectedRoute>} />
            <Route path="/restaurant/finance" element={<ProtectedRoute requireRestaurant><FinanceHub /></ProtectedRoute>} />
            <Route path="/restaurant/reservations" element={<ProtectedRoute requireRestaurant><ReservationsPage /></ProtectedRoute>} />
            <Route path="/restaurant/feedback" element={<ProtectedRoute requireRestaurant><FeedbackPage /></ProtectedRoute>} />
            <Route path="/restaurant/ai-insights" element={<ProtectedRoute requireRestaurant><AIInsightsPage /></ProtectedRoute>} />
            <Route path="/restaurant/scale" element={<ProtectedRoute requireRestaurant><ScalePage /></ProtectedRoute>} />
            <Route path="/restaurant/banners" element={<ProtectedRoute requireRestaurant><BannersPage /></ProtectedRoute>} />
            <Route path="/restaurant/billing" element={<ProtectedRoute requireRestaurant allowBlocked><BillingPage /></ProtectedRoute>} />
            <Route path="/restaurant/billing/sucesso" element={<ProtectedRoute requireRestaurant allowBlocked><BillingSuccessPage /></ProtectedRoute>} />
            <Route path="/restaurant/indique" element={<ProtectedRoute requireRestaurant><ReferralProgramPage /></ProtectedRoute>} />

            {/* Garçom PWA */}
            <Route path="/garcom/login" element={<GarcomLogin />} />
            <Route path="/garcom" element={<ProtectedRoute requireRestaurant><GarcomApp /></ProtectedRoute>} />
            <Route path="/garcom/minhas-vendas" element={<ProtectedRoute requireRestaurant><GarcomMySales /></ProtectedRoute>} />
            <Route path="/garcom/balada" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasQuickSale"><BaladaApp /></PlanGate></ProtectedRoute>} />
            <Route path="/garcom/bar" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasQuickSale"><BarPanelPage /></PlanGate></ProtectedRoute>} />
            <Route path="/restaurant/balada/pulseiras" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasQuickSale"><WristbandsPage /></PlanGate></ProtectedRoute>} />

            {/* Modo Balada — painel ao vivo */}
            <Route path="/restaurant/balada-hub" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasQuickSale"><NightlifeHub /></PlanGate></ProtectedRoute>} />
            <Route path="/restaurant/balada" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasQuickSale"><BaladaLivePage /></PlanGate></ProtectedRoute>} />
            <Route path="/restaurant/programacao" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasQuickSale"><NightlifeManagerPage /></PlanGate></ProtectedRoute>} />
            <Route path="/restaurant/dj" element={<ProtectedRoute requireRestaurant><PlanGate feature="hasQuickSale"><DjPanelPage /></PlanGate></ProtectedRoute>} />

            {/* Public */}
            <Route path="/cadastro" element={<RegisterRestaurant />} />
            <Route path="/meus-pedidos" element={<OrderHistory />} />
            <Route path="/pedido/:orderId" element={<OrderTracking />} />
            <Route path="/:slug/reservar" element={<PublicReservation />} />
            <Route path="/:slug/avaliar" element={<PublicSurvey />} />
            <Route path="/legal/:doc" element={<LegalPage />} />
            <Route path="/precos" element={<PricingPage />} />
            <Route path="/ajuda" element={<HelpCenter />} />
            <Route path="/status" element={<StatusPage />} />

            {/* Customer */}
            <Route path="/cliente/login" element={<CustomerLogin />} />
            <Route path="/cliente/reset-password" element={<CustomerResetPassword />} />
            <Route path="/cliente" element={<CustomerAccount />} />

            <Route path="/demo/balada" element={<DemoBalada />} />

            <Route path="/:slug/mesa/:tableNumber/conta" element={<TableBill />} />
            <Route path="/:slug/mesa/:tableNumber" element={<DineInMenu />} />
            <Route path="/:slug/balada" element={<NightlifeBoard />} />
            <Route path="/:slug" element={<PublicMenu />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
