import { useState, useMemo, useEffect } from 'react';
import { Globe, Palette, Bell, Shield, CreditCard, FileText, Scale, Search, Save, Plug } from 'lucide-react';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';

type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'url' | 'number' | 'color' | 'textarea' | 'switch';
  placeholder?: string;
  desc?: string;
  searchTerms?: string;
};

type SectionDef = {
  id: string;
  label: string;
  icon: any;
  fields: FieldDef[];
};

const sections: SectionDef[] = [
  {
    id: 'general',
    label: 'Geral',
    icon: Globe,
    fields: [
      { key: 'platform_name', label: 'Nome da plataforma', searchTerms: 'marca brand' },
      { key: 'domain', label: 'Domínio principal', type: 'url' },
      { key: 'support_email', label: 'E-mail de suporte', type: 'email' },
      { key: 'support_whatsapp', label: 'WhatsApp de suporte', searchTerms: 'telefone contato' },
      { key: 'trial_days', label: 'Período de trial padrão (dias)', type: 'number' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrações',
    icon: Plug,
    fields: [
      { key: 'telegram_bot_username', label: '🤖 Username do bot Telegram (sem @)', placeholder: 'Ex: BoraUaiBot', desc: 'Necessário para o botão "Vincular em 1 clique" do cliente. Crie o bot no @BotFather.' },
      { key: 'telegram_notify_url', label: 'URL da função telegram-notify', type: 'url', desc: 'Endpoint da edge function que dispara notificações.' },
      { key: 'telegram_notify_anon_key', label: 'Anon key (para chamadas internas)', desc: 'Usada por triggers do banco para chamar a edge function.' },
      
      { key: 'resend_from_email', label: 'E-mail remetente (Resend)', type: 'email', placeholder: 'noreply@seudominio.com' },
    ],
  },
  {
    id: 'email',
    label: 'E-mail',
    icon: FileText,
    fields: [
      { key: 'email_signature', label: 'Assinatura de e-mail', type: 'textarea' },
      { key: 'email_footer', label: 'Rodapé padrão', type: 'textarea' },
      { key: 'email_logo_url', label: 'URL do logo nos e-mails', type: 'url' },
    ],
  },
  {
    id: 'security',
    label: 'Segurança',
    icon: Shield,
    fields: [
      { key: 'session_timeout_minutes', label: 'Timeout de sessão (min)', type: 'number' },
      { key: 'max_login_attempts', label: 'Tentativas de login antes de bloquear', type: 'number' },
      { key: 'enforce_strong_password', label: 'Exigir senha forte', type: 'switch' },
    ],
  },
  {
    id: 'billing',
    label: 'Faturamento',
    icon: CreditCard,
    fields: [
      { key: 'overdue_grace_days', label: 'Dias de carência após vencimento', type: 'number' },
      { key: 'auto_suspend_after_days', label: 'Suspender automaticamente após X dias', type: 'number' },
      { key: 'invoice_prefix', label: 'Prefixo da fatura' },
    ],
  },
  {
    id: 'appearance',
    label: 'Aparência',
    icon: Palette,
    fields: [
      { key: 'primary_color', label: 'Cor primária', type: 'color' },
      { key: 'secondary_color', label: 'Cor secundária', type: 'color' },
    ],
  },
  {
    id: 'notifications',
    label: 'Notificações',
    icon: Bell,
    fields: [
      { key: 'notify_new_restaurant', label: 'Novo restaurante cadastrado', type: 'switch' },
      { key: 'notify_overdue', label: 'Assinatura inadimplente', type: 'switch' },
      { key: 'notify_cancelled', label: 'Assinatura cancelada', type: 'switch' },
      { key: 'notify_trial_expiring', label: 'Trial expirando', type: 'switch' },
      { key: 'notify_high_value_orders', label: 'Pedidos > R$ 500', type: 'switch' },
    ],
  },
  {
    id: 'legal',
    label: 'Documentos Legais',
    icon: Scale,
    fields: [
      { key: 'legal_terms', label: 'Termos de Uso', type: 'textarea' },
      { key: 'legal_privacy', label: 'Política de Privacidade', type: 'textarea' },
      { key: 'legal_lgpd', label: 'LGPD', type: 'textarea' },
    ],
  },
];

function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data } = await (supabase.from('platform_settings' as any).select('key, value') as any);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
  });
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings = {}, isLoading } = usePlatformSettings();
  const [local, setLocal] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (Object.keys(settings).length > 0) setLocal(settings);
  }, [settings]);

  const set = (key: string, value: string) => setLocal(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const changes = Object.entries(local).filter(([k, v]) => settings[k] !== v);
    if (changes.length === 0) { toast.info('Nenhuma alteração'); setSaving(false); return; }
    for (const [key, value] of changes) {
      // Upsert: tenta update, se não existe insere
      const { data: existing } = await (supabase.from('platform_settings' as any).select('id').eq('key', key).maybeSingle() as any);
      if (existing) {
        await (supabase.from('platform_settings' as any).update({ value, updated_at: new Date().toISOString() } as any).eq('key', key) as any);
      } else {
        await (supabase.from('platform_settings' as any).insert({ key, value } as any) as any);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    toast.success(`${changes.length} configuração(ões) salva(s)`);
    setSaving(false);
  };

  // Search across all sections - finds matching fields and the section they live in
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const matches: { section: string; sectionLabel: string; field: FieldDef }[] = [];
    sections.forEach(s => {
      s.fields.forEach(f => {
        const haystack = `${f.label} ${f.key} ${f.searchTerms ?? ''} ${f.desc ?? ''}`.toLowerCase();
        if (haystack.includes(q)) matches.push({ section: s.id, sectionLabel: s.label, field: f });
      });
    });
    return matches;
  }, [search]);

  const renderField = (f: FieldDef) => {
    const value = local[f.key] ?? '';
    if (f.type === 'switch') {
      return (
        <div key={f.key} className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
          <div>
            <Label className="text-sm font-medium">{f.label}</Label>
            {f.desc && <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>}
          </div>
          <Switch checked={value === 'true'} onCheckedChange={(c) => set(f.key, String(c))} />
        </div>
      );
    }
    if (f.type === 'textarea') {
      return (
        <div key={f.key} className="space-y-1">
          <Label className="text-sm font-medium">{f.label}</Label>
          <Textarea value={value} onChange={e => set(f.key, e.target.value)} rows={4} placeholder={f.placeholder} />
          {f.desc && <p className="text-xs text-muted-foreground">{f.desc}</p>}
        </div>
      );
    }
    if (f.type === 'color') {
      return (
        <div key={f.key} className="space-y-1">
          <Label className="text-sm font-medium">{f.label}</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={value || '#000000'} onChange={e => set(f.key, e.target.value)} className="h-10 w-14 rounded cursor-pointer border border-border" />
            <Input value={value} onChange={e => set(f.key, e.target.value)} className="w-32" />
          </div>
        </div>
      );
    }
    return (
      <div key={f.key} className="space-y-1">
        <Label className="text-sm font-medium">{f.label}</Label>
        <Input type={f.type ?? 'text'} value={value} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
        {f.desc && <p className="text-xs text-muted-foreground">{f.desc}</p>}
      </div>
    );
  };

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl font-bold">Configurações</h1>
              <p className="text-sm text-muted-foreground">Configurações gerais da plataforma</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar configuração..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar tudo'}
              </Button>
            </div>
          </div>
        </ScrollReveal>

        {/* Search results override */}
        {searchResults && (
          <ScrollReveal>
            <div className="card-elevated p-6">
              <h3 className="font-semibold mb-4">
                {searchResults.length === 0 ? 'Nada encontrado' : `${searchResults.length} resultado(s) para "${search}"`}
              </h3>
              <div className="space-y-4">
                {searchResults.map(({ section, sectionLabel, field }) => (
                  <div key={`${section}-${field.key}`} className="rounded-lg border border-border p-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => { setSearch(''); setActiveTab(section); }}
                      className="text-xs text-primary hover:underline"
                    >
                      📁 {sectionLabel}
                    </button>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        )}

        {!searchResults && (
          <ScrollReveal>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap h-auto">
                {sections.map(s => (
                  <TabsTrigger key={s.id} value={s.id} className="gap-1.5">
                    <s.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {sections.map(s => (
                <TabsContent key={s.id} value={s.id} className="card-elevated p-6 space-y-4 mt-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-border">
                    <s.icon className="h-5 w-5 text-primary" />
                    <h3 className="font-heading font-semibold text-lg">{s.label}</h3>
                  </div>
                  {isLoading ? (
                    <div className="py-8 text-center text-muted-foreground">Carregando...</div>
                  ) : (
                    s.fields.map(renderField)
                  )}
                  {s.id === 'integrations' && (
                    <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                      💡 Para um painel completo de integrações com testes de conexão, acesse{' '}
                      <Link to="/master/integracoes" className="text-primary font-semibold underline">
                        Integrações
                      </Link>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </ScrollReveal>
        )}
      </div>
    </MasterLayout>
  );
}
