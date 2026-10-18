import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

interface Props {
  children: React.ReactNode;
  requireMaster?: boolean;
  requireRestaurant?: boolean;
  /** Permite acesso mesmo se a assinatura estiver bloqueada (usado pela página de cobrança). */
  allowBlocked?: boolean;
}

export default function ProtectedRoute({ children, requireMaster, requireRestaurant, allowBlocked }: Props) {
  const { user, loading, isMasterAdmin, restaurantId, roles } = useAuth();
  const plan = usePlanFeatures();
  const location = useLocation();
  const isGarcomRoute = location.pathname.startsWith('/garcom');
  const isKitchenRoute = location.pathname.startsWith('/restaurant/kitchen');

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    const loginPath = requireMaster
      ? '/master/login'
      : isGarcomRoute
        ? '/garcom/login'
        : '/restaurant/login';
    return <Navigate to={loginPath} replace />;
  }

  if (requireMaster && !isMasterAdmin) {
    return <Navigate to="/master/login" replace />;
  }

  if (requireRestaurant && !restaurantId) {
    return <Navigate to={isGarcomRoute ? '/garcom/login' : '/restaurant/login'} replace />;
  }

  // Restringe acesso ao painel: garçom (attendant) só acessa /garcom; cozinha só acessa /restaurant/kitchen
  if (requireRestaurant && !isMasterAdmin) {
    const restRole = roles.find(r => r.restaurant_id)?.role;
    if (restRole === 'attendant' && !isGarcomRoute) {
      return <Navigate to="/garcom" replace />;
    }
    if (restRole === 'kitchen' && !isKitchenRoute) {
      return <Navigate to="/restaurant/kitchen" replace />;
    }
  }

  // Bloqueio: redireciona para a página de cobrança onde o usuário pode reativar via Stripe
  if (requireRestaurant && !allowBlocked && !plan.loading && plan.isBlocked) {
    return <Navigate to="/restaurant/billing" replace />;
  }

  return <>{children}</>;
}
