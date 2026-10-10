import { useMemo, useState } from 'react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { Music, Plus, Trash2, Edit2, ExternalLink, Beer, Calendar, Clock, Sparkles, Disc3 } from 'lucide-react';
import MusicRequestsConfig from '@/components/nightlife/MusicRequestsConfig';
import { Link } from 'react-router-dom';
import {
  useNightlifeActs,
  useNightlifeDrinks,
  useSaveAct,
  useDeleteAct,
  useSaveDrink,
  useDeleteDrink,
  type NightlifeAct,
  type NightlifeHourDrink,
} from '@/hooks/useNightlife';
import { useRestaurant, useRestaurantProducts } from '@/hooks/useRestaurantData';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const toLocalInput = (iso: string | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
};

const toIso = (local: string) => (local ? new Date(local).toISOString() : '');

function ActDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  initial?: NightlifeAct;
}) {
  const save = useSaveAct();
  const { toast } = useToast();
  const [form, setForm] = useState({
    artist_name: initial?.artist_name || '',
    genre: initial?.genre || '',
    description: initial?.description || '',
    image_url: initial?.image_url || '',
    starts_at: toLocalInput(initial?.starts_at) || '',
    ends_at: toLocalInput(initial?.ends_at) || '',
    active: initial?.active ?? true,
  });

  const submit = async () => {
    if (!form.artist_name || !form.starts_at || !form.ends_at) {
      toast({ title: 'Preencha nome, início e fim', variant: 'destructive' });
      return;
    }
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast({ title: 'Fim deve ser depois do início', variant: 'destructive' });
      return;
    }
    try {
      await save.mutateAsync({
        id: initial?.id,
        artist_name: form.artist_name,
        genre: form.genre || null,
        description: form.description || null,
        image_url: form.image_url || null,
        starts_at: toIso(form.starts_at),
        ends_at: toIso(form.ends_at),
        active: form.active,
      });
      toast({ title: initial ? 'Atração atualizada' : 'Atração criada' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar atração' : 'Nova atração'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Artista / Atração *</Label>
            <Input value={form.artist_name} onChange={(e) => setForm({ ...form, artist_name: e.target.value })} placeholder="DJ Marina, Banda XPTO..." />
          </div>
          <div>
            <Label>Gênero</Label>
            <Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Sertanejo, Eletrônica, MPB..." />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Hits dos anos 2000, set autoral..." />
          </div>
          <div>
            <Label>URL da foto</Label>
            <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início *</Label>
              <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div>
              <Label>Fim *</Label>
              <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label>Ativa (visível na tela pública)</Label>
            <Switch checked={form.active} onCheckedChange={(b) => setForm({ ...form, active: b })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DrinkDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  initial?: NightlifeHourDrink;
}) {
  const save = useSaveDrink();
  const { data: products = [] } = useRestaurantProducts();
  const { toast } = useToast();
  const [form, setForm] = useState({
    product_id: initial?.product_id || '',
    custom_name: initial?.custom_name || '',
    custom_image_url: initial?.custom_image_url || '',
    promo_price: initial?.promo_price?.toString() || '',
    starts_at: toLocalInput(initial?.starts_at) || '',
    ends_at: toLocalInput(initial?.ends_at) || '',
    highlight_text: initial?.highlight_text || '',
    active: initial?.active ?? true,
  });

  const submit = async () => {
    if (!form.promo_price || !form.starts_at || !form.ends_at) {
      toast({ title: 'Preencha preço, início e fim', variant: 'destructive' });
      return;
    }
    if (!form.product_id && !form.custom_name) {
      toast({ title: 'Escolha um produto OU informe um nome customizado', variant: 'destructive' });
      return;
    }
    try {
      await save.mutateAsync({
        id: initial?.id,
        product_id: form.product_id || null,
        custom_name: form.custom_name || null,
        custom_image_url: form.custom_image_url || null,
        promo_price: Number(form.promo_price),
        starts_at: toIso(form.starts_at),
        ends_at: toIso(form.ends_at),
        highlight_text: form.highlight_text || null,
        active: form.active,
      });
      toast({ title: initial ? 'Promoção atualizada' : 'Promoção criada' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar drink da hora' : 'Novo drink da hora'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Produto do cardápio</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            >
              <option value="">— Sem produto vinculado —</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} ({fmt(p.price)})</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">Opcional. Se vazio, use nome customizado abaixo.</p>
          </div>
          <div>
            <Label>Nome customizado (se sem produto)</Label>
            <Input value={form.custom_name} onChange={(e) => setForm({ ...form, custom_name: e.target.value })} placeholder="Caipirinha de morango" />
          </div>
          <div>
            <Label>Imagem (URL)</Label>
            <Input value={form.custom_image_url} onChange={(e) => setForm({ ...form, custom_image_url: e.target.value })} placeholder="https://... (opcional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preço promo *</Label>
              <Input type="number" step="0.01" value={form.promo_price} onChange={(e) => setForm({ ...form, promo_price: e.target.value })} placeholder="15.00" />
            </div>
            <div>
              <Label>Destaque</Label>
              <Input value={form.highlight_text} onChange={(e) => setForm({ ...form, highlight_text: e.target.value })} placeholder="-30%, Só hoje..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início *</Label>
              <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div>
              <Label>Fim *</Label>
              <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label>Ativa</Label>
            <Switch checked={form.active} onCheckedChange={(b) => setForm({ ...form, active: b })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function NightlifeManagerPage() {
  const { data: acts = [], isLoading: loadingActs } = useNightlifeActs();
  const { data: drinks = [], isLoading: loadingDrinks } = useNightlifeDrinks();
  const { data: restaurant } = useRestaurant();
  const delAct = useDeleteAct();
  const delDrink = useDeleteDrink();
  const { toast } = useToast();

  const [actDialog, setActDialog] = useState<{ open: boolean; act?: NightlifeAct }>({ open: false });
  const [drinkDialog, setDrinkDialog] = useState<{ open: boolean; drink?: NightlifeHourDrink }>({ open: false });

  const now = Date.now();
  const playingAct = useMemo(
    () => acts.find((a) => new Date(a.starts_at).getTime() <= now && new Date(a.ends_at).getTime() >= now && a.active),
    [acts, now]
  );
  const liveDrink = useMemo(
    () => drinks.find((d) => new Date(d.starts_at).getTime() <= now && new Date(d.ends_at).getTime() >= now && d.active),
    [drinks, now]
  );

  const publicUrl = restaurant?.slug ? `/${restaurant.slug}/balada` : null;

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Music className="h-6 w-6 text-primary" />
                <h1 className="font-heading text-2xl font-bold">Programação da Noite</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Cadastre o line-up e drinks promocionais da noite. Tudo aparece em tempo real na tela pública.
              </p>
            </div>
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Ver tela pública <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </ScrollReveal>

        {/* Live status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScrollReveal>
            <div className="card-elevated p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <p className="text-xs font-semibold uppercase tracking-wide text-success">Tocando agora</p>
              </div>
              {playingAct ? (
                <>
                  <p className="font-heading text-xl font-bold">{playingAct.artist_name}</p>
                  {playingAct.genre && <p className="text-sm text-muted-foreground">{playingAct.genre}</p>}
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(playingAct.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} →{' '}
                    {new Date(playingAct.ends_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma atração no ar agora.</p>
              )}
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="card-elevated p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Drink da hora</p>
              </div>
              {liveDrink ? (
                <>
                  <p className="font-heading text-xl font-bold">
                    {liveDrink.custom_name || 'Drink em promoção'}
                  </p>
                  <p className="text-2xl font-bold text-primary mt-1">{fmt(liveDrink.promo_price)}</p>
                  {liveDrink.highlight_text && (
                    <span className="inline-block mt-2 text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {liveDrink.highlight_text}
                    </span>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma promoção ativa agora.</p>
              )}
            </div>
          </ScrollReveal>
        </div>

        <Tabs defaultValue="acts">
          <TabsList>
            <TabsTrigger value="acts"><Music className="h-3.5 w-3.5 mr-1.5" />Line-up</TabsTrigger>
            <TabsTrigger value="drinks"><Beer className="h-3.5 w-3.5 mr-1.5" />Drinks da hora</TabsTrigger>
            <TabsTrigger value="music"><Disc3 className="h-3.5 w-3.5 mr-1.5" />Pedidos de música</TabsTrigger>
          </TabsList>

          {/* ATTRACTIONS */}
          <TabsContent value="acts" className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setActDialog({ open: true })}>
                <Plus className="h-4 w-4 mr-1.5" /> Nova atração
              </Button>
            </div>
            {loadingActs ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : acts.length === 0 ? (
              <div className="card-elevated p-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium">Nenhuma atração cadastrada</p>
                <p className="text-sm text-muted-foreground mt-1">Cadastre DJs, bandas e shows da noite para o cliente saber o que rola.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {acts.map((a) => (
                  <div key={a.id} className="card-elevated p-4 flex items-center gap-3">
                    {a.image_url ? (
                      <img src={a.image_url} alt={a.artist_name} className="h-14 w-14 rounded-lg object-cover" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
                        <Music className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{a.artist_name}</p>
                        {a.genre && <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{a.genre}</span>}
                        {!a.active && <span className="text-[11px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Inativa</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(a.starts_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {new Date(a.ends_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setActDialog({ open: true, act: a })}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Excluir "${a.artist_name}"?`)) return;
                        try { await delAct.mutateAsync(a.id); toast({ title: 'Atração excluída' }); }
                        catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* DRINKS */}
          <TabsContent value="drinks" className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setDrinkDialog({ open: true })}>
                <Plus className="h-4 w-4 mr-1.5" /> Novo drink da hora
              </Button>
            </div>
            {loadingDrinks ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : drinks.length === 0 ? (
              <div className="card-elevated p-12 text-center">
                <Beer className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium">Nenhum drink em promoção</p>
                <p className="text-sm text-muted-foreground mt-1">Crie promoções por janela de horário para girar o estoque na noite.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {drinks.map((d) => (
                  <div key={d.id} className="card-elevated p-4 flex items-center gap-3">
                    {d.custom_image_url ? (
                      <img src={d.custom_image_url} alt={d.custom_name || 'drink'} className="h-14 w-14 rounded-lg object-cover" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Beer className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">
                          {d.custom_name || 'Drink (do cardápio)'}
                        </p>
                        {d.highlight_text && (
                          <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{d.highlight_text}</span>
                        )}
                        {!d.active && <span className="text-[11px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Inativa</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fmt(d.promo_price)} •{' '}
                        {new Date(d.starts_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {new Date(d.ends_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setDrinkDialog({ open: true, drink: d })}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm('Excluir esta promoção?')) return;
                        try { await delDrink.mutateAsync(d.id); toast({ title: 'Promoção excluída' }); }
                        catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* MUSIC REQUESTS CONFIG */}
          <TabsContent value="music" className="mt-3">
            <MusicRequestsConfig />
          </TabsContent>
        </Tabs>
      </div>

      {actDialog.open && (
        <ActDialog
          open={actDialog.open}
          onOpenChange={(b) => setActDialog({ open: b, act: b ? actDialog.act : undefined })}
          initial={actDialog.act}
        />
      )}
      {drinkDialog.open && (
        <DrinkDialog
          open={drinkDialog.open}
          onOpenChange={(b) => setDrinkDialog({ open: b, drink: b ? drinkDialog.drink : undefined })}
          initial={drinkDialog.drink}
        />
      )}
    </RestaurantLayout>
  );
}

