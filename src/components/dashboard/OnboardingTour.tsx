import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, ChevronRight, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    key: 'menu',
    title: '1. Cadastre seus produtos',
    desc: 'Comece criando categorias e produtos. Adicione fotos pra vender mais.',
    cta: 'Ir para Cardápio',
    href: '/restaurant/menu',
  },
  {
    key: 'tables',
    title: '2. Gere os QR Codes das mesas',
    desc: 'Crie suas mesas e imprima os QR Codes. O cliente escaneia e pede direto.',
    cta: 'Ir para Mesas',
    href: '/restaurant/tables',
  },
  {
    key: 'settings',
    title: '3. Configure seu estabelecimento',
    desc: 'Logo, banner, horários de funcionamento, formas de pagamento, taxa de entrega.',
    cta: 'Ir para Configurações',
    href: '/restaurant/settings',
  },
  {
    key: 'telegram',
    title: '4. Conecte o Telegram',
    desc: 'Receba pedidos e alertas no seu celular. Aprovação de pedidos em 1 toque.',
    cta: 'Ver no Dashboard',
    href: '/restaurant',
  },
  {
    key: 'share',
    title: '5. Divulgue seu link',
    desc: 'Seu cardápio público está em borauai.com/seu-bar. Compartilhe no Insta!',
    cta: 'Concluir tour',
    href: '/restaurant',
  },
];

export default function OnboardingTour() {
  const { user, restaurantId } = useAuth() as any;
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [open, setOpen] = useState(false);

  const { data: progress } = useQuery({
    queryKey: ['onboarding-progress', user?.id],
    enabled: !!user?.id && !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('onboarding_progress' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return data as any;
    },
  });

  useEffect(() => {
    if (!user?.id || !restaurantId) return;
    if (progress === undefined) return;
    if (!progress) {
      // primeiro acesso — abre tour
      setOpen(true);
    } else if (!progress.tour_completed && !progress.dismissed_at) {
      setOpen(true);
      setCurrentStep((progress.steps_done || []).length);
    }
  }, [progress, user?.id, restaurantId]);

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await (supabase.from('onboarding_progress' as any).upsert({
        user_id: user.id,
        restaurant_id: restaurantId,
        ...payload,
      } as any, { onConflict: 'user_id' }));
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] }),
  });

  const completeStep = () => {
    const stepKey = STEPS[currentStep].key;
    const stepsDone = Array.from(new Set([...(progress?.steps_done || []), stepKey]));
    if (currentStep === STEPS.length - 1) {
      upsert.mutate({ tour_completed: true, steps_done: stepsDone });
      setOpen(false);
    } else {
      upsert.mutate({ steps_done: stepsDone });
      setCurrentStep(currentStep + 1);
    }
  };

  const dismiss = () => {
    upsert.mutate({ dismissed_at: new Date().toISOString() });
    setOpen(false);
  };

  if (!open) return null;

  const step = STEPS[currentStep];
  const progressPct = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-md">
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF5757] to-[#FF8A65] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">Passo {currentStep + 1} de {STEPS.length}</span>
        </div>
        <Progress value={progressPct} className="h-1.5 mb-4" />
        <DialogTitle className="font-heading text-2xl">{step.title}</DialogTitle>
        <DialogDescription className="text-base text-foreground/80">{step.desc}</DialogDescription>

        <div className="mt-4 space-y-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`flex items-center gap-2 text-sm ${i < currentStep ? 'text-emerald-600' : i === currentStep ? 'font-semibold' : 'text-muted-foreground'}`}>
              {i < currentStep ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {s.title}
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={dismiss} className="flex-1">Pular tour</Button>
          {step.href !== '/restaurant' || currentStep === STEPS.length - 1 ? (
            <Button asChild className="flex-1 bg-[#FF5757] hover:bg-[#FF5757]/90" onClick={completeStep}>
              <Link to={step.href}>{step.cta}</Link>
            </Button>
          ) : (
            <Button onClick={completeStep} className="flex-1 bg-[#FF5757] hover:bg-[#FF5757]/90">
              {step.cta}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
