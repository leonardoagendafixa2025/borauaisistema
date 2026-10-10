import { useState } from 'react';
import { Plus, Edit2, Trash2, Package, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { useRestaurantCombos, useRestaurantProducts } from '@/hooks/useRestaurantData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ComboItem { product_id: string; quantity: number; }
interface ComboForm {
  name: string; description: string; price: string; image_url: string;
  active: boolean; featured: boolean; items: ComboItem[];
}
const empty: ComboForm = { name: '', description: '', price: '', image_url: '', active: true, featured: false, items: [] };

export default function CombosManager() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const { data: combos = [], isLoading } = useRestaurantCombos();
  const { data: products = [] } = useRestaurantProducts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ComboForm>(empty);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: any) => {
    setEditing(c.id);
    setForm({
      name: c.name, description: c.description || '', price: String(c.price),
      image_url: c.image_url || '', active: c.active, featured: c.featured,
      items: (c.product_combo_items || []).map((it: any) => ({ product_id: it.product_id, quantity: it.quantity })),
    });
    setOpen(true);
  };

  const addItem = () => {
    if (products.length === 0) { toast.error('Cadastre produtos primeiro'); return; }
    setForm({ ...form, items: [...form.items, { product_id: products[0].id, quantity: 1 }] });
  };
  const updateItem = (idx: number, patch: Partial<ComboItem>) => {
    const next = [...form.items]; next[idx] = { ...next[idx], ...patch }; setForm({ ...form, items: next });
  };
  const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome'); return; }
    if (form.items.length === 0) { toast.error('Adicione ao menos 1 produto ao combo'); return; }
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price) || 0,
      image_url: form.image_url.trim() || null,
      active: form.active,
      featured: form.featured,
    };
    let comboId = editing;
    if (editing) {
      const { error } = await (supabase as any).from('product_combos').update(payload).eq('id', editing);
      if (error) { setSaving(false); toast.error(error.message); return; }
      await (supabase as any).from('product_combo_items').delete().eq('combo_id', editing);
    } else {
      const { data, error } = await (supabase as any).from('product_combos').insert(payload).select('id').single();
      if (error) { setSaving(false); toast.error(error.message); return; }
      comboId = data.id;
    }
    if (comboId && form.items.length > 0) {
      const items = form.items.map(it => ({ combo_id: comboId, product_id: it.product_id, quantity: it.quantity }));
      await (supabase as any).from('product_combo_items').insert(items);
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ['combos'] });
    qc.invalidateQueries({ queryKey: ['public-combos'] });
    toast.success(editing ? 'Combo atualizado' : 'Combo criado');
    setOpen(false);
  };

  const toggleActive = async (c: any) => {
    await (supabase as any).from('product_combos').update({ active: !c.active }).eq('id', c.id);
    qc.invalidateQueries({ queryKey: ['combos'] });
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este combo?')) return;
    await (supabase as any).from('product_combos').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['combos'] });
    toast.success('Combo removido');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold">Combos & Promoções</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Crie combos com produtos do cardápio por preço fixo. Aparecem em destaque para o cliente.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Novo combo
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
      ) : combos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum combo criado ainda.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {combos.map((c: any) => (
            <div key={c.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start gap-3">
                <button onClick={() => toggleActive(c)} className="shrink-0 mt-0.5">
                  {c.active ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{c.name}</p>
                    {c.featured && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Destaque</span>}
                  </div>
                  <p className="font-heading font-bold text-primary mt-0.5">{fmt(Number(c.price))}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(c.product_combo_items || []).map((it: any) => `${it.quantity}x ${it.products?.name || '?'}`).join(' + ')}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-muted"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar combo' : 'Novo combo'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium">Nome *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Combo Família" />
            </div>
            <div>
              <label className="text-xs font-medium">Descrição</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" placeholder="2 hambúrgueres + batata + 2 refris" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Preço fixo (R$) *</label>
                <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Imagem (URL)</label>
                <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="https://..." />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Ativo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} /> Em destaque
              </label>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Produtos do combo</p>
                <button type="button" onClick={addItem} className="text-xs text-primary font-semibold inline-flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {form.items.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum produto. Clique em "Adicionar".</p>}
                {form.items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="number" min="1" value={it.quantity} onChange={e => updateItem(idx, { quantity: Number(e.target.value) || 1 })}
                      className="w-16 rounded-lg border border-border bg-background px-2 py-2 text-sm" />
                    <select value={it.product_id} onChange={e => updateItem(idx, { product_id: e.target.value })}
                      className="flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm">
                      {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {fmt(Number(p.price))}</option>)}
                    </select>
                    <button type="button" onClick={() => removeItem(idx)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar combo'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
