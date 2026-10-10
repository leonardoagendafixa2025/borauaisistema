import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, KeyRound, Trash2, Share2, Copy, Check, X, Smartphone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import MetricCard from '@/components/MetricCard';

type StaffRow = {
  id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'attendant' | 'kitchen';
  email: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string;
};

const ROLE_LABEL: Record<string, { label: string; cls: string; desc: string }> = {
  owner: { label: 'Proprietário', cls: 'bg-warning/10 text-warning', desc: 'Acesso total ao painel' },
  manager: { label: 'Gerente', cls: 'bg-primary/10 text-primary', desc: 'Gerencia operação e equipe' },
  attendant: { label: 'Garçom / Atendente', cls: 'bg-success/10 text-success', desc: 'App do garçom, mesas, comandas' },
  kitchen: { label: 'Cozinha', cls: 'bg-accent text-accent-foreground', desc: 'Apenas KDS — vê e prepara pedidos' },
};

const ROLE_LOGIN_URL: Record<string, string> = {
  owner: '/restaurant/login',
  manager: '/restaurant/login',
  attendant: '/garcom',
  kitchen: '/restaurant/kitchen',
};

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p = '';
  for (let i = 0; i < 6; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

export default function TeamPage() {
  const { restaurantId, roles, user } = useAuth();
  const qc = useQueryClient();

  const myRoleHere = roles?.find((r) => r.restaurant_id === restaurantId)?.role;
  const isOwner = myRoleHere === 'owner';
  const canManage = isOwner || myRoleHere === 'manager' || roles?.some((r) => r.role === 'super_admin');

  const [showAdd, setShowAdd] = useState(false);
  const [resetting, setResetting] = useState<StaffRow | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: genPassword(),
    role: 'attendant' as 'manager' | 'attendant' | 'kitchen',
  });
  const [newPass, setNewPass] = useState(genPassword());

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['restaurant-staff', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('restaurant-manage-staff', {
        body: { action: 'list', restaurant_id: restaurantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.staff || []) as StaffRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('restaurant-manage-staff', {
        body: {
          action: 'create',
          restaurant_id: restaurantId,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          role: form.role,
        },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          } else if (ctx?.text) {
            const txt = await ctx.text();
            try { const j = JSON.parse(txt); if (j?.error) msg = j.error; } catch {}
          }
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-staff', restaurantId] });
      toast.success('Profissional cadastrado');
      // mantém modal aberto para owner copiar credenciais ou compartilhar
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao cadastrar'),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('restaurant-manage-staff', {
        body: {
          action: 'reset-password',
          restaurant_id: restaurantId,
          target_user_id: resetting!.user_id,
          password: newPass,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => toast.success('Senha redefinida'),
    onError: (e: any) => toast.error(e.message || 'Erro ao redefinir'),
  });

  const removeMutation = useMutation({
    mutationFn: async (s: StaffRow) => {
      const { data, error } = await supabase.functions.invoke('restaurant-manage-staff', {
        body: {
          action: 'remove',
          restaurant_id: restaurantId,
          target_user_id: s.user_id,
          role: s.role,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-staff', restaurantId] });
      toast.success('Acesso removido');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover'),
  });

  const buildCredentialsMessage = (
    name: string,
    email: string,
    password: string,
    role: string,
  ) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = ROLE_LOGIN_URL[role] || '/restaurant/login';
    const url = `${origin}${path}`;
    const roleLabel = ROLE_LABEL[role]?.label || role;
    const apkUrl = `${origin}/borauai.apk`;
    return [
      `Olá ${name}! 👋`,
      ``,
      `Seu acesso ao *Bora Uai* foi criado:`,
      `• Função: ${roleLabel}`,
      `• Link: ${url}`,
      `• E-mail: ${email}`,
      `• Senha: ${password}`,
      ...(role === 'attendant'
        ? [
            `• Baixar App Android (.apk): ${apkUrl}`,
            ``,
            `📲 No celular Android, baixe o aplicativo (.apk) pelo link acima para receber notificações e gerenciar os pedidos com agilidade.`,
          ]
        : [
            ``,
            `Acesse o link e faça login. Recomendamos trocar a senha depois.`,
          ]),
    ].join('\n');
  };

  const shareViaWhatsApp = (msg: string, phone?: string | null) => {
    const text = encodeURIComponent(msg);
    const digits = onlyDigits(phone || '');
    const number = digits ? (digits.startsWith('55') ? digits : `55${digits}`) : '';
    const url = number
      ? `https://wa.me/${number}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener');
  };

  const ownerCount = staff.filter((s) => s.role === 'owner').length;
  const attendantCount = staff.filter((s) => s.role === 'attendant').length;
  const kitchenCount = staff.filter((s) => s.role === 'kitchen').length;

  if (!canManage) {
    return (
      <RestaurantLayout>
        <div className="card-elevated p-8 text-center">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="font-heading font-semibold text-lg">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas proprietário e gerente podem gerenciar a equipe.
          </p>
        </div>
      </RestaurantLayout>
    );
  }

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" /> Equipe
              </h1>
              <p className="text-sm text-muted-foreground">
                Cadastre garçons, caixa e cozinha. Cada um recebe seu próprio login.
              </p>
            </div>
            <button
              onClick={() => {
                setForm({ full_name: '', email: '', phone: '', password: genPassword(), role: 'attendant' });
                setShowAdd(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <UserPlus className="h-4 w-4" /> Novo profissional
            </button>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Proprietários" value={ownerCount} icon={ShieldCheck} changeType="neutral" />
          <MetricCard label="Garçons" value={attendantCount} icon={Smartphone} changeType="neutral" />
          <MetricCard label="Cozinha" value={kitchenCount} icon={Users} changeType="neutral" />
          <MetricCard label="Total" value={staff.length} icon={Users} changeType="neutral" />
        </div>

        {/* Lista */}
        <ScrollReveal>
          <div className="card-elevated">
            <div className="p-4 sm:p-5 border-b border-border">
              <h3 className="font-heading font-semibold">Profissionais cadastrados</h3>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : staff.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhum profissional ainda. Cadastre o primeiro garçom!
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {staff.map((s) => {
                  const r = ROLE_LABEL[s.role] || { label: s.role, cls: 'bg-muted', desc: '' };
                  const isMe = s.user_id === user?.id;
                  const canEdit =
                    s.role !== 'owner' || isOwner || roles?.some((x) => x.role === 'super_admin');
                  return (
                    <li key={s.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">
                            {s.full_name || s.email || 'Sem nome'}
                          </p>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${r.cls}`}>
                            {r.label}
                          </span>
                          {isMe && (
                            <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
                              você
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {s.email || '—'} {s.phone ? `· ${s.phone}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            const msg = buildCredentialsMessage(
                              s.full_name || 'colaborador',
                              s.email || '',
                              '••••••• (peça para o profissional ou redefina)',
                              s.role,
                            );
                            shareViaWhatsApp(msg, s.phone);
                          }}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Compartilhar link de acesso por WhatsApp"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => {
                                setNewPass(genPassword());
                                setResetting(s);
                              }}
                              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Redefinir senha"
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                            {!isMe && (
                              <button
                                onClick={() => {
                                  if (confirm(`Remover acesso de ${s.full_name || s.email}?`)) {
                                    removeMutation.mutate(s);
                                  }
                                }}
                                className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                title="Remover acesso"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </ScrollReveal>

        {/* Modal: novo profissional */}
        {showAdd && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/30 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => {
              if (!createMutation.isPending) setShowAdd(false);
            }}
          >
            <div
              className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-heading font-semibold">Novo profissional</h3>
                <button
                  onClick={() => setShowAdd(false)}
                  className="p-1 rounded hover:bg-muted"
                  disabled={createMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nome completo *</label>
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">E-mail (login) *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="joao@boteco.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    WhatsApp (opcional)
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="(11) 99999-9999"
                    autoComplete="tel"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Se preenchido, o botão envia direto pro WhatsApp dele. Se vazio, abre o seletor de contatos.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Senha temporária *</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, password: genPassword() })}
                      className="px-3 rounded-lg border border-border text-xs hover:bg-muted"
                    >
                      Gerar
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Mínimo 6 caracteres. O profissional poderá trocar depois.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Função *</label>
                  <div className="grid gap-2 mt-1">
                    {(['attendant', 'kitchen', 'manager'] as const)
                      .filter((r) => r !== 'manager' || isOwner)
                      .map((r) => {
                        const meta = ROLE_LABEL[r];
                        const sel = form.role === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setForm({ ...form, role: r })}
                            className={`text-left rounded-lg border px-3 py-2 transition ${
                              sel
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{meta.label}</span>
                              {sel && <Check className="h-4 w-4 text-primary" />}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{meta.desc}</p>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border flex flex-col gap-2">
                {createMutation.isSuccess ? (
                  <>
                    <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-xs">
                      <p className="font-medium text-success">✓ Cadastrado com sucesso!</p>
                      <p className="text-muted-foreground mt-1">
                        Compartilhe o acesso com o profissional:
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const msg = buildCredentialsMessage(
                          form.full_name,
                          form.email,
                          form.password,
                          form.role,
                        );
                        shareViaWhatsApp(msg, form.phone);
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
                    >
                      <Share2 className="h-4 w-4" /> Enviar credenciais por WhatsApp
                    </button>
                    <button
                      onClick={async () => {
                        const msg = buildCredentialsMessage(
                          form.full_name,
                          form.email,
                          form.password,
                          form.role,
                        );
                        await navigator.clipboard.writeText(msg);
                        toast.success('Mensagem copiada!');
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                    >
                      <Copy className="h-4 w-4" /> Copiar mensagem
                    </button>
                    <button
                      onClick={() => {
                        setShowAdd(false);
                        createMutation.reset();
                      }}
                      className="w-full text-sm text-muted-foreground py-1"
                    >
                      Fechar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={
                      !form.full_name ||
                      !form.email ||
                      form.password.length < 6 ||
                      createMutation.isPending
                    }
                    className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Cadastrando...' : 'Cadastrar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: redefinir senha */}
        {resetting && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/30 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => !resetMutation.isPending && setResetting(null)}
          >
            <div
              className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-heading font-semibold">Redefinir senha</h3>
                <button onClick={() => setResetting(null)} className="p-1 rounded hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Nova senha para <strong className="text-foreground">{resetting.full_name || resetting.email}</strong>
                </p>
                <div className="flex gap-2">
                  <input
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPass(genPassword())}
                    className="px-3 rounded-lg border border-border text-xs hover:bg-muted"
                  >
                    Gerar
                  </button>
                </div>
              </div>
              <div className="p-4 border-t border-border flex flex-col gap-2">
                <button
                  onClick={async () => {
                    await resetMutation.mutateAsync();
                    const msg = buildCredentialsMessage(
                      resetting.full_name || 'colaborador',
                      resetting.email || '',
                      newPass,
                      resetting.role,
                    );
                    shareViaWhatsApp(msg, resetting.phone);
                    setResetting(null);
                  }}
                  disabled={newPass.length < 6 || resetMutation.isPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" /> Redefinir e enviar por WhatsApp
                </button>
                <button
                  onClick={async () => {
                    await resetMutation.mutateAsync();
                    setResetting(null);
                  }}
                  disabled={newPass.length < 6 || resetMutation.isPending}
                  className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Apenas redefinir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RestaurantLayout>
  );
}
