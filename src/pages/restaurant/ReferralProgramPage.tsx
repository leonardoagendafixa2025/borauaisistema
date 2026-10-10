import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Share2, Users, DollarSign, Gift, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function ReferralProgramPage() {
  const { user, restaurantId } = useAuth() as any;
  const queryClient = useQueryClient();

  useEffect(() => { document.title = 'Programa de Indicação — Bora Uai'; }, []);

  const { data: code, isLoading } = useQuery({
    queryKey: ['my-referral-code', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('referral_codes' as any)
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: conversions = [] } = useQuery({
    queryKey: ['referral-conversions', code?.id],
    enabled: !!code?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('referral_conversions' as any)
        .select('*, referred_restaurant:restaurants!referred_restaurant_id(name)')
        .eq('referral_code_id', code.id)
        .order('created_at', { ascending: false });
      return (data as any[]) || [];
    },
  });

  const generateCode = useMutation({
    mutationFn: async () => {
      const slug = (user?.email || 'parceiro').split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const code = `${slug}${Math.floor(Math.random() * 900 + 100)}`;
      const { error } = await (supabase.from('referral_codes' as any).insert({
        restaurant_id: restaurantId,
        code,
        commission_pct: 20,
      } as any));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Código gerado! 🎉');
      queryClient.invalidateQueries({ queryKey: ['my-referral-code'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const shareUrl = code ? `${window.location.origin}/cadastro?ref=${code.code}` : '';
  const whatsappMsg = `Cara, conheci esse sistema *Bora Uai* pra bar/restaurante e tá foda! 🔥\n\nUsa meu código *${code?.code}* no cadastro e ganha 14 dias grátis:\n${shareUrl}`;

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 p-4 md:p-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold flex items-center gap-2">
            <Gift className="w-7 h-7 text-[#FF5757]" /> Programa de Indicação
          </h1>
          <p className="text-muted-foreground">Indique outros bares e ganhe 20% de comissão recorrente.</p>
        </div>

        {isLoading ? (
          <div>Carregando...</div>
        ) : !code ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Gift className="w-16 h-16 mx-auto mb-4 text-[#FF5757]" />
              <h2 className="text-xl font-bold mb-2">Bora ganhar dinheiro indicando?</h2>
              <p className="text-muted-foreground mb-6">
                Você ganha <strong>20% de comissão recorrente</strong> de cada bar que assinar pelo seu código.<br />
                Indicou 5 bares no Profissional? São <strong>R$ 199/mês</strong> no seu bolso, todo mês.
              </p>
              <Button onClick={() => generateCode.mutate()} disabled={generateCode.isPending} className="bg-[#FF5757] hover:bg-[#FF5757]/90">
                {generateCode.isPending ? 'Gerando...' : 'Gerar meu código'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card><CardContent className="p-4">
                <Users className="w-5 h-5 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Cliques</p>
                <p className="text-2xl font-bold">{code.uses_count}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <TrendingUp className="w-5 h-5 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Conversões</p>
                <p className="text-2xl font-bold">{code.conversions_count}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <DollarSign className="w-5 h-5 text-emerald-500 mb-2" />
                <p className="text-xs text-muted-foreground">Total ganho</p>
                <p className="text-2xl font-bold">R$ {Number(code.total_earned).toFixed(2)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <Gift className="w-5 h-5 text-[#FF5757] mb-2" />
                <p className="text-xs text-muted-foreground">Comissão</p>
                <p className="text-2xl font-bold">{code.commission_pct}%</p>
              </CardContent></Card>
            </div>

            {/* Code & Share */}
            <Card className="mb-6">
              <CardHeader><CardTitle>Seu código de indicação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input value={code.code} readOnly className="font-mono text-lg font-bold text-center" />
                  <Button variant="outline" onClick={() => { navigator.clipboard.writeText(code.code); toast.success('Copiado!'); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly className="text-sm" />
                  <Button variant="outline" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Link copiado!'); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <a href={`https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`} target="_blank" rel="noopener">
                    <Share2 className="w-4 h-4 mr-2" /> Compartilhar no WhatsApp
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Conversions */}
            <Card>
              <CardHeader><CardTitle>Indicações ({conversions.length})</CardTitle></CardHeader>
              <CardContent>
                {conversions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Ainda não houve indicações. Compartilhe seu código!
                  </p>
                ) : (
                  <div className="divide-y">
                    {conversions.map((c: any) => (
                      <div key={c.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{c.referred_restaurant?.name || 'Restaurante'}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={c.status === 'paid' ? 'default' : 'outline'}>
                            {c.status === 'pending' && 'Pendente'}
                            {c.status === 'confirmed' && 'Confirmada'}
                            {c.status === 'paid' && 'Paga ✓'}
                            {c.status === 'cancelled' && 'Cancelada'}
                          </Badge>
                          <p className="text-sm font-semibold mt-1">R$ {Number(c.commission_amount).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
