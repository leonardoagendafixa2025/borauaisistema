import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Sparkles, ArrowRight, Receipt, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import confetti from "canvas-confetti";

export default function BillingSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { restaurantId } = useAuth();
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    // Confete de comemoração
    const duration = 1500;
    const end = Date.now() + duration;
    const colors = ["#FF5757", "#FFD166", "#06D6A0", "#118AB2"];
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 65, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 65, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    const env = getStripeEnvironment();
    // Tenta resolver o nome do plano via tabela subscriptions
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan_id, subscription_plans(name)")
        .eq("restaurant_id", restaurantId)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const name = (data as any)?.subscription_plans?.name;
      if (name) setPlanName(name);
    })();
  }, [restaurantId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-background to-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-2xl border-2 border-primary/20">
        <CardContent className="p-8 md:p-12 text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-primary" strokeWidth={2.5} />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Assinatura confirmada
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Obrigado pela sua assinatura! 🎉
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-md mx-auto">
              {planName ? (
                <>Seu plano <strong className="text-foreground">{planName}</strong> já está ativo no Bora Uai.</>
              ) : (
                <>Seu plano já está ativo no Bora Uai e todas as funcionalidades foram liberadas.</>
              )}
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 pt-4 text-left">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl mb-1">⚡</div>
              <div className="font-semibold text-sm">Acesso liberado</div>
              <div className="text-xs text-muted-foreground">Todos os recursos do seu plano</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl mb-1">📧</div>
              <div className="font-semibold text-sm">Recibo no e-mail</div>
              <div className="text-xs text-muted-foreground">Comprovante enviado pelo Stripe</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl mb-1">🔁</div>
              <div className="font-semibold text-sm">Renovação automática</div>
              <div className="text-xs text-muted-foreground">Cancele quando quiser</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
            <Button asChild size="lg" className="gap-2">
              <Link to="/restaurant">
                <LayoutDashboard className="w-4 h-4" />
                Ir para o painel
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link to="/restaurant/billing">
                <Receipt className="w-4 h-4" />
                Ver minha assinatura
              </Link>
            </Button>
          </div>

          {sessionId && (
            <p className="text-[10px] text-muted-foreground/60 pt-4 font-mono">
              ID da transação: {sessionId.slice(0, 24)}…
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
