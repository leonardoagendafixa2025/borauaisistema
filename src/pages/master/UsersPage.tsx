import { Users, ShieldCheck, UserPlus, Search, Trash2, Edit, MoreHorizontal, X } from 'lucide-react';
import MasterLayout from '@/components/layout/MasterLayout';
import MetricCard from '@/components/MetricCard';
import ScrollReveal from '@/components/ScrollReveal';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const roleLabels: Record<string, { label: string; cls: string }> = {
  super_admin: { label: 'Super Admin', cls: 'bg-primary/10 text-primary' },
  finance: { label: 'Financeiro', cls: 'bg-accent text-accent-foreground' },
  support: { label: 'Suporte', cls: 'bg-muted text-muted-foreground' },
  commercial: { label: 'Comercial', cls: 'bg-success/10 text-success' },
  owner: { label: 'Proprietário', cls: 'bg-warning/10 text-warning' },
  manager: { label: 'Gerente', cls: 'bg-primary/10 text-primary' },
  attendant: { label: 'Atendente', cls: 'bg-muted text-muted-foreground' },
  kitchen: { label: 'Cozinha', cls: 'bg-accent text-accent-foreground' },
};

const allRoles: AppRole[] = ['super_admin', 'finance', 'support', 'commercial', 'owner', 'manager', 'attendant', 'kitchen'];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('owner');
  const [newRestaurantId, setNewRestaurantId] = useState('');
  const queryClient = useQueryClient();

  const { data: userRoles = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*, profiles:profiles!user_roles_user_id_fkey(full_name, phone)')
        .order('created_at', { ascending: false });
      
      if (error) {
        // Fallback: fetch without join
        const { data: roles } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false });
        return roles || [];
      }
      return data || [];
    },
  });

  const { data: restaurants = [] } = useQuery({
    queryKey: ['all-restaurants-list'],
    queryFn: async () => {
      const { data } = await supabase.from('restaurants').select('id, name').order('name');
      return data || [];
    },
  });

  // Get profiles for display
  const { data: profiles = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, phone');
      return data || [];
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from('user_roles').delete().eq('id', roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Papel removido com sucesso');
    },
    onError: () => toast.error('Erro ao remover papel'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role, restaurant_id }: { id: string; role: AppRole; restaurant_id: string | null }) => {
      const { error } = await supabase.from('user_roles').update({ role, restaurant_id }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
      toast.success('Papel atualizado');
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      let createdUserId: string | null = null;

      // 1. Primary: create user via admin API (no rate limits, email auto-confirmed, no session swap)
      try {
        const resp = await fetch('/api/admin-update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create-user',
            email: newEmail,
            password: newPassword,
            full_name: newName,
          }),
        });
        const respData = await resp.json();
        if (resp.ok && respData?.user?.id) {
          createdUserId = respData.user.id;
        }
      } catch (apiErr) {
        console.warn('[UsersPage] Admin API create error:', apiErr);
      }

      // 2. Secondary: Edge Function
      if (!createdUserId) {
        try {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('admin-update-user', {
            body: {
              action: 'create-user',
              email: newEmail,
              password: newPassword,
              full_name: newName,
            },
          });
          if (!fnErr && fnData?.user?.id) {
            createdUserId = fnData.user.id;
          }
        } catch (fnEx) {
          console.warn('[UsersPage] Edge function create error:', fnEx);
        }
      }

      // 3. Fallback: client signUp with session preservation
      if (!createdUserId) {
        const { data: adminSession } = await supabase.auth.getSession();
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: newEmail,
          password: newPassword,
          options: { data: { full_name: newName } },
        });
        if (signUpError) throw signUpError;
        if (!signUpData.user) throw new Error('Falha ao criar usuário');
        createdUserId = signUpData.user.id;

        if (adminSession?.session?.refresh_token) {
          await supabase.auth.setSession({
            access_token: adminSession.session.access_token,
            refresh_token: adminSession.session.refresh_token,
          });
        }
      }

      // Assign role
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: createdUserId,
        role: newRole,
        restaurant_id: newRestaurantId || null,
      });
      if (roleError) throw roleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowAdd(false);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewRole('owner');
      setNewRestaurantId('');
      toast.success('Usuário criado com sucesso');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar usuário'),
  });

  const getProfileName = (userId: string) => {
    const p = profiles.find(p => p.user_id === userId);
    return p?.full_name || userId.slice(0, 8) + '...';
  };

  const getRestaurantName = (id: string | null) => {
    if (!id) return 'Plataforma';
    return restaurants.find(r => r.id === id)?.name || id.slice(0, 8);
  };

  const filtered = userRoles.filter(u => {
    const name = getProfileName(u.user_id).toLowerCase();
    const restaurant = getRestaurantName(u.restaurant_id).toLowerCase();
    const s = search.toLowerCase();
    return name.includes(s) || restaurant.includes(s) || u.role.includes(s);
  });

  const uniqueUsers = new Set(userRoles.map(u => u.user_id));
  const platformAdmins = userRoles.filter(u => ['super_admin', 'finance', 'support', 'commercial'].includes(u.role)).length;
  const restaurantUsers = userRoles.filter(u => u.restaurant_id).length;

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold">Usuários</h1>
              <p className="text-sm text-muted-foreground">Gestão de acessos da plataforma e restaurantes</p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <UserPlus className="h-4 w-4" /> Novo usuário
            </button>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Total de usuários', value: uniqueUsers.size, icon: Users, change: `${userRoles.length} papéis`, changeType: 'neutral' as const },
            { label: 'Admins plataforma', value: platformAdmins, icon: ShieldCheck, changeType: 'neutral' as const },
            { label: 'Usuários restaurantes', value: restaurantUsers, icon: Users, change: `${restaurants.length} restaurantes`, changeType: 'neutral' as const },
          ].map((m, i) => (
            <ScrollReveal key={i} delay={i * 60}>
              <MetricCard {...m} />
            </ScrollReveal>
          ))}
        </div>

        {/* Add user modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
            <div className="card-elevated w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold text-lg">Novo Usuário</h3>
                <button onClick={() => setShowAdd(false)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Nome completo</label>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="João Silva" />
                </div>
                <div>
                  <label className="text-sm font-medium">E-mail</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="joao@email.com" autoComplete="email" />
                </div>
                <div>
                  <label className="text-sm font-medium">Senha</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                </div>
                <div>
                  <label className="text-sm font-medium">Papel</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value as AppRole)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    {allRoles.map(r => (
                      <option key={r} value={r}>{roleLabels[r]?.label || r}</option>
                    ))}
                  </select>
                </div>
                {['owner', 'manager', 'attendant', 'kitchen'].includes(newRole) && (
                  <div>
                    <label className="text-sm font-medium">Restaurante</label>
                    <select value={newRestaurantId} onChange={e => setNewRestaurantId(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <option value="">Selecione...</option>
                      {restaurants.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
                <button
                  onClick={() => createUserMutation.mutate()}
                  disabled={!newEmail || !newPassword || !newName || createUserMutation.isPending}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {createUserMutation.isPending ? 'Criando...' : 'Criar usuário'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit role modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={() => setEditingUser(null)}>
            <div className="card-elevated w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold text-lg">Editar Papel</h3>
                <button onClick={() => setEditingUser(null)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">{getProfileName(editingUser.user_id)}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Papel</label>
                  <select
                    value={editingUser.role}
                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    {allRoles.map(r => (
                      <option key={r} value={r}>{roleLabels[r]?.label || r}</option>
                    ))}
                  </select>
                </div>
                {['owner', 'manager', 'attendant', 'kitchen'].includes(editingUser.role) && (
                  <div>
                    <label className="text-sm font-medium">Restaurante</label>
                    <select
                      value={editingUser.restaurant_id || ''}
                      onChange={e => setEditingUser({ ...editingUser, restaurant_id: e.target.value || null })}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Nenhum</option>
                      {restaurants.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditingUser(null)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
                <button
                  onClick={() => updateRoleMutation.mutate({ id: editingUser.id, role: editingUser.role, restaurant_id: editingUser.restaurant_id })}
                  disabled={updateRoleMutation.isPending}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {updateRoleMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ScrollReveal>
          <div className="card-elevated">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 pb-3 gap-3">
              <h3 className="font-heading font-semibold text-base">Todos os usuários</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar usuário..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm w-full sm:w-64"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-border text-muted-foreground">
                    <th className="text-left font-medium px-5 py-3">Usuário</th>
                    <th className="text-left font-medium px-5 py-3">Perfil</th>
                    <th className="text-left font-medium px-5 py-3 hidden sm:table-cell">Restaurante</th>
                    <th className="text-right font-medium px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</td></tr>
                  ) : filtered.map(u => {
                    const r = roleLabels[u.role] || { label: u.role, cls: 'bg-muted text-muted-foreground' };
                    return (
                      <tr key={u.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium">{getProfileName(u.user_id)}</p>
                          <p className="text-xs text-muted-foreground">{u.user_id.slice(0, 12)}...</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.cls}`}>{r.label}</span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{getRestaurantName(u.restaurant_id)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => setEditingUser({ ...u })}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Remover este papel do usuário?')) {
                                  deleteRoleMutation.mutate(u.id);
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </MasterLayout>
  );
}
