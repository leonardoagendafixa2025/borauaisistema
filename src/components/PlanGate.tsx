import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlanFeatures, type PlanFeatures } from '@/hooks/usePlanFeatures';

interface Props {
  feature: keyof PlanFeatures;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function PlanGate({ feature, children, fallback }: Props) {
  const plan = usePlanFeatures();

  if (plan.loading) return null;

  const hasFeature = plan[feature];

  if (hasFeature) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border-2 border-dashed border-border bg-muted/30">
      <Lock className="h-10 w-10 text-muted-foreground mb-3" />
      <h3 className="font-heading font-bold text-lg">Recurso não disponível</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Este recurso não está incluído no seu plano atual ({plan.planName}).
        Faça upgrade para desbloquear.
      </p>
      <Link to="/restaurant/billing" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
        Fazer upgrade
      </Link>
    </div>
  );
}
