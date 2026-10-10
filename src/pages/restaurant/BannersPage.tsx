import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical, Upload, Image as ImageIcon, Eye, EyeOff, Calendar, Link as LinkIcon, X, ArrowUp, ArrowDown, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useRestaurantCategories, useRestaurantProducts } from '@/hooks/useRestaurantData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Banner {
  id: string;
  restaurant_id: string;
  image_url: string;
  title: string | null;
  link_type: string;
  link_target: string | null;
  sort_order: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

const MAX_SIZE_MB = 2;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function BannersPage() {
  const { restaurantId } = useAuth();
  const plan = usePlanFeatures();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useRestaurantCategories();
  const { data: products = [] } = useRestaurantProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<Banner | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['restaurant-banners', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_banners' as any)
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Banner[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['restaurant-banners', restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['promo-banners', restaurantId] });
  };

  // Plan gating: Basic = 0 banners
  if (!plan.loading && plan.maxBanners === 0) {
    return (
      <RestaurantLayout>
        <div className="max-w-2xl mx-auto p-6">
          <div className="card-elevated p-8 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Banners Promocionais</h1>
              <p className="text-muted-foreground mt-2">
                Destaque suas promoções no topo do cardápio, igual aos grandes apps de delivery.
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-sm text-left space-y-2">
              <p className="font-semibold">📈 O que você ganha com banners:</p>
              <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                <li>Aumente o ticket médio destacando combos</li>
                <li>Promova ofertas relâmpago (2x1, frete grátis)</li>
                <li>Banner clicável leva direto para o produto</li>
                <li>Plano Premium: agendamento por data (Black Friday, Natal)</li>
              </ul>
            </div>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/restaurant/billing">Fazer upgrade do plano</Link>
            </Button>
          </div>
        </div>
      </RestaurantLayout>
    );
  }

  const handleUploadFile = async (file: File): Promise<string | null> => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WEBP.');
      return null;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande. Máximo ${MAX_SIZE_MB}MB.`);
      return null;
    }
    const ext = file.name.split('.').pop();
    const path = `banners/${restaurantId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: false });
    if (error) {
      toast.error('Erro ao enviar imagem');
      return null;
    }
    const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreateBanner = async (file: File) => {
    if (banners.length >= plan.maxBanners) {
      toast.error(`Limite do plano atingido (${plan.maxBanners} banners). Faça upgrade para adicionar mais.`);
      return;
    }
    setUploading(true);
    const url = await handleUploadFile(file);
    if (!url) { setUploading(false); return; }
    const nextOrder = banners.length > 0 ? Math.max(...banners.map(b => b.sort_order)) + 1 : 0;
    const { error } = await supabase.from('restaurant_banners' as any).insert({
      restaurant_id: restaurantId,
      image_url: url,
      sort_order: nextOrder,
      active: true,
      link_type: 'none',
    } as any);
    setUploading(false);
    if (error) { toast.error('Erro ao criar banner'); return; }
    toast.success('Banner adicionado!');
    invalidate();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const updates: any = {
      title: editing.title || null,
      link_type: editing.link_type,
      link_target: editing.link_target || null,
      active: editing.active,
    };
    if (plan.hasBannerScheduling) {
      updates.starts_at = editing.starts_at || null;
      updates.ends_at = editing.ends_at || null;
    }
    const { error } = await (supabase.from('restaurant_banners' as any).update(updates).eq('id', editing.id) as any);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Banner atualizado');
    setEditing(null);
    invalidate();
  };

  const handleToggleActive = async (b: Banner) => {
    const { error } = await (supabase.from('restaurant_banners' as any).update({ active: !b.active } as any).eq('id', b.id) as any);
    if (error) { toast.error('Erro ao atualizar'); return; }
    invalidate();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const banner = banners.find(b => b.id === deleteId);
    const { error } = await supabase.from('restaurant_banners' as any).delete().eq('id', deleteId);
    if (error) { toast.error('Erro ao remover'); return; }
    // Try to remove file from storage (best-effort)
    if (banner?.image_url.includes('/restaurant-assets/')) {
      const path = banner.image_url.split('/restaurant-assets/')[1];
      if (path) await supabase.storage.from('restaurant-assets').remove([path]);
    }
    toast.success('Banner removido');
    setDeleteId(null);
    invalidate();
  };

  const handleMove = async (banner: Banner, direction: 'up' | 'down') => {
    const idx = banners.findIndex(b => b.id === banner.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= banners.length) return;
    const other = banners[swapIdx];
    await Promise.all([
      (supabase.from('restaurant_banners' as any).update({ sort_order: other.sort_order } as any).eq('id', banner.id) as any),
      (supabase.from('restaurant_banners' as any).update({ sort_order: banner.sort_order } as any).eq('id', other.id) as any),
    ]);
    invalidate();
  };

  const canAddMore = banners.length < plan.maxBanners;

  return (
    <RestaurantLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold">Banners Promocionais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Destaque promoções no topo do seu cardápio. {banners.length}/{plan.maxBanners} usados.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCreateBanner(file);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={!canAddMore || uploading}
            size="lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            {uploading ? 'Enviando...' : 'Novo Banner'}
          </Button>
        </div>
      </div>

      {!canAddMore && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          Você atingiu o limite de {plan.maxBanners} banners do seu plano.
          {plan.tier !== 'premium' && (
            <Link to="/restaurant/settings" className="ml-1 font-semibold text-primary hover:underline">
              Faça upgrade para adicionar mais
            </Link>
          )}
        </div>
      )}

      <div className="rounded-xl bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">📐 Recomendações:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Dimensão ideal: 1200x400px (proporção 3:1)</li>
          <li>Formato: JPG, PNG ou WEBP — máximo {MAX_SIZE_MB}MB</li>
          <li>Use textos grandes e legíveis no mobile</li>
        </ul>
      </div>

      {isLoading && <p className="text-center text-muted-foreground">Carregando...</p>}

      {!isLoading && banners.length === 0 && (
        <div className="card-elevated p-12 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nenhum banner cadastrado ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Banner" para começar.</p>
        </div>
      )}

      <div className="space-y-3">
        {banners.map((b, idx) => (
          <div key={b.id} className="card-elevated p-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex flex-col gap-1 justify-center">
              <button
                onClick={() => handleMove(b, 'up')}
                disabled={idx === 0}
                className="h-7 w-7 rounded-md hover:bg-muted disabled:opacity-30 flex items-center justify-center"
                aria-label="Mover para cima"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleMove(b, 'down')}
                disabled={idx === banners.length - 1}
                className="h-7 w-7 rounded-md hover:bg-muted disabled:opacity-30 flex items-center justify-center"
                aria-label="Mover para baixo"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
            <div className="aspect-[3/1] sm:w-48 rounded-lg overflow-hidden bg-muted shrink-0">
              <img src={b.image_url} alt={b.title || 'Banner'} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{b.title || 'Sem título'}</span>
                {b.active ? (
                  <Badge variant="outline" className="border-success/50 text-success">Ativo</Badge>
                ) : (
                  <Badge variant="outline">Inativo</Badge>
                )}
                {b.link_type !== 'none' && (
                  <Badge variant="secondary" className="gap-1">
                    <LinkIcon className="h-3 w-3" />
                    {b.link_type === 'category' ? 'Categoria' : b.link_type === 'product' ? 'Produto' : 'Link'}
                  </Badge>
                )}
                {(b.starts_at || b.ends_at) && (
                  <Badge variant="secondary" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    Agendado
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => handleToggleActive(b)}>
                {b.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(b)}>
                Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDeleteId(b.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Banner</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="aspect-[3/1] rounded-lg overflow-hidden bg-muted">
                <img src={editing.image_url} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-2">
                <Label>Título (opcional)</Label>
                <Input
                  value={editing.title || ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Ex: Combo da Sexta"
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label>Ao clicar no banner</Label>
                <Select
                  value={editing.link_type}
                  onValueChange={(v) => setEditing({ ...editing, link_type: v, link_target: null })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nada (apenas visual)</SelectItem>
                    <SelectItem value="category">Ir para uma categoria</SelectItem>
                    <SelectItem value="product">Abrir um produto</SelectItem>
                    <SelectItem value="external">Abrir link externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editing.link_type === 'category' && (
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={editing.link_target || ''}
                    onValueChange={(v) => setEditing({ ...editing, link_target: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editing.link_type === 'product' && (
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select
                    value={editing.link_target || ''}
                    onValueChange={(v) => setEditing({ ...editing, link_target: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editing.link_type === 'external' && (
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    type="url"
                    value={editing.link_target || ''}
                    onChange={(e) => setEditing({ ...editing, link_target: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              )}
              {plan.hasBannerScheduling && (
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Iniciar em (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={editing.starts_at?.slice(0, 16) || ''}
                      onChange={(e) => setEditing({ ...editing, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Encerrar em (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={editing.ends_at?.slice(0, 16) || ''}
                      onChange={(e) => setEditing({ ...editing, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    />
                  </div>
                </div>
              )}
              {!plan.hasBannerScheduling && (
                <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                  💎 Agendamento por data disponível no plano <strong>Premium</strong>
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="banner-active" className="cursor-pointer">Banner ativo</Label>
                <Switch
                  id="banner-active"
                  checked={editing.active}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover banner?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </RestaurantLayout>
  );
}
