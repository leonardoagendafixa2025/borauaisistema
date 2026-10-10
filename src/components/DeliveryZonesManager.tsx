import { useState } from 'react';
import { Plus, Edit2, Trash2, MapPin, ToggleLeft, ToggleRight } from 'lucide-react';
import { useRestaurantDeliveryZones } from '@/hooks/useRestaurantData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ZoneForm {
  neighborhood: string;
  city: string;
  delivery_fee: string;
  min_order_value: string;
  estimated_time: string;
  active: boolean;
}
const empty: ZoneForm = { neighborhood: '', city: '', delivery_fee: '0', min_order_value: '0', estimated_time: '45', active: true };

export default function DeliveryZonesManager() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const { data: zones = [], isLoading } = useRestaurantDeliveryZones();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ZoneForm>(empty);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (z: any) => {
    setEditing(z.id);
    setForm({
      neighborhood: z.neighborhood, city: z.city || '',
      delivery_fee: String(z.delivery_fee), min_order_value: String(z.min_order_value || 0),
      estimated_time: String(z.estimated_time || 45), active: z.active,
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.neighborhood.trim()) { toast.error('Informe o bairro'); return; }
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim() || null,
      delivery_fee: Number(form.delivery_fee) || 0,
      min_order_value: Number(form.min_order_value) || 0,
      estimated_time: Number(form.estimated_time) || 45,
      active: form.active,
    };
    const { error } = editing
      ? await (supabase as any).from('delivery_zones').update(payload).eq('id', editing)
      : await (supabase as any).from('delivery_zones').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'Bairro atualizado' : 'Bairro adicionado');
    qc.invalidateQueries({ queryKey: ['delivery_zones'] });
    setOpen(false);
  };

  const toggleActive = async (z: any) => {
    await (supabase as any).from('delivery_zones').update({ active: !z.active }).eq('id', z.id);
    qc.invalidateQueries({ queryKey: ['delivery_zones'] });
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este bairro?')) return;
    await (supabase as any).from('delivery_zones').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['delivery_zones'] });
    toast.success('Bairro removido');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold">Áreas de Entrega</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Cadastre bairros atendidos com taxa e tempo próprios. Se vazio, usa a taxa padrão da aba Entrega.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Adicionar bairro
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
      ) : zones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum bairro cadastrado.</p>
          <p className="text-xs text-muted-foreground mt-1">Sem bairros, usa a taxa padrão para qualquer endereço.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zones.map((z: any) => (
            <div key={z.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <button onClick={() => toggleActive(z)} className="shrink-0">
                {z.active ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{z.neighborhood}{z.city ? ` — ${z.city}` : ''}</p>
                <p className="text-xs text-muted-foreground">
                  Taxa R$ {Number(z.delivery_fee).toFixed(2).replace('.', ',')} · {z.estimated_time}min
                  {Number(z.min_order_value) > 0 && ` · Mín R$ ${Number(z.min_order_value).toFixed(2).replace('.', ',')}`}
                </p>
              </div>
              <button onClick={() => openEdit(z)} className="p-2 rounded-lg hover:bg-muted"><Edit2 className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(z.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar bairro' : 'Novo bairro'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium">Bairro *</label>
              <input value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} required
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Ex: Savassi" />
            </div>
            <div>
              <label className="text-xs font-medium">Cidade</label>
              <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Ex: Belo Horizonte" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium">Taxa (R$)</label>
                <input type="number" step="0.01" value={form.delivery_fee} onChange={e => setForm({ ...form, delivery_fee: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Mín pedido</label>
                <input type="number" step="0.01" value={form.min_order_value} onChange={e => setForm({ ...form, min_order_value: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Tempo (min)</label>
                <input type="number" value={form.estimated_time} onChange={e => setForm({ ...form, estimated_time: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
              Ativo
            </label>
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
