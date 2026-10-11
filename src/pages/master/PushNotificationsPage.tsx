import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MasterLayout from '@/components/layout/MasterLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Bell,
  BellRing,
  Send,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Flame,
  Radio,
  Clock,
  Trash2,
  RefreshCw,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useWebPush } from '@/hooks/useWebPush';

const TEMPLATES_SUGERIDOS = [
  {
    title: '🔥 Fome de quê? Cupom de 20% OFF!',
    body: 'Aproveite a noite com frete grátis e desconto exclusivo no seu pedido!',
    url: '/bardanega',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=60'
  },
  {
    title: '🍻 Happy Hour no Bora Uai!',
    body: 'Porções e chopp gelado esperando por você. Peça já pelo cardápio!',
    url: '/bardanega',
    image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=60'
  },
  {
    title: '🛵 Seu pedido saiu para entrega!',
    body: 'O motoboy já está a caminho com o seu pedido quentinho.',
    url: '/meus-pedidos',
    image: ''
  },
  {
    title: '⚡ Novidade imperdível no Bora Uai!',
    body: 'Confira as novidades do cardápio e promoções de hoje.',
    url: '/',
    image: ''
  }
];

export default function PushNotificationsPage() {
  const qc = useQueryClient();
  const { status: pushStatus, subscribe, unsubscribe, busy: pushBusy } = useWebPush();

  const [title, setTitle] = useState('🔥 Fome de quê? Cupom de 20% OFF!');
  const [body, setBody] = useState('Aproveite a noite com frete grátis e desconto exclusivo no seu pedido!');
  const [targetUrl, setTargetUrl] = useState('/bardanega');
  const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=60');
  const [restaurantId, setRestaurantId] = useState<string>('all');

  // 1. Restaurantes cadastrados
  const { data: restaurants = [] } = useQuery({
    queryKey: ['master-restaurants-push'],
    queryFn: async () => {
      const { data, error } = await supabase.from('restaurants').select('id, name, slug').order('name');
      if (error) throw error;
      return data;
    },
  });

  // 2. Dispositivos inscritos
  const { data: subscriptions = [], isLoading: loadingSubs, refetch: refetchSubs } = useQuery({
    queryKey: ['master-push-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Histórico de disparos
  const { data: broadcasts = [], isLoading: loadingBroadcasts, refetch: refetchBroadcasts } = useQuery({
    queryKey: ['master-push-broadcasts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_broadcasts')
        .select('*')
        .eq('channel', 'push')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // 4. Mutação de disparo
  const sendMutation = useMutation({
    mutationFn: async ({ isTest = false }: { isTest?: boolean }) => {
      if (!title.trim() || !body.trim()) {
        throw new Error('Informe o título e a mensagem da notificação.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          body,
          url: targetUrl || '/',
          image: imageUrl.trim() || undefined,
          restaurant_id: restaurantId === 'all' ? null : restaurantId,
          tag: `broadcast-${Date.now()}`
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao disparar notificação.');
      }
      return result;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['master-push-broadcasts'] });
      qc.invalidateQueries({ queryKey: ['master-push-subscriptions'] });
      if (data.total === 0) {
        toast.info('Nenhum aparelho inscrito no momento. Ative as notificações no seu próprio celular abaixo para testar!');
      } else {
        toast.success(`Disparo realizado! ${data.sent} aparelho(s) notificado(s) com sucesso.`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Falha no disparo da notificação push.');
    },
  });

  const handleApplyTemplate = (tmpl: typeof TEMPLATES_SUGERIDOS[0]) => {
    setTitle(tmpl.title);
    setBody(tmpl.body);
    setTargetUrl(tmpl.url);
    setImageUrl(tmpl.image);
    toast.success('Modelo carregado no formulário!');
  };

  const handleToggleMyPush = async () => {
    try {
      if (pushStatus === 'subscribed') {
        await unsubscribe();
        toast.info('Notificações desativadas neste aparelho.');
      } else {
        await subscribe();
        toast.success('Aparelho inscrito! Agora este celular/computador receberá as notificações mesmo com o app fechado.');
        refetchSubs();
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar permissão de notificação.');
    }
  };

  return (
    <MasterLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> Push Nativo Android & PWA
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight flex items-center gap-2.5">
              <BellRing className="h-7 w-7 text-primary" />
              Notificações Push Nativas
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Dispare alertas e promoções em massa que despertam os celulares Android mesmo com o app ou navegador fechado (estilo Shopee, iFood e 99).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { refetchSubs(); refetchBroadcasts(); }}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
            <Button
              variant={pushStatus === 'subscribed' ? 'secondary' : 'default'}
              size="sm"
              onClick={handleToggleMyPush}
              disabled={pushBusy}
              className="gap-2 font-medium"
            >
              <Smartphone className="h-4 w-4" />
              {pushStatus === 'subscribed' ? 'Meu aparelho: Ativo ✅' : 'Inscrever meu celular'}
            </Button>
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-medium">
                Dispositivos Conectados
                <Smartphone className="h-4 w-4 text-primary" />
              </CardDescription>
              <CardTitle className="text-3xl font-bold">
                {loadingSubs ? '…' : subscriptions.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Celulares Android e navegadores prontos para receber.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-medium">
                Total de Disparos
                <Send className="h-4 w-4 text-emerald-500" />
              </CardDescription>
              <CardTitle className="text-3xl font-bold">
                {loadingBroadcasts ? '…' : broadcasts.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Campanhas enviadas aos usuários.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-medium">
                Google FCM Gateway
                <Radio className="h-4 w-4 text-primary" />
              </CardDescription>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" /> Ativo & Conectado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Chaves VAPID oficiais operando em alta prioridade.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-medium">
                Modo em Segundo Plano
                <Sparkles className="h-4 w-4 text-amber-500" />
              </CardDescription>
              <CardTitle className="text-xl font-bold text-foreground">
                Desperta no Bloqueio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Service Worker nativo acorda com vibração e som.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Área Principal: Formulário + Preview Android */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Lado Esquerdo: Formulário de Disparo */}
          <Card className="lg:col-span-7 border-border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" /> Criar Disparo Push
                  </CardTitle>
                  <CardDescription>
                    Preencha o conteúdo da notificação que aparecerá na tela dos celulares.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Sugestões rápidas */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Modelos prontos (clique para aplicar):</Label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES_SUGERIDOS.map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyTemplate(t)}
                      className="text-xs rounded-lg border border-border/80 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 px-2.5 py-1 transition-all text-left flex items-center gap-1.5"
                    >
                      <span>{t.title.split(' ')[0]}</span>
                      <span className="font-medium truncate max-w-[150px]">{t.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Título */}
              <div className="space-y-1.5">
                <Label htmlFor="push-title" className="font-semibold text-sm">
                  Título da Notificação <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="push-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: 🔥 Cupom de 20% OFF no Bora Uai!"
                  maxLength={70}
                  className="font-medium"
                />
                <span className="text-[11px] text-muted-foreground block text-right">
                  {title.length}/70 caracteres
                </span>
              </div>

              {/* Mensagem / Corpo */}
              <div className="space-y-1.5">
                <Label htmlFor="push-body" className="font-semibold text-sm">
                  Mensagem / Texto <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="push-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Ex: Não perca! Peça agora pelo cardápio e ganhe frete grátis e sobremesa grátis."
                  rows={3}
                  maxLength={180}
                  className="resize-none"
                />
                <span className="text-[11px] text-muted-foreground block text-right">
                  {body.length}/180 caracteres
                </span>
              </div>

              {/* URL de Destino */}
              <div className="space-y-1.5">
                <Label htmlFor="push-url" className="font-semibold text-sm">
                  Link / Rota ao clicar na notificação
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="push-url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="Ex: /bardanega ou https://borauai.com/cardapio"
                  />
                  <Select value={targetUrl} onValueChange={setTargetUrl}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Atalhos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="/bardanega">Bar da Nega</SelectItem>
                      <SelectItem value="/garcom">App Garçom</SelectItem>
                      <SelectItem value="/entregador">Entregador</SelectItem>
                      <SelectItem value="/meus-pedidos">Meus Pedidos</SelectItem>
                      <SelectItem value="/">Página Inicial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Imagem de Destaque (Banner Big Picture) */}
              <div className="space-y-1.5">
                <Label htmlFor="push-image" className="font-semibold text-sm flex items-center justify-between">
                  <span>Banner / Imagem Grande (Estilo iFood / Shopee)</span>
                  <span className="text-xs text-muted-foreground font-normal">Opcional</span>
                </Label>
                <Input
                  id="push-image"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="URL de uma imagem JPG ou PNG (ex: https://...)"
                />
              </div>

              {/* Segmentação por Restaurante */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Segmento de Destino</Label>
                <Select value={restaurantId} onValueChange={setRestaurantId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🌐 Todos os Dispositivos (Clientes + Equipes)</SelectItem>
                    {restaurants.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        🍽️ Apenas {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Botão de Disparo */}
              <div className="pt-3">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => sendMutation.mutate({ isTest: false })}
                  disabled={sendMutation.isPending || !title || !body}
                  className="w-full font-bold gap-2 text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                >
                  <Send className="h-5 w-5" />
                  {sendMutation.isPending ? 'Enviando aos celulares…' : 'Disparar Notificação Push Agora 🚀'}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  A notificação será enviada pelo Google FCM em alta prioridade com som e vibração.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Lado Direito: Mockup do Android em tempo real */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-border shadow-sm overflow-hidden bg-slate-950 text-slate-100">
              <CardHeader className="bg-slate-900 border-b border-slate-800 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Pré-visualização no Android
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                    Ao Vivo
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                <p className="text-xs text-slate-400">
                  É exatamente assim que a notificação aparecerá na barra de notificações do celular do usuário (mesmo com a tela bloqueada ou app fechado):
                </p>

                {/* Card Notificação Android */}
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-2xl space-y-3">
                  {/* Cabeçalho da notificação */}
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center p-0.5">
                        <img src="/favicon.png" alt="Bora Uai" className="h-3.5 w-3.5 rounded-full object-contain" />
                      </div>
                      <span className="font-semibold text-slate-200">Bora Uai</span>
                      <span>•</span>
                      <span>agora</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Google Play Services</span>
                  </div>

                  {/* Conteúdo */}
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-white leading-tight">
                      {title || 'Título da Notificação'}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {body || 'Sua mensagem aparecerá aqui para os clientes e funcionários.'}
                    </p>
                  </div>

                  {/* Banner / Imagem grande (estilo Shopee / iFood) */}
                  {imageUrl.trim() && (
                    <div className="relative rounded-xl overflow-hidden h-36 w-full border border-slate-800 bg-slate-950">
                      <img
                        src={imageUrl}
                        alt="Banner"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Ações da notificação */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      className="text-xs font-bold text-primary hover:text-primary/80 px-2 py-1 rounded bg-primary/10 transition-colors"
                    >
                      👀 Ver Agora
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 transition-colors"
                    >
                      Dispensar
                    </button>
                  </div>
                </div>

                {/* Box de explicação técnica */}
                <div className="rounded-xl bg-slate-900/40 border border-slate-800/80 p-3 space-y-2 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Como funciona com o app fechado:
                  </div>
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>O <strong>Google FCM</strong> transmite a mensagem via antena de dados/Wi-Fi.</li>
                    <li>O <strong>Android</strong> acorda o Service Worker em segundo plano.</li>
                    <li>O aparelho vibra com padrão intenso e exibe o alerta pop-up no topo da tela.</li>
                    <li>Ao tocar, direciona imediatamente para: <code className="text-primary font-mono text-[11px]">{targetUrl || '/'}</code>.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabela de Histórico de Disparos */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Histórico de Disparos Realizados
            </CardTitle>
            <CardDescription>
              Acompanhe as últimas mensagens enviadas e a quantidade de aparelhos notificados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBroadcasts ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Carregando histórico…</p>
            ) : broadcasts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum disparo push foi realizado ainda. Crie seu primeiro envio acima!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead className="text-center">Aparelhos</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {broadcasts.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {new Date(b.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="font-semibold text-sm max-w-[200px] truncate">
                          {b.subject || 'Sem título'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                          {b.body}
                        </TableCell>
                        <TableCell className="text-xs">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">
                            {b.segment?.url || '/'}
                          </code>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono">
                            {b.sent_count} / {b.total_recipients}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={b.status === 'completed' ? 'default' : 'secondary'}
                            className={b.status === 'completed' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                          >
                            {b.status === 'completed' ? 'Entregue' : b.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MasterLayout>
  );
}
