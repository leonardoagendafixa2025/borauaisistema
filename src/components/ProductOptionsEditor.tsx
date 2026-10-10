import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Plus, Trash2, GripVertical, Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OptionRow {
  id: string;
  dbId?: string;
  name: string;
  price: number;
  active: boolean;
  sort_order: number;
}
interface GroupRow {
  id: string;
  dbId?: string;
  name: string;
  required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  options: OptionRow[];
  collapsed?: boolean;
}

const tempId = () => `tmp_${Math.random().toString(36).slice(2, 10)}`;

const TEMPLATES: Record<string, GroupRow[]> = {
  hamburgueria: [
    {
      id: tempId(), name: 'Ponto da carne', required: true, min_selections: 1, max_selections: 1, sort_order: 0,
      options: [
        { id: tempId(), name: 'Mal passada', price: 0, active: true, sort_order: 0 },
        { id: tempId(), name: 'Ao ponto', price: 0, active: true, sort_order: 1 },
        { id: tempId(), name: 'Bem passada', price: 0, active: true, sort_order: 2 },
      ],
    },
    {
      id: tempId(), name: 'Adicionais', required: false, min_selections: 0, max_selections: 5, sort_order: 1,
      options: [
        { id: tempId(), name: 'Bacon', price: 5, active: true, sort_order: 0 },
        { id: tempId(), name: 'Cheddar extra', price: 3, active: true, sort_order: 1 },
        { id: tempId(), name: 'Ovo', price: 2, active: true, sort_order: 2 },
        { id: tempId(), name: 'Cebola caramelizada', price: 3, active: true, sort_order: 3 },
      ],
    },
    {
      id: tempId(), name: 'Remover ingredientes', required: false, min_selections: 0, max_selections: 5, sort_order: 2,
      options: [
        { id: tempId(), name: 'Sem cebola', price: 0, active: true, sort_order: 0 },
        { id: tempId(), name: 'Sem picles', price: 0, active: true, sort_order: 1 },
        { id: tempId(), name: 'Sem alface', price: 0, active: true, sort_order: 2 },
        { id: tempId(), name: 'Sem tomate', price: 0, active: true, sort_order: 3 },
      ],
    },
  ],
  acai: [
    {
      id: tempId(), name: 'Tamanho', required: true, min_selections: 1, max_selections: 1, sort_order: 0,
      options: [
        { id: tempId(), name: '300ml', price: 0, active: true, sort_order: 0 },
        { id: tempId(), name: '500ml', price: 6, active: true, sort_order: 1 },
        { id: tempId(), name: '700ml', price: 12, active: true, sort_order: 2 },
      ],
    },
    {
      id: tempId(), name: 'Frutas (até 3)', required: false, min_selections: 0, max_selections: 3, sort_order: 1,
      options: [
        { id: tempId(), name: 'Banana', price: 0, active: true, sort_order: 0 },
        { id: tempId(), name: 'Morango', price: 2, active: true, sort_order: 1 },
        { id: tempId(), name: 'Kiwi', price: 3, active: true, sort_order: 2 },
        { id: tempId(), name: 'Manga', price: 2, active: true, sort_order: 3 },
      ],
    },
    {
      id: tempId(), name: 'Complementos', required: false, min_selections: 0, max_selections: 5, sort_order: 2,
      options: [
        { id: tempId(), name: 'Granola', price: 0, active: true, sort_order: 0 },
        { id: tempId(), name: 'Leite condensado', price: 2, active: true, sort_order: 1 },
        { id: tempId(), name: 'Leite ninho', price: 3, active: true, sort_order: 2 },
        { id: tempId(), name: 'Paçoca', price: 2, active: true, sort_order: 3 },
        { id: tempId(), name: 'Nutella', price: 5, active: true, sort_order: 4 },
      ],
    },
  ],
  pizzaria: [
    {
      id: tempId(), name: 'Tamanho', required: true, min_selections: 1, max_selections: 1, sort_order: 0,
      options: [
        { id: tempId(), name: 'Pequena (4 fatias)', price: 0, active: true, sort_order: 0 },
        { id: tempId(), name: 'Média (6 fatias)', price: 10, active: true, sort_order: 1 },
        { id: tempId(), name: 'Grande (8 fatias)', price: 18, active: true, sort_order: 2 },
        { id: tempId(), name: 'Família (12 fatias)', price: 28, active: true, sort_order: 3 },
      ],
    },
    {
      id: tempId(), name: 'Borda recheada', required: false, min_selections: 0, max_selections: 1, sort_order: 1,
      options: [
        { id: tempId(), name: 'Catupiry', price: 8, active: true, sort_order: 0 },
        { id: tempId(), name: 'Cheddar', price: 8, active: true, sort_order: 1 },
        { id: tempId(), name: 'Chocolate', price: 10, active: true, sort_order: 2 },
      ],
    },
  ],
};

export interface ProductOptionsEditorRef {
  /** Persists current draft into the given productId. Returns true on success. */
  persist: (productId: string) => Promise<boolean>;
  /** True when there is at least one group/option configured. */
  hasDraft: () => boolean;
}

interface Props {
  productId: string | null; // null = creating; nothing to load from DB
}

const ProductOptionsEditor = forwardRef<ProductOptionsEditorRef, Props>(({ productId }, ref) => {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId) { setGroups([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: g } = await supabase
        .from('product_option_groups')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order');
      if (!g) { if (!cancelled) { setGroups([]); setLoading(false); } return; }
      const groupIds = g.map((x) => x.id);
      const { data: opts } = groupIds.length
        ? await supabase.from('product_options').select('*').in('group_id', groupIds).order('sort_order')
        : { data: [] as any[] };
      if (cancelled) return;
      setGroups(g.map((gr) => ({
        id: gr.id, dbId: gr.id, name: gr.name, required: gr.required,
        min_selections: gr.min_selections, max_selections: gr.max_selections, sort_order: gr.sort_order,
        options: (opts || []).filter((o: any) => o.group_id === gr.id).map((o: any) => ({
          id: o.id, dbId: o.id, name: o.name, price: Number(o.price), active: o.active, sort_order: o.sort_order,
        })),
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [productId]);

  const addGroup = () => setGroups((gs) => [...gs, {
    id: tempId(), name: '', required: false, min_selections: 0, max_selections: 1,
    sort_order: gs.length, options: [], collapsed: false,
  }]);

  const updateGroup = (id: string, patch: Partial<GroupRow>) =>
    setGroups((gs) => gs.map((g) => g.id === id ? { ...g, ...patch } : g));

  const removeGroup = (id: string) => setGroups((gs) => gs.filter((g) => g.id !== id));

  const addOption = (groupId: string) => updateGroup(groupId, {
    options: [
      ...(groups.find((g) => g.id === groupId)?.options || []),
      { id: tempId(), name: '', price: 0, active: true, sort_order: (groups.find((g) => g.id === groupId)?.options.length || 0) },
    ],
  });

  const updateOption = (groupId: string, optId: string, patch: Partial<OptionRow>) => {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    updateGroup(groupId, { options: g.options.map((o) => o.id === optId ? { ...o, ...patch } : o) });
  };

  const removeOption = (groupId: string, optId: string) => {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    updateGroup(groupId, { options: g.options.filter((o) => o.id !== optId) });
  };

  const applyTemplate = (key: keyof typeof TEMPLATES) => {
    const tmpl = TEMPLATES[key].map((g) => ({
      ...g, id: tempId(), dbId: undefined,
      options: g.options.map((o) => ({ ...o, id: tempId(), dbId: undefined })),
    }));
    setGroups((cur) => [...cur, ...tmpl.map((g, i) => ({ ...g, sort_order: cur.length + i }))]);
    toast.success(`Template "${key}" aplicado.`);
  };

  // Validation shared by persist
  const validate = (): string | null => {
    for (const g of groups) {
      if (!g.name.trim()) return 'Todos os grupos precisam de nome';
      if (g.max_selections < g.min_selections) return `Grupo "${g.name}": máx deve ser ≥ mín`;
      if (g.options.length === 0) return `Grupo "${g.name}": adicione ao menos 1 opção`;
      for (const o of g.options) {
        if (!o.name.trim()) return `Grupo "${g.name}": opção sem nome`;
      }
    }
    return null;
  };

  // Imperative handle: parent calls persist(productId) inside its own save flow.
  useImperativeHandle(ref, () => ({
    hasDraft: () => groups.length > 0,
    persist: async (pid: string) => {
      if (groups.length === 0) {
        // Nothing to persist; if editing, still wipe existing groups.
        if (productId) {
          const { data: existingGroups } = await supabase
            .from('product_option_groups').select('id').eq('product_id', pid);
          const ids = (existingGroups || []).map((x: any) => x.id);
          if (ids.length) {
            await supabase.from('product_options').delete().in('group_id', ids);
            await supabase.from('product_option_groups').delete().in('id', ids);
          }
        }
        return true;
      }
      const err = validate();
      if (err) { toast.error(err); return false; }
      try {
        const { data: existingGroups } = await supabase
          .from('product_option_groups').select('id').eq('product_id', pid);
        const existingIds = new Set((existingGroups || []).map((x: any) => x.id));
        const keepGroupIds = new Set(groups.filter((g) => g.dbId).map((g) => g.dbId!));
        const toDelete = [...existingIds].filter((id) => !keepGroupIds.has(id));

        if (toDelete.length) {
          await supabase.from('product_options').delete().in('group_id', toDelete);
          await supabase.from('product_option_groups').delete().in('id', toDelete);
        }

        for (let gi = 0; gi < groups.length; gi++) {
          const g = groups[gi];
          let groupDbId = g.dbId;
          const groupPayload = {
            product_id: pid, name: g.name.trim(), required: g.required,
            min_selections: g.min_selections, max_selections: g.max_selections, sort_order: gi,
          };
          if (groupDbId) {
            await supabase.from('product_option_groups').update(groupPayload).eq('id', groupDbId);
          } else {
            const { data: ins, error } = await supabase
              .from('product_option_groups').insert(groupPayload).select('id').single();
            if (error || !ins) throw error;
            groupDbId = ins.id;
          }
          const { data: existingOpts } = await supabase
            .from('product_options').select('id').eq('group_id', groupDbId);
          const keepOptIds = new Set(g.options.filter((o) => o.dbId).map((o) => o.dbId!));
          const optsToDelete = (existingOpts || []).map((x: any) => x.id).filter((id: string) => !keepOptIds.has(id));
          if (optsToDelete.length) await supabase.from('product_options').delete().in('id', optsToDelete);

          for (let oi = 0; oi < g.options.length; oi++) {
            const o = g.options[oi];
            const optPayload = {
              group_id: groupDbId, name: o.name.trim(), price: Number(o.price) || 0,
              active: o.active, sort_order: oi,
            };
            if (o.dbId) await supabase.from('product_options').update(optPayload).eq('id', o.dbId);
            else await supabase.from('product_options').insert(optPayload);
          }
        }
        return true;
      } catch (err: any) {
        toast.error('Erro ao salvar opcionais: ' + (err?.message || 'desconhecido'));
        return false;
      }
    },
  }), [groups, productId]);

  return (
    <div className="space-y-4">
      {/* Templates */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Templates rápidos</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => applyTemplate('hamburgueria')}
            className="rounded-full bg-background border border-border px-3 py-1 text-xs font-medium hover:bg-muted">
            🍔 Hamburgueria
          </button>
          <button type="button" onClick={() => applyTemplate('acai')}
            className="rounded-full bg-background border border-border px-3 py-1 text-xs font-medium hover:bg-muted">
            🍇 Açaí
          </button>
          <button type="button" onClick={() => applyTemplate('pizzaria')}
            className="rounded-full bg-background border border-border px-3 py-1 text-xs font-medium hover:bg-muted">
            🍕 Pizzaria
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Os opcionais são salvos junto com o produto ao clicar em <span className="font-semibold">Salvar produto</span>.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando opcionais...
        </div>
      )}

      {/* Grupos */}
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.id} className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                value={g.name}
                onChange={(e) => updateGroup(g.id, { name: e.target.value })}
                placeholder="Nome do grupo (ex: Ponto da carne, Adicionais)"
                className="flex-1 bg-transparent border-0 outline-none text-sm font-semibold placeholder:text-muted-foreground/60"
              />
              <button type="button" onClick={() => updateGroup(g.id, { collapsed: !g.collapsed })}
                className="p-1 rounded hover:bg-muted" aria-label="Colapsar grupo">
                {g.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => removeGroup(g.id)}
                className="p-1 rounded hover:bg-destructive/10 text-destructive" aria-label="Excluir grupo">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {!g.collapsed && (
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={g.required}
                      onChange={(e) => updateGroup(g.id, { required: e.target.checked, min_selections: e.target.checked ? Math.max(1, g.min_selections) : 0 })}
                      className="rounded" />
                    Obrigatório
                  </label>
                  <label className="flex items-center gap-1">
                    Mín
                    <input type="number" min={0} value={g.min_selections}
                      onChange={(e) => updateGroup(g.id, { min_selections: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-14 rounded border border-input bg-background px-2 py-1 text-xs" />
                  </label>
                  <label className="flex items-center gap-1">
                    Máx
                    <input type="number" min={1} value={g.max_selections}
                      onChange={(e) => updateGroup(g.id, { max_selections: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-14 rounded border border-input bg-background px-2 py-1 text-xs" />
                  </label>
                </div>

                <div className="space-y-1.5">
                  {g.options.map((o) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <input
                        value={o.name}
                        onChange={(e) => updateOption(g.id, o.id, { name: e.target.value })}
                        placeholder="Nome da opção"
                        className="flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">+R$</span>
                        <input type="number" step="0.01" min={0} value={o.price}
                          onChange={(e) => updateOption(g.id, o.id, { price: parseFloat(e.target.value) || 0 })}
                          className="w-20 rounded border border-input bg-background px-2 py-1.5 text-sm" />
                      </div>
                      <button type="button" onClick={() => removeOption(g.id, o.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-destructive shrink-0" aria-label="Remover opção">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addOption(g.id)}
                    className="w-full rounded border border-dashed border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    + Adicionar opção
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        <button type="button" onClick={addGroup}
          className="w-full rounded-lg border border-dashed border-primary/40 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" /> Adicionar grupo de opções
        </button>
      </div>
    </div>
  );
});

ProductOptionsEditor.displayName = 'ProductOptionsEditor';
export default ProductOptionsEditor;
