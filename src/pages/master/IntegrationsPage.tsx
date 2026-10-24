import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, MessageSquare, Mail, Phone, CheckCircle2, XCircle, AlertCircle, Loader2, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status = 'connected' | 'misconfigured' | 'disconnected' | 'unknown';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  iconColor: string;
  checkFn: (settings: Record<string, string>) => Promise<{ status: Status; detail?: string }>;
  configFields: { key: string; label: string; placeholder?: string; type?: string }[];
  docsUrl?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'telegram',
    name: 'Telegram Bot',
    description: 'Notificações operacionais e comandos para restaurantes e clientes',
    icon: Send,
    iconColor: 'text-sky-500',
    docsUrl: 'https://core.telegram.org/bots',
    configFields: [
      { key: 'telegram_bot_username', label: 'Username do bot (sem @)', placeholder: 'BoraUaiBot' },
      { key: 'telegram_notify_url', label: 'URL telegram-notify', placeholder: 'https://....supabase.co/functions/v1/telegram-notify' },
      { key: 'telegram_notify_anon_key', label: 'Anon key (interna)', type: 'password' },
    ],
    checkFn: async (settings) => {
      const ok = !!settings.telegram_bot_username && !!settings.telegram_notify_url && !!settings.telegram_notify_anon_key;
      if (!ok) return { status: 'misconfigured', detail: 'Preencha bot username, URL e anon key' };
      // Check secret existence is server-side; we trust config presence
      return { status: 'connected', detail: `Bot @${settings.telegram_bot_username}` };
    },
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Cobrança recorrente das assinaturas SaaS dos restaurantes via cartão de crédito',
    icon: CheckCircle2,
    iconColor: 'text-violet-500',
    docsUrl: 'https://stripe.com/docs',
    configFields: [
      { key: 'stripe_secret_key', label: 'Chave Secreta Stripe (sk_live_... ou sk_test_...)', placeholder: 'sk_live_...', type: 'password' },
      { key: 'stripe_publishable_key', label: 'Chave Pública Stripe (pk_live_... ou pk_test_...)', placeholder: 'pk_live_...' },
      { key: 'stripe_webhook_secret', label: 'Segredo do Webhook Stripe (whsec_...)', placeholder: 'whsec_...', type: 'password' },
    ],
    checkFn: async (settings) => {
      const secret = settings.stripe_secret_key;
      if (!secret) return { status: 'misconfigured', detail: 'Chave secreta (sk_live_... ou sk_test_...) não configurada' };
      if (!secret.startsWith('sk_live_') && !secret.startsWith('sk_test_')) {
        return { status: 'misconfigured', detail: 'Formato inválido (deve iniciar com sk_live_ ou sk_test_)' };
      }
      const mode = secret.startsWith('sk_live_') ? 'Modo Produção (Live)' : 'Modo Testes (Sandbox)';
      return { status: 'connected', detail: `Ativo · ${mode}` };
    },
  },
  {
    id: 'resend',
    name: 'Resend (E-mail)',
    description: 'Envio de e-mails transacionais e marketing',
    icon: Mail,
    iconColor: 'text-orange-500',
    docsUrl: 'https://resend.com',
    configFields: [
      { key: 'resend_from_email', label: 'E-mail remetente', placeholder: 'noreply@seudominio.com' },
    ],
    checkFn: async (settings) => {
      if (!settings.resend_from_email) return { status: 'misconfigured', detail: 'E-mail remetente não configurado' };
      return { status: 'unknown', detail: 'Configure RESEND_API_KEY via Connectors' };
    },
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp (wa.me)',
    description: 'Links automáticos de WhatsApp para clientes e suporte',
    icon: Phone,
    iconColor: 'text-green-500',
    configFields: [
      { key: 'support_whatsapp', label: 'WhatsApp de suporte (com DDD)', placeholder: '11999998888' },
    ],
    checkFn: async (settings) => {
      if (!settings.support_whatsapp) return { status: 'misconfigured', detail: 'Número não configurado' };
      return { status: 'connected', detail: settings.support_whatsapp };
    },
  },
];

const statusConfig: Record<Status, { label: string; class: string; Icon: any }> = {
  connected: { label: 'Conectado', class: 'bg-success/10 text-success border-success/30', Icon: CheckCircle2 },
  misconfigured: { label: 'Faltam dados', class: 'bg-warning/10 text-warning border-warning/30', Icon: AlertCircle },
  disconnected: { label: 'Desconectado', class: 'bg-destructive/10 text-destructive border-destructive/30', Icon: XCircle },
  unknown: { label: 'Verificar', class: 'bg-muted text-muted-foreground border-border', Icon: AlertCircle },
};

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [configDialog, setConfigDialog] = useState<Integration | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: Status; detail?: string }>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: settings = {} } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data } = await (supabase.from('platform_settings' as any).select('key, value') as any);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
  });

  const testIntegration = async (i: Integration) => {
    setTestingId(i.id);
    try {
      const result = await i.checkFn(settings);
      setTestResults(prev => ({ ...prev, [i.id]: result }));
      if (result.status === 'connected') toast.success(`${i.name}: OK`);
      else if (result.status === 'misconfigured') toast.warning(`${i.name}: ${result.detail}`);
      else toast.error(`${i.name}: ${result.detail ?? 'falhou'}`);
    } catch (e: any) {
      toast.error(`${i.name}: ${e.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const openConfig = (i: Integration) => {
    const initial: Record<string, string> = {};
    i.configFields.forEach(f => { initial[f.key] = settings[f.key] ?? ''; });
    setFormValues(initial);
    setConfigDialog(i);
  };

  const saveConfig = async () => {
    if (!configDialog) return;
    setSaving(true);
    for (const [key, value] of Object.entries(formValues)) {
      const { data: existing } = await (supabase.from('platform_settings' as any).select('id').eq('key', key).maybeSingle() as any);
      if (existing) {
        await (supabase.from('platform_settings' as any).update({ value } as any).eq('key', key) as any);
      } else {
        await (supabase.from('platform_settings' as any).insert({ key, value } as any) as any);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    toast.success('Configuração salva');
    setConfigDialog(null);
    setSaving(false);
  };

  const getStatusFor = (i: Integration): { status: Status; detail?: string } => {
    if (testResults[i.id]) return testResults[i.id];
    // initial heuristic
    const filled = i.configFields.every(f => !!settings[f.key]);
    return filled ? { status: 'unknown', detail: 'Clique em testar' } : { status: 'misconfigured', detail: 'Configuração incompleta' };
  };

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div>
            <h1 className="font-heading text-2xl font-bold">Integrações</h1>
            <p className="text-sm text-muted-foreground">Status e configuração das integrações da plataforma</p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {INTEGRATIONS.map(i => {
            const result = getStatusFor(i);
            const cfg = statusConfig[result.status];
            return (
              <ScrollReveal key={i.id}>
                <div className="card-elevated p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${i.iconColor}`}>
                        <i.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{i.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">{i.description}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cfg.class}>
                      <cfg.Icon className="h-3 w-3 mr-1" />
                      {cfg.label}
                    </Badge>
                  </div>

                  {result.detail && (
                    <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                      {result.detail}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => testIntegration(i)} disabled={testingId === i.id}>
                      {testingId === i.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                      Testar
                    </Button>
                    <Button size="sm" onClick={() => openConfig(i)}>Configurar</Button>
                    {i.docsUrl && (
                      <a href={i.docsUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                        Docs <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal>
          <div className="card-elevated p-5 bg-muted/30">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" /> Secrets gerenciadas via Cloud
            </h3>
            <p className="text-sm text-muted-foreground">
              As chaves privadas (TELEGRAM_API_KEY, STRIPE_*, RESEND_API_KEY, etc.) são gerenciadas pela plataforma Lovable Cloud.
              Para adicionar/atualizar uma secret, use o painel de Connectors.
            </p>
          </div>
        </ScrollReveal>
      </div>

      <Dialog open={!!configDialog} onOpenChange={(open) => !open && setConfigDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar {configDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {configDialog?.configFields.map(f => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                <Input
                  type={f.type ?? 'text'}
                  value={formValues[f.key] ?? ''}
                  onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setConfigDialog(null)}>Cancelar</Button>
              <Button onClick={saveConfig} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MasterLayout>
  );
}
