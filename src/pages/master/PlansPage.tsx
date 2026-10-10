import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MasterLayout from '@/components/layout/MasterLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type Plan = {
  id: string;
  name: string;
  tier: 'basic' | 'professional' | 'premium';
  price: number;
  description: string | null;
  max_users: number;
  max_coupons: number;
  advanced_reports: boolean;
  visual_customization: boolean;
  custom_domain: boolean;
  active: boolean;
  features: any;
};

const emptyPlan: Partial<Plan> = {
  name: '',
  tier: 'basic',
  price: 0,
  description: '',
  max_users: 1,
  max_coupons: 5,
  advanced_reports: false,
  visual_customization: false,
  custom_domain: false,
  active: true,
};

export default function PlansPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['master-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price', { ascending: true });
      if (error) throw error;
      return data as Plan[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (plan: Partial<Plan>) => {
      if (plan.id) {
        const { error } = await supabase.from('subscription_plans').update({
          name: plan.name,
          tier: plan.tier,
          price: plan.price,
          description: plan.description,
          max_users: plan.max_users,
          max_coupons: plan.max_coupons,
          advanced_reports: plan.advanced_reports,
          visual_customization: plan.visual_customization,
          custom_domain: plan.custom_domain,
          active: plan.active,
        }).eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subscription_plans').insert({
          name: plan.name!,
          tier: plan.tier!,
          price: plan.price ?? 0,
          description: plan.description,
          max_users: plan.max_users ?? 1,
          max_coupons: plan.max_coupons ?? 5,
          advanced_reports: plan.advanced_reports ?? false,
          visual_customization: plan.visual_customization ?? false,
          custom_domain: plan.custom_domain ?? false,
          active: plan.active ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['master-plans'] });
      setOpen(false);
      setEditing(null);
      toast({ title: 'Plano salvo', description: 'As alterações foram aplicadas.' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subscription_plans').update({ active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['master-plans'] });
      toast({ title: 'Plano desativado' });
    },
  });

  return (
    <MasterLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold">Planos da Plataforma</h1>
            <p className="text-sm text-muted-foreground">Gerencie preços, limites e funcionalidades de cada plano SaaS.</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(emptyPlan)}><Plus className="h-4 w-4 mr-1" />Novo Plano</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing?.id ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
              </DialogHeader>
              {editing && (
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tier</Label>
                      <Select value={editing.tier} onValueChange={(v) => setEditing({ ...editing, tier: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Básico</SelectItem>
                          <SelectItem value="professional">Profissional</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Preço (R$/mês)</Label>
                      <Input type="number" step="0.01" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Máx. usuários</Label>
                      <Input type="number" value={editing.max_users ?? 1} onChange={(e) => setEditing({ ...editing, max_users: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Máx. cupons</Label>
                      <Input type="number" value={editing.max_coupons ?? 5} onChange={(e) => setEditing({ ...editing, max_coupons: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm">Relatórios avançados</span>
                      <Switch checked={!!editing.advanced_reports} onCheckedChange={(v) => setEditing({ ...editing, advanced_reports: v })} />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm">Customização visual</span>
                      <Switch checked={!!editing.visual_customization} onCheckedChange={(v) => setEditing({ ...editing, visual_customization: v })} />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm">Domínio personalizado</span>
                      <Switch checked={!!editing.custom_domain} onCheckedChange={(v) => setEditing({ ...editing, custom_domain: v })} />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm">Ativo</span>
                      <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                    </label>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => editing && saveMutation.mutate(editing)} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className={!plan.active ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                    </div>
                    <Badge variant={plan.active ? 'default' : 'secondary'}>{plan.tier}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-3xl font-bold">R$ {Number(plan.price).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                  {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
                  <ul className="space-y-1 text-sm">
                    <li>👥 {plan.max_users} usuário(s)</li>
                    <li>🎟️ {plan.max_coupons} cupons</li>
                    <li>{plan.advanced_reports ? '✅' : '❌'} Relatórios avançados</li>
                    <li>{plan.visual_customization ? '✅' : '❌'} Customização visual</li>
                    <li>{plan.custom_domain ? '✅' : '❌'} Domínio próprio</li>
                  </ul>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(plan); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                    </Button>
                    {plan.active && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(plan.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" />Desativar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MasterLayout>
  );
}
