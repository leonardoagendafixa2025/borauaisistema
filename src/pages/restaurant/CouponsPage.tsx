import { Plus, Search, Edit2, Trash2, Loader2, Lock } from 'lucide-react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { useState } from 'react';
import { useRestaurantCoupons } from '@/hooks/useRestaurantData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

interface CouponForm {
  code: string;
  description: string;
  discount_type: 'percent' | 'fixed';
  discount_value: string;
  min_order_value: string;
  max_uses: string;
  valid_until: string;
  active: boolean;
}

const emptyForm: CouponForm = {
  code: '', description: '', discount_type: 'percent', discount_value: '',
  min_order_value: '', max_uses: '', valid_until: '', active: true,
};

export default function CouponsPage() {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: coupons = [], isLoading } = useRestaurantCoupons();
  const plan = usePlanFeatures();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string } | null>(null);

  const filtered = coupons.filter(c => c.code.toLowerCase().includes(search.toLowerCase()));
  const activeCoupons = coupons.filter(c => c.active).length;
  const totalUses = coupons.reduce((s, c) => s + c.used_count, 0);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['coupons', restaurantId] });

  const openNew = () => {
    if (coupons.length >= plan.maxCoupons) {
      toast.error(`Limite de ${plan.maxCoupons} cupons atingido no plano ${plan.planName}. Faça upgrade para criar mais.`);
      return;
    }
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      description: c.description || '',
      discount_type: c.discount_type as 'percent' | 'fixed',
      discount_value: String(c.discount_value),
      min_order_value: c.min_order_value ? String(c.min_order_value) : '',
      max_uses: c.max_uses ? String(c.max_uses) : '',
      valid_until: c.valid_until ? new Date(c.valid_until).toISOString().split('T')[0] : '',
      active: c.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!restaurantId || !form.code.trim() || !form.discount_value) {
      toast.error('Preencha código e valor do desconto');
      return;
    }
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_order_value: form.min_order_value ? parseFloat(form.min_order_value) : 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      valid_until: form.valid_until ? new Date(form.valid_until + 'T23:59:59').toISOString() : null,
      active: form.active,
    };

    if (editingId) {
      const { error } = await supabase.from('coupons').update(payload).eq('id', editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Cupom atualizado');
    } else {
      const { error } = await supabase.from('coupons').insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Cupom criado');
    }
    setSaving(false);
    setDialogOpen(false);
    invalidate();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('coupons').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(error.message); } else { toast.success('Cupom excluído'); }
    setDeleteTarget(null);
    invalidate();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('coupons').update({ active: !current }).eq('id', id);
    invalidate();
    toast.success(current ? 'Cupom desativado' : 'Cupom ativado');
  };

  const inputClass = 'w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm';

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold">Cupons</h1>
              <p className="text-sm text-muted-foreground">Gerencie cupons de desconto</p>
            </div>
            <button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Novo cupom
            </button>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Cupons ativos', value: activeCoupons },
              { label: 'Total de usos', value: totalUses },
              { label: 'Total de cupons', value: coupons.length },
              { label: 'Expirados', value: coupons.filter(c => !c.active).length },
            ].map((s, i) => (
              <div key={i} className="card-elevated p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-heading font-bold mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="card-elevated">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 pb-3 gap-3">
              <h3 className="font-heading font-semibold text-base">Todos os cupons</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Buscar cupom..." value={search} onChange={e => setSearch(e.target.value)}
                  className="rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm w-full sm:w-64" />
              </div>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhum cupom encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-border text-muted-foreground">
                      <th className="text-left font-medium px-5 py-3">Código</th>
                      <th className="text-left font-medium px-5 py-3 hidden sm:table-cell">Desconto</th>
                      <th className="text-left font-medium px-5 py-3">Status</th>
                      <th className="text-right font-medium px-5 py-3 hidden md:table-cell">Usos</th>
                      <th className="text-right font-medium px-5 py-3 hidden lg:table-cell">Validade</th>
                      <th className="text-right font-medium px-5 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3">
                          <div>
                            <p className="font-mono font-bold text-primary">{c.code}</p>
                            <p className="text-xs text-muted-foreground">{c.description}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3 hidden sm:table-cell">
                          <span className="text-muted-foreground">
                            {c.discount_type === 'percent' ? `${c.discount_value}%` : fmt(Number(c.discount_value))}
                          </span>
                          {Number(c.min_order_value) > 0 && <p className="text-xs text-muted-foreground">Mín: {fmt(Number(c.min_order_value))}</p>}
                        </td>
                        <td className="px-5 py-3">
                          <button onClick={() => toggleActive(c.id, c.active)}
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                              c.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                            }`}>
                            {c.active ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums hidden md:table-cell">
                          {c.used_count}{c.max_uses ? `/${c.max_uses}` : ''}
                        </td>
                        <td className="px-5 py-3 text-right text-muted-foreground hidden lg:table-cell">
                          {c.valid_until ? new Date(c.valid_until).toLocaleDateString('pt-BR') : 'Sem limite'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Editar">
                              <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => setDeleteTarget({ id: c.id, code: c.code })} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Excluir">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Cupom' : 'Novo Cupom'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium">Código *</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="Ex: PROMO10" className={inputClass} maxLength={30} />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: 10% off na primeira compra" className={inputClass} maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Tipo de desconto</label>
                <select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'percent' | 'fixed' }))}
                  className={inputClass}>
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Valor do desconto *</label>
                <input type="number" step="0.01" value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                  placeholder={form.discount_type === 'percent' ? 'Ex: 10' : 'Ex: 5.00'} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Pedido mínimo (R$)</label>
                <input type="number" step="0.01" value={form.min_order_value}
                  onChange={e => setForm(f => ({ ...f, min_order_value: e.target.value }))}
                  placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium">Máx. de usos</label>
                <input type="number" value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                  placeholder="Ilimitado" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Válido até</label>
              <input type="date" value={form.valid_until}
                onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                className={inputClass} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="coupon-active" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="rounded border-border" />
              <label htmlFor="coupon-active" className="text-sm font-medium">Cupom ativo</label>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : editingId ? 'Salvar alterações' : 'Criar cupom'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              O cupom <strong>{deleteTarget?.code}</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RestaurantLayout>
  );
}
