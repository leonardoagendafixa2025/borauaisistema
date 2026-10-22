import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PlanFeatures {
  tier: 'basic' | 'professional' | 'premium' | null;
  planName: string;
  isActive: boolean;
  isTrial: boolean;
  isBlocked: boolean;
  trialEndsAt: string | null;
  maxProducts: number;
  maxCoupons: number;
  hasQrCode: boolean;
  hasKds: boolean;
  hasMultiCashier: boolean;
  hasCrm: boolean;
  hasApi: boolean;
  hasAdvancedReports: boolean;
  hasVisualCustomization: boolean;
  hasOnlineSite: boolean;
  hasInventory: boolean;
  maxBanners: number;
  hasBannerScheduling: boolean;
  hasQuickSale: boolean;
  hasAiInsights: boolean;
  hasReservations: boolean;
  hasTelegramBot: boolean;
  loading: boolean;
}

const PLAN_LIMITS: Record<string, Partial<PlanFeatures>> = {
  basic: {
    maxProducts: 100,
    maxCoupons: 5,
    hasQrCode: false,
    hasKds: false,
    hasMultiCashier: false,
    hasCrm: false,
    hasApi: false,
    hasAdvancedReports: false,
    hasVisualCustomization: false,
    hasOnlineSite: false,
    hasInventory: false,
    maxBanners: 0,
    hasBannerScheduling: false,
    hasQuickSale: false,
    hasAiInsights: false,
    hasReservations: false,
    hasTelegramBot: false,
  },
  professional: {
    maxProducts: 999,
    maxCoupons: 20,
    hasQrCode: true,
    hasKds: true,
    hasMultiCashier: true,
    hasCrm: false,
    hasApi: false,
    hasAdvancedReports: true,
    hasVisualCustomization: true,
    hasOnlineSite: true,
    hasInventory: true,
    maxBanners: 3,
    hasBannerScheduling: false,
    hasQuickSale: true,
    hasAiInsights: false,
    hasReservations: true,
    hasTelegramBot: false,
  },
  premium: {
    maxProducts: 99999,
    maxCoupons: 999,
    hasQrCode: true,
    hasKds: true,
    hasMultiCashier: true,
    hasCrm: true,
    hasApi: true,
    hasAdvancedReports: true,
    hasVisualCustomization: true,
    hasOnlineSite: true,
    hasInventory: true,
    maxBanners: 10,
    hasBannerScheduling: true,
    hasQuickSale: true,
    hasAiInsights: true,
    hasReservations: true,
    hasTelegramBot: true,
  },
};

export function usePlanFeatures(): PlanFeatures {
  const { restaurantId } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['plan-features', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return sub;
    },
    enabled: !!restaurantId,
  });

  if (isLoading || !data) {
    const limits = PLAN_LIMITS.basic;
    return {
      tier: 'basic',
      planName: isLoading ? 'Carregando plano...' : 'Período de Testes',
      isActive: true,
      isTrial: true,
      isBlocked: false,
      trialEndsAt: null,
      maxProducts: limits.maxProducts || 100,
      maxCoupons: limits.maxCoupons || 5,
      hasQrCode: limits.hasQrCode || false,
      hasKds: limits.hasKds || false,
      hasMultiCashier: limits.hasMultiCashier || false,
      hasCrm: limits.hasCrm || false,
      hasApi: limits.hasApi || false,
      hasAdvancedReports: limits.hasAdvancedReports || false,
      hasVisualCustomization: limits.hasVisualCustomization || false,
      hasOnlineSite: limits.hasOnlineSite || false,
      hasInventory: limits.hasInventory || false,
      maxBanners: limits.maxBanners ?? 0,
      hasBannerScheduling: limits.hasBannerScheduling || false,
      hasQuickSale: limits.hasQuickSale || false,
      hasAiInsights: limits.hasAiInsights || false,
      hasReservations: limits.hasReservations || false,
      hasTelegramBot: limits.hasTelegramBot || false,
      loading: isLoading,
    };
  }

  const plan = data.subscription_plans as any;
  const tier = plan?.tier || 'basic';
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.basic;
  const status = String(data.status || '').toLowerCase();
  const isTrial = status === 'trial' || status === 'trialing';
  
  // Check if trial has expired
  const trialExpired = isTrial && data.trial_ends_at && new Date(data.trial_ends_at).getTime() < Date.now();
  
  // Check if active subscription period has expired (with a 24h grace window for recurring payment webhooks)
  const periodExpired = !isTrial && data.current_period_end && (new Date(data.current_period_end).getTime() + 86400000) < Date.now();

  const blockedStatuses = ['suspended', 'cancelled', 'canceled', 'overdue', 'past_due', 'unpaid', 'incomplete_expired'];
  const isBlocked = Boolean(trialExpired || periodExpired || blockedStatuses.includes(status));
  const isActive = !isBlocked && ['active', 'trial', 'trialing'].includes(status);

  return {
    tier,
    planName: plan?.name || 'Básico',
    isActive,
    isTrial,
    isBlocked,
    trialEndsAt: data.trial_ends_at,
    maxProducts: limits.maxProducts || 100,
    maxCoupons: limits.maxCoupons || 5,
    hasQrCode: limits.hasQrCode || false,
    hasKds: limits.hasKds || false,
    hasMultiCashier: limits.hasMultiCashier || false,
    hasCrm: limits.hasCrm || false,
    hasApi: limits.hasApi || false,
    hasAdvancedReports: limits.hasAdvancedReports || false,
    hasVisualCustomization: limits.hasVisualCustomization || false,
    hasOnlineSite: limits.hasOnlineSite || false,
    hasInventory: limits.hasInventory || false,
    maxBanners: limits.maxBanners ?? 0,
    hasBannerScheduling: limits.hasBannerScheduling || false,
    hasQuickSale: limits.hasQuickSale || false,
    hasAiInsights: limits.hasAiInsights || false,
    hasReservations: limits.hasReservations || false,
    hasTelegramBot: limits.hasTelegramBot || false,
    loading: false,
  };
}
