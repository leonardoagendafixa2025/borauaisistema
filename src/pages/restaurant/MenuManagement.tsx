import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, Edit2, ToggleLeft, ToggleRight, Trash2, Upload, ChevronDown, ChevronRight, FolderTree, Sparkles, MoreVertical, X } from 'lucide-react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { useRestaurantCategories, useRestaurantProducts } from '@/hooks/useRestaurantData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ProductOptionsEditor, { type ProductOptionsEditorRef } from '@/components/ProductOptionsEditor';
import CombosManager from '@/components/CombosManager';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

interface ProductForm {
  name: string; description: string; price: string; promo_price: string;
  category_id: string; featured: boolean; active: boolean; sold_out: boolean; image_url: string;
}
const emptyForm: ProductForm = { name: '', description: '', price: '', promo_price: '', category_id: '', featured: false, active: true, sold_out: false, image_url: '' };

interface CategoryForm { name: string; description: string; active: boolean; skip_kitchen: boolean; parent_id: string | null; }
const emptyCatForm: CategoryForm = { name: '', description: '', active: true, skip_kitchen: false, parent_id: null };

export default function MenuManagement() {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: categories = [] } = useRestaurantCategories();
  const { data: products = [], isLoading } = useRestaurantProducts();
  const plan = usePlanFeatures();

  // Tree expand/collapse
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (id: string) => setCollapsed(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkActionTarget, setBulkActionTarget] = useState<string>('');

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const clearSelection = () => setSelected(new Set());

  // Product dialog
  const [productOpen, setProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const optionsRef = useRef<ProductOptionsEditorRef>(null);

  const DRAFT_STORAGE_KEY = restaurantId ? `borauai_product_draft_${restaurantId}` : 'borauai_product_draft';

  // Auto-save draft in sessionStorage when typing a new product (survives tab switches, minimizing and accidental refreshes)
  useEffect(() => {
    if (productOpen && !editingProduct) {
      const hasContent = !!(form.name.trim() || form.price || form.description.trim() || form.image_url || form.promo_price);
      if (hasContent) {
        try {
          sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
        } catch {}
      }
    }
  }, [form, productOpen, editingProduct, DRAFT_STORAGE_KEY]);

  const discardDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setForm(emptyForm);
    setIsDraftRestored(false);
    toast.info('Rascunho de produto descartado.');
  };

  // Category dialog
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCatForm);
  const [catSaving, setCatSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'product' | 'category' | 'bulk'; id?: string; name?: string; count?: number } | null>(null);

  // Build tree structure
  const tree = useMemo(() => {
    const cats = categories as any[];
    const roots = cats.filter(c => !c.parent_id);
    const childrenOf = (parentId: string) => cats.filter(c => c.parent_id === parentId);
    const productsOf = (catId: string) => products.filter(p => {
      if (p.category_id !== catId) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return { roots, childrenOf, productsOf };
  }, [categories, products, search]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['products', restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['categories', restaurantId] });
  };

  // --- Product CRUD ---
  const openNewProduct = (categoryId?: string) => {
    if (products.length >= plan.maxProducts) {
      toast.error(`Limite de ${plan.maxProducts} produtos atingido no plano ${plan.planName}.`);
      return;
    }
    setEditingProduct(null);

    // Check if there is an unsaved draft to restore
    let restored = false;
    try {
      const savedDraft = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && (parsed.name || parsed.price || parsed.description || parsed.image_url)) {
          setForm({
            ...parsed,
            category_id: categoryId || parsed.category_id || (categories[0] as any)?.id || ''
          });
          restored = true;
          setIsDraftRestored(true);
        }
      }
    } catch {}

    if (!restored) {
      setForm({ ...emptyForm, category_id: categoryId || (categories[0] as any)?.id || '' });
      setIsDraftRestored(false);
    }
    setProductOpen(true);
  };

  const openEditProduct = (p: any) => {
    setEditingProduct(p.id);
    setIsDraftRestored(false);
    setForm({ name: p.name, description: p.description || '', price: String(p.price), promo_price: p.promo_price ? String(p.promo_price) : '', category_id: p.category_id, featured: p.featured, active: p.active, sold_out: p.sold_out, image_url: p.image_url || '' });
    setProductOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !restaurantId) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${restaurantId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('restaurant-assets').upload(path, file);
    if (error) { toast.error('Erro ao enviar imagem'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('restaurant-assets').getPublicUrl(path);
    setForm(f => ({ ...f, image_url: publicUrl }));
    setUploading(false);
  };

  const saveProduct = async () => {
    if (!restaurantId || !form.name.trim() || !form.price || !form.category_id) { toast.error('Preencha nome, preço e categoria'); return; }
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      promo_price: form.promo_price ? parseFloat(form.promo_price) : null,
      category_id: form.category_id,
      featured: form.featured,
      active: form.active,
      sold_out: form.sold_out,
      image_url: form.image_url || null,
    };
    let productIdToUse: string | null = editingProduct;
    if (editingProduct) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingProduct);
      if (error) { toast.error('Erro ao atualizar'); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('products').insert(payload).select('id').single();
      if (error || !data) { toast.error('Erro ao criar'); setSaving(false); return; }
      productIdToUse = data.id;
    }

    // Persist option groups in the same flow
    if (productIdToUse && optionsRef.current) {
      const ok = await optionsRef.current.persist(productIdToUse);
      if (!ok) { setSaving(false); return; }
    }

    toast.success(editingProduct ? 'Produto atualizado' : 'Produto criado');
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setIsDraftRestored(false);
    setForm(emptyForm);
    setSaving(false);
    setProductOpen(false);
    invalidate();
  };

  const toggleProduct = async (id: string, field: 'active' | 'sold_out' | 'is_quick_sale', current: boolean) => {
    await supabase.from('products').update({ [field]: !current } as any).eq('id', id);
    invalidate();
  };

  // --- Bulk actions ---
  const bulkUpdate = async (patch: Record<string, any>, label: string) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from('products').update(patch as any).in('id', ids);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(`${ids.length} produto(s) ${label}`);
    clearSelection();
    invalidate();
  };

  const bulkMove = async () => {
    if (!bulkActionTarget || selected.size === 0) return;
    await bulkUpdate({ category_id: bulkActionTarget }, 'movido(s)');
    setBulkActionTarget('');
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await supabase.from('order_items').update({ product_id: null }).in('product_id', ids);
    const { data: groups } = await supabase.from('product_option_groups').select('id').in('product_id', ids);
    if (groups && groups.length > 0) {
      const groupIds = groups.map(g => g.id);
      await supabase.from('product_options').delete().in('group_id', groupIds);
      await supabase.from('product_option_groups').delete().in('product_id', ids);
    }
    const { error } = await supabase.from('products').delete().in('id', ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} produto(s) excluído(s)`);
    clearSelection();
    setDeleteTarget(null);
    invalidate();
  };

  // --- Category CRUD ---
  const openNewCategory = (parentId: string | null = null) => {
    setEditingCat(null);
    setCatForm({ ...emptyCatForm, parent_id: parentId });
    setCatOpen(true);
  };
  const openEditCategory = (c: any) => {
    setEditingCat(c.id);
    setCatForm({ name: c.name, description: c.description || '', active: c.active, skip_kitchen: c.skip_kitchen ?? false, parent_id: c.parent_id ?? null });
    setCatOpen(true);
  };

  const saveCategory = async () => {
    if (!restaurantId || !catForm.name.trim()) { toast.error('Nome obrigatório'); return; }
    setCatSaving(true);
    const payload: any = {
      restaurant_id: restaurantId,
      name: catForm.name.trim(),
      description: catForm.description.trim() || null,
      active: catForm.active,
      skip_kitchen: catForm.skip_kitchen,
      parent_id: catForm.parent_id || null,
    };
    if (editingCat) {
      const { error } = await supabase.from('categories').update(payload).eq('id', editingCat);
      if (error) { toast.error('Erro'); setCatSaving(false); return; }
      toast.success('Categoria atualizada');
    } else {
      const { error } = await supabase.from('categories').insert(payload);
      if (error) { toast.error('Erro'); setCatSaving(false); return; }
      toast.success(catForm.parent_id ? 'Subcategoria criada' : 'Categoria criada');
    }
    setCatSaving(false);
    setCatOpen(false);
    invalidate();
  };

  // --- Delete ---
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'bulk') { await bulkDelete(); return; }
    if (deleteTarget.type === 'product' && deleteTarget.id) {
      await supabase.from('order_items').update({ product_id: null }).eq('product_id', deleteTarget.id);
      const { data: groups } = await supabase.from('product_option_groups').select('id').eq('product_id', deleteTarget.id);
      if (groups && groups.length > 0) {
        const groupIds = groups.map(g => g.id);
        await supabase.from('product_options').delete().in('group_id', groupIds);
        await supabase.from('product_option_groups').delete().eq('product_id', deleteTarget.id);
      }
      const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
      if (error) { toast.error(error.message); } else { toast.success('Produto excluído'); }
    } else if (deleteTarget.type === 'category' && deleteTarget.id) {
      const { data: catProducts } = await supabase.from('products').select('id').eq('category_id', deleteTarget.id);
      if (catProducts && catProducts.length > 0) {
        toast.error('Remova ou mova os produtos desta categoria antes de excluí-la');
        setDeleteTarget(null);
        return;
      }
      const { data: subs } = await supabase.from('categories').select('id').eq('parent_id', deleteTarget.id);
      if (subs && subs.length > 0) {
        toast.error('Remova as subcategorias antes de excluir a categoria pai');
        setDeleteTarget(null);
        return;
      }
      const { error } = await supabase.from('categories').delete().eq('id', deleteTarget.id);
      if (error) { toast.error(error.message); } else { toast.success('Categoria excluída'); }
    }
    setDeleteTarget(null);
    invalidate();
  };

  // --- Render helpers ---
  const ProductRow = ({ p, depth = 0 }: { p: any; depth?: number }) => {
    const isSelected = selected.has(p.id);
    return (
      <div
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors group ${isSelected ? 'bg-primary/5 ring-1 ring-primary/30' : 'hover:bg-muted/50'} ${p.sold_out ? 'opacity-60' : ''}`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelect(p.id)}
          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          onClick={e => e.stopPropagation()}
        />
        <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden text-lg">
          {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : '🍽️'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{p.name}</span>
            {p.featured && <span className="inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">★</span>}
            {p.is_quick_sale && <span className="inline-flex rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">⚡</span>}
            {p.sold_out && <span className="inline-flex rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">Esgotado</span>}
            {!p.active && <span className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Inativo</span>}
          </div>
          {p.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] text-muted-foreground block leading-none">A partir de</span>
          <span className="font-heading font-bold text-sm">{formatCurrency(Number(p.promo_price || p.price))}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          <button onClick={() => toggleProduct(p.id, 'active', p.active)} className="p-1.5 rounded-md hover:bg-muted" title={p.active ? 'Desativar' : 'Ativar'}>
            {p.active ? <ToggleRight className="h-4 w-4 text-success" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
          </button>
          <button onClick={() => openEditProduct(p)} className="p-1.5 rounded-md hover:bg-muted" title="Editar">
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => setDeleteTarget({ type: 'product', id: p.id, name: p.name })} className="p-1.5 rounded-md hover:bg-destructive/10" title="Excluir">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      </div>
    );
  };

  const CategoryNode = ({ cat, depth = 0 }: { cat: any; depth?: number }) => {
    const isCollapsed = collapsed.has(cat.id);
    const subs = tree.childrenOf(cat.id);
    const prods = tree.productsOf(cat.id);
    const totalCount = prods.length + subs.reduce((acc, s) => acc + tree.productsOf(s.id).length, 0);
    const isRoot = depth === 0;

    return (
      <div className={`${isRoot ? 'card-elevated overflow-hidden' : ''}`}>
        <div
          className={`flex items-center gap-2 cursor-pointer transition-colors ${isRoot ? 'bg-muted/40 hover:bg-muted/60 px-4 py-3' : 'hover:bg-muted/30 px-3 py-2 rounded-md'}`}
          style={!isRoot ? { paddingLeft: `${12 + depth * 20}px` } : undefined}
          onClick={() => toggleCollapse(cat.id)}
        >
          <button className="p-0.5 -ml-1">
            {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isRoot ? (
              <h3 className="font-heading font-bold uppercase text-sm tracking-wide truncate">{cat.name}</h3>
            ) : (
              <>
                <FolderTree className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm truncate">{cat.name}</span>
              </>
            )}
            {!cat.active && <span className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Inativa</span>}
            {cat.skip_kitchen && <span className="inline-flex rounded-full bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info">Pula KDS</span>}
            <span className="text-xs text-muted-foreground">({totalCount})</span>
          </div>
          <div onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-md hover:bg-background/60 transition-colors">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => openNewProduct(cat.id)}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar produto
                </DropdownMenuItem>
                {isRoot && (
                  <DropdownMenuItem onClick={() => openNewCategory(cat.id)}>
                    <FolderTree className="h-4 w-4 mr-2" /> Adicionar subcategoria
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openEditCategory(cat)}>
                  <Edit2 className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteTarget({ type: 'category', id: cat.id, name: cat.name })}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {!isCollapsed && (
          <div className={`${isRoot ? 'p-2 space-y-1' : 'space-y-1 mt-1'}`}>
            {prods.map(p => <ProductRow key={p.id} p={p} depth={depth} />)}
            {subs.map(sub => <CategoryNode key={sub.id} cat={sub} depth={depth + 1} />)}
            {prods.length === 0 && subs.length === 0 && (
              <div
                className="text-xs text-muted-foreground italic px-3 py-2"
                style={{ paddingLeft: `${20 + depth * 20}px` }}
              >
                Vazia. <button onClick={() => openNewProduct(cat.id)} className="text-primary hover:underline font-medium">+ Adicionar produto</button>
                {isRoot && <> ou <button onClick={() => openNewCategory(cat.id)} className="text-primary hover:underline font-medium">+ subcategoria</button></>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Available parents for category dialog (only roots, excluding self)
  const availableParents = (categories as any[]).filter(c => !c.parent_id && c.id !== editingCat);
  // Flat list for "move to" bulk action (all categories)
  const allCatsFlat = categories as any[];

  return (
    <RestaurantLayout>
      <div className="space-y-5 pb-24">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl font-bold">Gestor de Cardápio</h1>
              <p className="text-sm text-muted-foreground">{products.length} produtos em {tree.roots.length} categorias principais</p>
            </div>
            <div className="flex gap-2 self-start">
              <button onClick={() => openNewCategory(null)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
                <Plus className="h-4 w-4" /> Categoria
              </button>
              <button onClick={() => openNewProduct()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all shadow-sm">
                <Plus className="h-4 w-4" /> Produto
              </button>
            </div>
          </div>
        </ScrollReveal>

        <Tabs defaultValue="menu" className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-sm">
            <TabsTrigger value="menu">Cardápio</TabsTrigger>
            <TabsTrigger value="combos">Combos</TabsTrigger>
          </TabsList>

          <TabsContent value="menu" className="mt-4 space-y-5">
            <ScrollReveal delay={60}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar produto pelo nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
                />
              </div>
            </ScrollReveal>

            <ScrollReveal delay={120}>
              {isLoading ? (
                <div className="card-elevated p-12 text-center text-muted-foreground">Carregando...</div>
              ) : tree.roots.length === 0 ? (
                <div className="card-elevated p-12 text-center">
                  <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">Nenhuma categoria criada ainda.</p>
                  <button onClick={() => openNewCategory(null)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Plus className="h-4 w-4" /> Criar primeira categoria
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tree.roots.map(cat => <CategoryNode key={cat.id} cat={cat} depth={0} />)}
                </div>
              )}
            </ScrollReveal>
          </TabsContent>

          <TabsContent value="combos" className="mt-4">
            <CombosManager />
          </TabsContent>
        </Tabs>
      </div>

      {/* Bulk action bar (sticky bottom) */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 card-elevated border-2 border-primary/30 px-4 py-3 flex items-center gap-3 shadow-2xl rounded-xl bg-card backdrop-blur-sm animate-in slide-in-from-bottom-4 max-w-[calc(100vw-2rem)] flex-wrap justify-center">
          <span className="text-sm font-semibold whitespace-nowrap">
            {selected.size} selecionado{selected.size > 1 ? 's' : ''}
          </span>
          <div className="h-5 w-px bg-border" />
          <button onClick={() => bulkUpdate({ active: true }, 'ativado(s)')} className="text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-success/10 text-success transition-colors">
            Ativar
          </button>
          <button onClick={() => bulkUpdate({ active: false }, 'desativado(s)')} className="text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
            Desativar
          </button>
          <button onClick={() => bulkUpdate({ sold_out: true }, 'esgotado(s)')} className="text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-warning/10 text-warning transition-colors">
            Esgotar
          </button>
          <button onClick={() => bulkUpdate({ sold_out: false }, 'disponível(is)')} className="text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors">
            Disponibilizar
          </button>
          <div className="flex items-center gap-1">
            <select
              value={bulkActionTarget}
              onChange={e => setBulkActionTarget(e.target.value)}
              className="text-xs rounded-md border border-input bg-background px-2 py-1.5"
            >
              <option value="">Mover para...</option>
              {allCatsFlat.map(c => (
                <option key={c.id} value={c.id}>
                  {c.parent_id ? `↳ ${c.name}` : c.name}
                </option>
              ))}
            </select>
            <button onClick={bulkMove} disabled={!bulkActionTarget} className="text-xs font-medium px-2 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors">
              Ir
            </button>
          </div>
          <button
            onClick={() => setDeleteTarget({ type: 'bulk', count: selected.size })}
            className="text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
          >
            Excluir
          </button>
          <button onClick={clearSelection} className="p-1 rounded-md hover:bg-muted transition-colors" title="Limpar seleção">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Product Dialog */}
      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
              {isDraftRestored && !editingProduct && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    Rascunho recuperado
                  </span>
                  <button
                    type="button"
                    onClick={discardDraft}
                    className="text-xs text-muted-foreground hover:text-destructive underline cursor-pointer"
                  >
                    Descartar
                  </button>
                </div>
              )}
            </div>
          </DialogHeader>
          <Tabs defaultValue="details" className="mt-2">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="options">Opcionais</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Preço *</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">Preço promocional</label>
                  <input type="number" step="0.01" value={form.promo_price} onChange={e => setForm(f => ({ ...f, promo_price: e.target.value }))}
                    className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Categoria *</label>
                {categories.length === 0 ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</span>
                    <button type="button" onClick={() => { setProductOpen(false); openNewCategory(null); }}
                      className="text-sm font-medium text-primary hover:underline">+ Criar categoria</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Selecione</option>
                      {(categories as any[]).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.parent_id ? `↳ ${c.name}` : c.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => { setProductOpen(false); openNewCategory(null); }}
                      className="shrink-0 p-2 rounded-lg border border-border hover:bg-muted transition-colors" title="Nova categoria">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Imagem</label>
                <div className="mt-1 flex items-center gap-3">
                  {form.image_url && <img src={form.image_url} alt="" className="h-16 w-16 rounded-lg object-cover" />}
                  <label className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2 text-sm cursor-pointer hover:bg-muted transition-colors">
                    <Upload className="h-4 w-4" /> {uploading ? 'Enviando...' : 'Upload'}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="rounded" /> Destaque
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.sold_out} onChange={e => setForm(f => ({ ...f, sold_out: e.target.checked }))} className="rounded" /> Esgotado
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" /> Ativo
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setProductOpen(false)} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={saveProduct} disabled={saving} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </TabsContent>

            <TabsContent value="options" className="mt-4">
              <ProductOptionsEditor ref={optionsRef} productId={editingProduct} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent
          className="sm:max-w-sm"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingCat ? 'Editar Categoria' : (catForm.parent_id ? 'Nova Subcategoria' : 'Nova Categoria')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <input value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
                className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5">
                <FolderTree className="h-3.5 w-3.5" /> Categoria pai (opcional)
              </label>
              <select
                value={catForm.parent_id ?? ''}
                onChange={e => setCatForm(f => ({ ...f, parent_id: e.target.value || null }))}
                className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Sem pai (categoria principal) —</option>
                {availableParents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione um pai para criar uma <strong>subcategoria</strong> (ex: BEBIDAS → Sucos naturais).
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={catForm.active} onChange={e => setCatForm(f => ({ ...f, active: e.target.checked }))} className="rounded" /> Ativa
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={catForm.skip_kitchen} onChange={e => setCatForm(f => ({ ...f, skip_kitchen: e.target.checked }))} className="rounded mt-0.5" />
              <div>
                <span>Pular cozinha (bebidas)</span>
                <p className="text-xs text-muted-foreground">Pedidos desta categoria vão direto para "Pronto"</p>
              </div>
            </label>
            {editingCat && (
              <button onClick={() => { setDeleteTarget({ type: 'category', id: editingCat, name: catForm.name }); setCatOpen(false); }}
                className="w-full text-sm text-destructive hover:text-destructive/80 transition-colors">Excluir categoria</button>
            )}
            <div className="flex gap-3">
              <button onClick={() => setCatOpen(false)} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
              <button onClick={saveCategory} disabled={catSaving} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {catSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === 'bulk'
                ? `Excluir ${deleteTarget.count} produtos`
                : `Excluir ${deleteTarget?.type === 'product' ? 'produto' : 'categoria'}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'bulk'
                ? `Você está prestes a excluir ${deleteTarget.count} produto(s) selecionado(s). Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RestaurantLayout>
  );
}
