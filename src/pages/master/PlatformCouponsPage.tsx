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
import { Plus, Pencil, Trash2, Ticket } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  duration_months: number;
  max_uses: number | null;
  used_count: number;
  applies_to_tier: string | null;
  active: boolean;
  valid_from: string;
  valid_until: string | null;
};

const empty: Partial<Coupon> = {
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: 10,
  duration_months: 1,
  max_uses: null,
  applies_to_tier: null,
  active: true,
};

export default function PlatformCouponsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Coupon> | null>(null);

  const { data: coupons = [] } = useQuery({
    queryKey: ['platform-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_coupons' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Coupon[];
    },
  });

  const save = useMutation({
    mutationFn: async (c: Partial<Coupon>) => {
      const payload = {
        code: c.code?.toUpperCase().trim(),
        description: c.description || null,
        discount_type: c.discount_type,
        discount_value: c.discount_value,
        duration_months: c.duration_months,
        max_uses: c.max_uses,
        applies_to_tier: c.applies_to_tier || null,
        active: c.active ?? true,
        valid_until: c.valid_until || null,
      };
      if (c.id) {
        const { error } = await supabase.from('platform_coupons' as any).update(payload).eq('id', c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('platform_coupons' as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-coupons'] });
      setOpen(false);
      setEditing(null);
      toast({ title: 'Cupom salvo' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('platform_coupons' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-coupons'] });
      toast({ title: 'Cupom removido' });
    },
  });

  return (
    <MasterLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold">Cupons da Plataforma</h1>
            <p className="text-sm text-muted-foreground">Descontos aplicáveis na assinatura SaaS dos restaurantes.</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(empty)}><Plus className="h-4 w-4 mr-1" />Novo Cupom</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>{editing?.id ? 'Editar Cupom' : 'Novo Cupom'}</DialogTitle></DialogHeader>
              {editing && (
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Código</Label>
                      <Input value={editing.code || ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="PRIMEIROMES" />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={editing.discount_type} onValueChange={(v) => setEditing({ ...editing, discount_type: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percentual (%)</SelectItem>
                          <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor do desconto</Label>
                      <Input type="number" step="0.01" value={editing.discount_value ?? 0} onChange={(e) => setEditing({ ...editing, discount_value: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Duração (meses)</Label>
                      <Input type="number" value={editing.duration_months ?? 1} onChange={(e) => setEditing({ ...editing, duration_months: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Máx. usos (vazio = ilimitado)</Label>
                      <Input type="number" value={editing.max_uses ?? ''} onChange={(e) => setEditing({ ...editing, max_uses: e.target.value ? parseInt(e.target.value) : null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Aplicável ao plano</Label>
                      <Select value={editing.applies_to_tier || 'all'} onValueChange={(v) => setEditing({ ...editing, applies_to_tier: v === 'all' ? null : v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="basic">Básico</SelectItem>
                          <SelectItem value="professional">Profissional</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Válido até (opcional)</Label>
                      <Input type="datetime-local" value={editing.valid_until ? editing.valid_until.slice(0, 16) : ''} onChange={(e) => setEditing({ ...editing, valid_until: e.target.value || null })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição interna</Label>
                    <Textarea rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                  </div>
                  <label className="flex items-center justify-between rounded-lg border border-border p-3">
                    <span className="text-sm">Ativo</span>
                    <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                  </label>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>
                  {save.isPending ? 'Salvando…' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" />Cupons cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {coupons.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum cupom cadastrado ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-bold">{c.code}</TableCell>
                      <TableCell>{c.discount_type === 'percent' ? `${c.discount_value}%` : `R$ ${Number(c.discount_value).toFixed(2)}`}</TableCell>
                      <TableCell>{c.duration_months} mês(es)</TableCell>
                      <TableCell>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</TableCell>
                      <TableCell>{c.applies_to_tier || 'Todos'}</TableCell>
                      <TableCell><Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Remover cupom?')) remove.mutate(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MasterLayout>
  );
}
