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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Flag } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const KNOWN_FLAGS = [
  { key: 'balada-mode', label: 'Modo Balada (beta)' },
  { key: 'ai-insights-beta', label: 'AI Insights (beta)' },
  { key: 'scale-integration', label: 'Integração Balança' },
  { key: 'telegram-bot-advanced', label: 'Bot Telegram avançado' },
  { key: 'delivery-live-tracking', label: 'Rastreio entregador ao vivo' },
  { key: 'custom-domain', label: 'Domínio customizado' },
];

type Flag = {
  id: string;
  restaurant_id: string;
  flag_key: string;
  enabled: boolean;
  notes: string | null;
  created_at: string;
};

type Restaurant = { id: string; name: string; slug: string };

export default function FeatureFlagsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [flagKey, setFlagKey] = useState<string>('');
  const [enabled, setEnabled] = useState(true);
  const [notes, setNotes] = useState('');

  const { data: restaurants = [] } = useQuery({
    queryKey: ['master-restaurants-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('restaurants').select('id, name, slug').order('name');
      if (error) throw error;
      return data as Restaurant[];
    },
  });

  const { data: flags = [] } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_feature_flags' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Flag[];
    },
  });

  const restaurantMap = Object.fromEntries(restaurants.map((r) => [r.id, r]));

  const save = useMutation({
    mutationFn: async () => {
      if (!restaurantId || !flagKey) throw new Error('Selecione o restaurante e a flag');
      const { error } = await supabase.from('restaurant_feature_flags' as any).upsert({
        restaurant_id: restaurantId,
        flag_key: flagKey,
        enabled,
        notes: notes || null,
      } as any, { onConflict: 'restaurant_id,flag_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature-flags'] });
      setOpen(false);
      setRestaurantId(''); setFlagKey(''); setNotes(''); setEnabled(true);
      toast({ title: 'Flag aplicada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('restaurant_feature_flags' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature-flags'] });
      toast({ title: 'Flag removida' });
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from('restaurant_feature_flags' as any).update({ enabled }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feature-flags'] }),
  });

  return (
    <MasterLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold">Feature Flags</h1>
            <p className="text-sm text-muted-foreground">Liga/desliga módulos experimentais por restaurante específico.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />Aplicar Flag</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Aplicar Feature Flag</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Restaurante</Label>
                  <Select value={restaurantId} onValueChange={setRestaurantId}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {restaurants.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Flag</Label>
                  <Select value={flagKey} onValueChange={setFlagKey}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {KNOWN_FLAGS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>{f.label} ({f.key})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Ou digite uma chave customizada:</p>
                  <Input placeholder="custom-flag-key" value={flagKey} onChange={(e) => setFlagKey(e.target.value)} />
                </div>
                <label className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm">Habilitada</span>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </label>
                <div className="space-y-2">
                  <Label>Observações (opcional)</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Aplicar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5" />Flags ativas</CardTitle>
          </CardHeader>
          <CardContent>
            {flags.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma feature flag aplicada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurante</TableHead>
                    <TableHead>Flag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flags.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{restaurantMap[f.restaurant_id]?.name || f.restaurant_id.slice(0, 8)}</TableCell>
                      <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{f.flag_key}</code></TableCell>
                      <TableCell>
                        <Switch checked={f.enabled} onCheckedChange={(v) => toggle.mutate({ id: f.id, enabled: v })} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{f.notes || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Remover flag?')) remove.mutate(f.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Flags conhecidas</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {KNOWN_FLAGS.map((f) => (
                <Badge key={f.key} variant="outline">{f.label} <code className="ml-2 text-xs opacity-60">{f.key}</code></Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MasterLayout>
  );
}
