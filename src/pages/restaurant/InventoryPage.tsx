import { useState } from 'react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Package, Plus, Pencil, Trash2, Link2, Unlink } from 'lucide-react';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const unitOptions = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'dz'];

interface ItemForm {
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
  supplier: string;
}

const emptyForm: ItemForm = { name: '', unit: 'un', current_stock: 0, min_stock: 0, cost_per_unit: 0, supplier: '' };

export default function InventoryPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkItem, setLinkItem] = useState<any>(null);
  const [tab, setTab] = useState<'all' | 'low'>('all');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory', restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .eq('active', true)
        .order('name');
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-inventory', restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name')
        .eq('restaurant_id', restaurantId!)
        .eq('active', true)
        .order('name');
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const { data: productIngredients = [] } = useQuery({
    queryKey: ['product_ingredients', restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_ingredients')
        .select('*, products(name), inventory_items(name, restaurant_id)')
        .order('created_at');
      // Filter by restaurant
      return (data || []).filter((pi: any) => pi.inventory_items?.restaurant_id === restaurantId);
    },
    enabled: !!restaurantId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inventory', restaurantId] });
    qc.invalidateQueries({ queryKey: ['product_ingredients', restaurantId] });
  };

  const sendTelegramAlert = async () => {
    try {
      await supabase.functions.invoke('telegram-stock-alert', {
        body: { restaurant_id: restaurantId },
      });
    } catch {
      // silent — alert is best-effort
    }
  };

  const lowStockItems = items.filter((i: any) => i.current_stock <= i.min_stock);
  const displayed = tab === 'low' ? lowStockItems : items;

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      name: item.name,
      unit: item.unit,
      current_stock: item.current_stock,
      min_stock: item.min_stock,
      cost_per_unit: item.cost_per_unit,
      supplier: item.supplier || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (editing) {
      const { error } = await supabase.from('inventory_items').update({
        name: form.name,
        unit: form.unit,
        current_stock: form.current_stock,
        min_stock: form.min_stock,
        cost_per_unit: form.cost_per_unit,
        supplier: form.supplier || null,
      }).eq('id', editing.id);
      if (error) {
        toast.error('Erro ao atualizar insumo: ' + error.message);
        return;
      }
      toast.success('Insumo atualizado!');
    } else {
      const { error } = await supabase.from('inventory_items').insert({
        restaurant_id: restaurantId!,
        name: form.name,
        unit: form.unit,
        current_stock: form.current_stock,
        min_stock: form.min_stock,
        cost_per_unit: form.cost_per_unit,
        supplier: form.supplier || null,
      });
      if (error) {
        toast.error('Erro ao cadastrar insumo: ' + error.message);
        return;
      }
      toast.success('Insumo cadastrado!');
    }
    setDialogOpen(false);
    invalidate();
    sendTelegramAlert();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('inventory_items').update({ active: false } as any).eq('id', id);
    if (error) {
      toast.error('Erro ao remover insumo: ' + error.message);
      return;
    }
    toast.success('Insumo removido');
    invalidate();
  };

  const handleAddStock = async (item: any) => {
    const qty = prompt(`Adicionar estoque de "${item.name}" (${item.unit}):`);
    if (!qty || isNaN(Number(qty))) return;
    const { error } = await supabase.from('inventory_items').update({
      current_stock: item.current_stock + Number(qty),
    }).eq('id', item.id);
    if (error) {
      toast.error('Erro ao atualizar estoque: ' + error.message);
      return;
    }
    toast.success(`+${qty} ${item.unit} adicionado`);
    invalidate();
    sendTelegramAlert();
  };

  // Link product to ingredient
  const openLink = (item: any) => { setLinkItem(item); setLinkDialogOpen(true); };

  const linkedProducts = linkItem
    ? productIngredients.filter((pi: any) => pi.inventory_item_id === linkItem?.id)
    : [];

  const unlinkedProducts = linkItem
    ? products.filter((p: any) => !linkedProducts.some((lp: any) => lp.product_id === p.id))
    : [];

  const linkProduct = async (productId: string) => {
    const qtyStr = prompt('Quantidade usada por unidade do produto:');
    if (!qtyStr || isNaN(Number(qtyStr))) return;
    const { error } = await supabase.from('product_ingredients').insert({
      product_id: productId,
      inventory_item_id: linkItem.id,
      quantity_used: Number(qtyStr),
    });
    if (error) {
      toast.error('Erro ao vincular produto: ' + error.message);
      return;
    }
    toast.success('Produto vinculado!');
    invalidate();
  };

  const unlinkProduct = async (piId: string) => {
    const { error } = await supabase.from('product_ingredients').delete().eq('id', piId);
    if (error) {
      toast.error('Erro ao desvincular produto: ' + error.message);
      return;
    }
    toast.success('Vínculo removido');
    invalidate();
  };

  const totalValue = items.reduce((s: number, i: any) => s + (i.current_stock * i.cost_per_unit), 0);

  return (
    <RestaurantLayout>
      <div className="space-y-4">
        <ScrollReveal>
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-2xl font-bold">Estoque</h1>
            <button onClick={openNew} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
              <Plus className="h-4 w-4" /> Novo Insumo
            </button>
          </div>
        </ScrollReveal>

        {/* KPIs */}
        <ScrollReveal delay={60}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card-elevated p-4 text-center">
              <p className="text-xs text-muted-foreground">Total Insumos</p>
              <p className="font-heading text-xl font-bold">{items.length}</p>
            </div>
            <div className="card-elevated p-4 text-center">
              <p className="text-xs text-muted-foreground">Estoque Baixo</p>
              <p className="font-heading text-xl font-bold text-destructive">{lowStockItems.length}</p>
            </div>
            <div className="card-elevated p-4 text-center">
              <p className="text-xs text-muted-foreground">Valor em Estoque</p>
              <p className="font-heading text-xl font-bold">{fmt(totalValue)}</p>
            </div>
            <div className="card-elevated p-4 text-center">
              <p className="text-xs text-muted-foreground">Produtos Vinculados</p>
              <p className="font-heading text-xl font-bold">{new Set(productIngredients.map((pi: any) => pi.product_id)).size}</p>
            </div>
          </div>
        </ScrollReveal>

        {/* Tabs */}
        <ScrollReveal delay={90}>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {[
              { key: 'all' as const, label: 'Todos' },
              { key: 'low' as const, label: `⚠️ Estoque Baixo (${lowStockItems.length})` },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-all ${
                  tab === t.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </ScrollReveal>

        {/* Items list */}
        <ScrollReveal delay={120}>
          {isLoading ? (
            <div className="card-elevated p-12 text-center text-muted-foreground">Carregando...</div>
          ) : displayed.length === 0 ? (
            <div className="card-elevated p-12 text-center text-muted-foreground">
              {tab === 'low' ? 'Nenhum insumo com estoque baixo 🎉' : 'Nenhum insumo cadastrado'}
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map((item: any) => {
                const isLow = item.current_stock <= item.min_stock;
                const linked = productIngredients.filter((pi: any) => pi.inventory_item_id === item.id);
                return (
                  <div key={item.id} className={`card-elevated p-3 sm:p-4 transition-all ${isLow ? 'ring-1 ring-destructive/30' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading font-bold text-sm sm:text-base">{item.name}</span>
                          {isLow && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                              <AlertTriangle className="h-3 w-3" /> Baixo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.current_stock} {item.unit} (mín: {item.min_stock}) · Custo: {fmt(item.cost_per_unit)}/{item.unit}
                          {item.supplier && ` · ${item.supplier}`}
                        </p>
                        {linked.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            🔗 {linked.map((l: any) => l.products?.name).filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleAddStock(item)} className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors" title="Adicionar estoque">
                          <Package className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openLink(item)} className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors" title="Vincular produtos">
                          <Link2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openEdit(item)} className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors" title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="rounded-lg border border-destructive/30 p-1.5 hover:bg-destructive/5 transition-colors text-destructive" title="Remover">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollReveal>
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Insumo' : 'Novo Insumo'}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Ex: Farinha de trigo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Unidade</label>
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Custo/unidade (R$)</label>
                <input type="number" step="0.01" value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: Number(e.target.value) })}
                  className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Estoque Atual</label>
                <input type="number" step="0.01" value={form.current_stock} onChange={e => setForm({ ...form, current_stock: Number(e.target.value) })}
                  className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Estoque Mínimo</label>
                <input type="number" step="0.01" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: Number(e.target.value) })}
                  className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fornecedor</label>
              <input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Opcional" />
            </div>
            <button onClick={handleSave} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
              {editing ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link products dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Vincular Produtos — {linkItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
            {linkedProducts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Vinculados</p>
                {linkedProducts.map((pi: any) => (
                  <div key={pi.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-sm">{pi.products?.name} <span className="text-muted-foreground">({pi.quantity_used} {linkItem?.unit}/un)</span></span>
                    <button onClick={() => unlinkProduct(pi.id)} className="text-destructive hover:bg-destructive/5 rounded p-1">
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {unlinkedProducts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Disponíveis para vincular</p>
                {unlinkedProducts.map((p: any) => (
                  <button key={p.id} onClick={() => linkProduct(p.id)}
                    className="w-full text-left flex items-center justify-between py-1.5 border-b border-border last:border-0 hover:bg-muted/50 px-2 rounded transition-colors">
                    <span className="text-sm">{p.name}</span>
                    <Plus className="h-3.5 w-3.5 text-primary" />
                  </button>
                ))}
              </div>
            )}
            {unlinkedProducts.length === 0 && linkedProducts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto cadastrado</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </RestaurantLayout>
  );
}
