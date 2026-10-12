import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import ProtectedRoute from "@/components/ProtectedRoute";
import PlanGate from "@/components/PlanGate";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";
import { PageLoader } from "@/components/PageLoader";

// Direct imports for instant initial paint
import Index from "./pages/Index";
import PublicMenu from "./pages/public/PublicMenu";
import DineInMenu from "./pages/public/DineInMenu";
import NotFound from "./pages/NotFound";
import ResetPasswordPage from "./pages/public/ResetPasswordPage";

// Code-split chunks: Master Admin
const MasterLogin = lazy(() => import("./pages/master/MasterLogin"));
const MasterDashboard = lazy(() => import("./pages/master/MasterDashboard"));
const RestaurantList = lazy(() => import("./pages/master/RestaurantList"));
const FinancialPage = lazy(() => import("./pages/master/FinancialPage"));
const SubscriptionsPage = lazy(() => import("./pages/master/SubscriptionsPage"));
const UsersPage = lazy(() => import("./pages/master/UsersPage"));
const SettingsPage = lazy(() => import("./pages/master/SettingsPage"));
const ReportsPage = lazy(() => import("./pages/master/ReportsPage"));
const IntegrationsPage = lazy(() => import("./pages/master/IntegrationsPage"));
const AuditLogsPage = lazy(() => import("./pages/master/AuditLogsPage"));
const HealthPage = lazy(() => import("./pages/master/HealthPage"));
const CommunicationsPage = lazy(() => import("./pages/master/CommunicationsPage"));
const OverduePage = lazy(() => import("./pages/master/OverduePage"));
const PlansPage = lazy(() => import("./pages/master/PlansPage"));
const PlatformCouponsPage = lazy(() => import("./pages/master/PlatformCouponsPage"));
const FeatureFlagsPage = lazy(() => import("./pages/master/FeatureFlagsPage"));
const PushNotificationsPage = lazy(() => import("./pages/master/PushNotificationsPage"));
const SaasMetricsPage = lazy(() => import("./pages/master/SaasMetricsPage"));
const ImpersonationLogPage = lazy(() => import("./pages/master/ImpersonationLogPage"));
const MessageTemplatesPage = lazy(() => import("./pages/master/MessageTemplatesPage"));
const OnboardingHealthPage = lazy(() => import("./pages/master/OnboardingHealthPage"));

// Code-split chunks: Restaurant Admin
const RestaurantLogin = lazy(() => import("./pages/restaurant/RestaurantLogin"));
const RestaurantDashboard = lazy(() => import("./pages/restaurant/RestaurantDashboard"));
const OrdersPage = lazy(() => import("./pages/restaurant/OrdersPage"));
const OperationsHub = lazy(() => import("./pages/restaurant/OperationsHub"));
const MenuManagement = lazy(() => import("./pages/restaurant/MenuManagement"));
const RestaurantSettingsPage = lazy(() => import("./pages/restaurant/RestaurantSettingsPage"));
const TeamPage = lazy(() => import("./pages/restaurant/TeamPage"));
const CustomersPage = lazy(() => import("./pages/restaurant/CustomersPage"));
const CouponsPage = lazy(() => import("./pages/restaurant/CouponsPage"));
const RestaurantReportsPage = lazy(() => import("./pages/restaurant/RestaurantReportsPage"));
const TablesPage = lazy(() => import("./pages/restaurant/TablesPage"));
const WaiterCallsPage = lazy(() => import("./pages/restaurant/WaiterCallsPage"));
const KitchenDisplay = lazy(() => import("./pages/restaurant/KitchenDisplay"));
const CashierPage = lazy(() => import("./pages/restaurant/CashierPage"));
const DeliveryDriversPage = lazy(() => import("./pages/restaurant/DeliveryDriversPage"));
const InventoryPage = lazy(() => import("./pages/restaurant/InventoryPage"));
const ExpensesPage = lazy(() => import("./pages/restaurant/ExpensesPage"));
const FinanceHub = lazy(() => import("./pages/restaurant/FinanceHub"));
const ReservationsPage = lazy(() => import("./pages/restaurant/ReservationsPage"));
const FeedbackPage = lazy(() => import("./pages/restaurant/FeedbackPage"));
const AIInsightsPage = lazy(() => import("./pages/restaurant/AIInsightsPage"));
const ScalePage = lazy(() => import("./pages/restaurant/ScalePage"));
const BannersPage = lazy(() => import("./pages/restaurant/BannersPage"));
const BillingPage = lazy(() => import("./pages/restaurant/BillingPage"));
const BillingSuccessPage = lazy(() => import("./pages/restaurant/BillingSuccessPage"));
const ReferralProgramPage = lazy(() => import("./pages/restaurant/ReferralProgramPage"));

// Code-split chunks: Garçom PWA
const GarcomLogin = lazy(() => import("./pages/restaurant/GarcomLogin"));
const GarcomApp = lazy(() => import("./pages/restaurant/GarcomApp"));
const GarcomMySales = lazy(() => import("./pages/restaurant/GarcomMySales"));

// Code-split chunks: Modo Balada
const BaladaApp = lazy(() => import("./pages/restaurant/BaladaApp"));
const WristbandsPage = lazy(() => import("./pages/restaurant/WristbandsPage"));
const BarPanelPage = lazy(() => import("./pages/restaurant/BarPanelPage"));
const BaladaLivePage = lazy(() => import("./pages/restaurant/BaladaLivePage"));
const NightlifeManagerPage = lazy(() => import("./pages/restaurant/NightlifeManagerPage"));
const DjPanelPage = lazy(() => import("./pages/restaurant/DjPanelPage"));
const NightlifeHub = lazy(() => import("./pages/restaurant/NightlifeHub"));
const NightlifeBoard = lazy(() => import("./pages/public/NightlifeBoard"));
const DemoBalada = lazy(() => import("./pages/public/DemoBalada"));

// Code-split chunks: Entregador PWA
const DriverLogin = lazy(() => import("./pages/driver/DriverLogin"));
const DriverApp = lazy(() => import("./pages/driver/DriverApp"));

// Code-split chunks: Public & Client
const SalesPage = lazy(() => import("./pages/SalesPage"));
const SalesPlaybook = lazy(() => import("./pages/SalesPlaybook"));
const TableBill = lazy(() => import("./pages/public/TableBill"));
const OrderTracking = lazy(() => import("./pages/public/OrderTracking"));
const RegisterRestaurant = lazy(() => import("./pages/public/RegisterRestaurant"));
const OrderHistory = lazy(() => import("./pages/public/OrderHistory"));
const PublicReservation = lazy(() => import("./pages/public/PublicReservation"));
const PublicSurvey = lazy(() => import("./pages/public/PublicSurvey"));
const CustomerLogin = lazy(() => import("./pages/customer/CustomerLogin"));
const CustomerAccount = lazy(() => import("./pages/customer/CustomerAccount"));
const LegalPage = lazy(() => import("./pages/public/LegalPage"));
const PricingPage = lazy(() => import("./pages/public/PricingPage"));
const HelpCenter = lazy(() => import("./pages/public/HelpCenter"));
const StatusPage = lazy(() => import("./pages/public/StatusPage"));

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
            <PushNotificationPrompt />
            <Suspense fallback={<PageLoader />}>
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
                <Route path="/master/feature-flags" element={<ProtectedRoute requireMaster><FeatureFlagsPage /></ProtectedRoute>} />
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
                <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

                {/* Customer */}
                <Route path="/cliente/login" element={<CustomerLogin />} />
                <Route path="/cliente/reset-password" element={<ResetPasswordPage />} />
                <Route path="/cliente" element={<CustomerAccount />} />

                <Route path="/demo/balada" element={<DemoBalada />} />

                <Route path="/:slug/mesa/:tableNumber/conta" element={<TableBill />} />
                <Route path="/:slug/mesa/:tableNumber" element={<DineInMenu />} />
                <Route path="/:slug/balada" element={<NightlifeBoard />} />
                <Route path="/:slug" element={<PublicMenu />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
