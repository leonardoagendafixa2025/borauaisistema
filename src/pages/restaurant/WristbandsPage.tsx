import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, X, Search, BadgeCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

const genCode = () => {
  // 4 chars maiúsculos sem ambíguos
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
};

export default function WristbandsPage() {
  const { restaurantId, user } = useAuth();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newCode, setNewCode] = useState(genCode());
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newTier, setNewTier] = useState<'standard' | 'vip'>('standard');
  const [newLimit, setNewLimit] = useState('');
  const [creating, setCreating] = useState(false);
  const [batchQty, setBatchQty] = useState(1);

  const { data: wristbands = [], isLoading } = useQuery({
    queryKey: ['wristbands', restaurantId, filter],
    queryFn: async () => {
      if (!restaurantId) return [];
      let q = (supabase as any)
        .from('nightlife_wristbands')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('issued_at', { ascending: false })
        .limit(500);
      if (filter !== 'all') q = q.eq('status', filter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!restaurantId,
    refetchInterval: 10000,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return wristbands;
    return (wristbands as any[]).filter(
      (w) =>
        w.code?.toLowerCase().includes(s) ||
        w.customer_name?.toLowerCase().includes(s) ||
        w.customer_phone?.toLowerCase().includes(s),
    );
  }, [wristbands, search]);

  const stats = useMemo(() => {
    const list = wristbands as any[];
    return {
      active: list.filter((w) => w.status === 'active').length,
      consumed: list.reduce((s, w) => s + Number(w.total_consumed || 0), 0),
      paid: list.reduce((s, w) => s + Number(w.total_paid || 0), 0),
      pending: list.reduce(
        (s, w) =>
          s + Math.max(0, Number(w.total_consumed || 0) - Number(w.total_paid || 0)),
        0,
      ),
    };
  }, [wristbands]);

  const createWristbands = async () => {
    if (!restaurantId) return;
    setCreating(true);
    try {
      const codes = batchQty > 1
        ? Array.from({ length: batchQty }, () => genCode())
        : [newCode.trim().toUpperCase()];

      const rows = codes.map((c) => ({
        restaurant_id: restaurantId,
        code: c,
        tier: newTier,
        credit_limit: Number(newLimit) || 0,
        customer_name: batchQty > 1 ? null : newName.trim() || null,
        customer_phone: batchQty > 1 ? null : newPhone.trim() || null,
        issued_by: user?.id || null,
      }));

      const { error } = await (supabase as any).from('nightlife_wristbands').insert(rows);
      if (error) throw error;

      toast.success(batchQty > 1 ? `${batchQty} pulseiras emitidas` : `Pulseira ${codes[0]} emitida`);
      setShowNew(false);
      setNewCode(genCode());
      setNewName('');
      setNewPhone('');
      setNewLimit('');
      setBatchQty(1);
      qc.invalidateQueries({ queryKey: ['wristbands'] });
    } catch (err: any) {
      toast.error(err?.message?.includes('duplicate') ? 'Código já existe' : 'Erro ao emitir');
    } finally {
      setCreating(false);
    }
  };

  const closeWristband = async (id: string, code: string) => {
    if (!confirm(`Encerrar pulseira ${code}? O cliente não poderá mais consumir nela.`)) return;
    const { error } = await (supabase as any)
      .from('nightlife_wristbands')
      .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: user?.id || null } as any)
      .eq('id', id);
    if (error) toast.error('Erro ao encerrar');
    else {
      toast.success(`Pulseira ${code} encerrada`);
      qc.invalidateQueries({ queryKey: ['wristbands'] });
    }
  };

  const markAsPaid = async (id: string, code: string, pending: number) => {
    if (pending <= 0) return;
    if (!confirm(`Confirmar pagamento de ${fmt(pending)} da pulseira ${code}?`)) return;
    const w = (wristbands as any[]).find((x) => x.id === id);
    const newPaid = Number(w?.total_paid || 0) + pending;
    const { error } = await (supabase as any)
      .from('nightlife_wristbands')
      .update({ total_paid: newPaid } as any)
      .eq('id', id);
    if (error) toast.error('Erro ao registrar pagamento');
    else {
      toast.success('Pagamento registrado');
      qc.invalidateQueries({ queryKey: ['wristbands'] });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/restaurant/balada-hub" className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-lg leading-tight">Pulseiras / Fichas</h1>
            <p className="text-xs text-muted-foreground">Cashless da balada</p>
          </div>
          <Button onClick={() => setShowNew(true)} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Emitir
          </Button>
        </div>

        {/* KPIs */}
        <div className="px-4 pb-3 grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-muted/50 px-2 py-1.5">
            <p className="text-[10px] uppercase text-muted-foreground">Ativas</p>
            <p className="font-bold text-sm">{stats.active}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-1.5">
            <p className="text-[10px] uppercase text-muted-foreground">Consumido</p>
            <p className="font-bold text-sm">{fmt(stats.consumed)}</p>
          </div>
          <div className="rounded-lg bg-success/10 px-2 py-1.5">
            <p className="text-[10px] uppercase text-success">Pago</p>
            <p className="font-bold text-sm text-success">{fmt(stats.paid)}</p>
          </div>
          <div className="rounded-lg bg-warning/10 px-2 py-1.5">
            <p className="text-[10px] uppercase text-warning">A receber</p>
            <p className="font-bold text-sm text-warning">{fmt(stats.pending)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código, nome ou telefone…"
              className="pl-8 h-9"
            />
          </div>
          <div className="flex rounded-lg bg-muted p-0.5">
            {(['active', 'closed', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium ${
                  filter === f ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {f === 'active' ? 'Ativas' : f === 'closed' ? 'Encerr.' : 'Todas'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* List */}
      <main className="px-4 py-3 space-y-2">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Carregando…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <BadgeCheck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Nenhuma pulseira</p>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em <strong>Emitir</strong> para começar.
            </p>
          </div>
        ) : (
          filtered.map((w: any) => {
            const consumed = Number(w.total_consumed || 0);
            const paid = Number(w.total_paid || 0);
            const pending = Math.max(0, consumed - paid);
            const limitReached = w.credit_limit > 0 && consumed >= w.credit_limit;
            return (
              <div key={w.id} className="card-elevated p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono font-bold text-lg tracking-wider">{w.code}</span>
                      {w.tier === 'vip' && (
                        <Badge className="h-5 bg-amber-500 text-white">VIP</Badge>
                      )}
                      {w.status === 'closed' && (
                        <Badge variant="secondary" className="h-5">Encerrada</Badge>
                      )}
                      {limitReached && (
                        <Badge variant="destructive" className="h-5 gap-1">
                          <AlertCircle className="h-3 w-3" /> Limite
                        </Badge>
                      )}
                    </div>
                    {(w.customer_name || w.customer_phone) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {w.customer_name} {w.customer_phone && `· ${w.customer_phone}`}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span>
                        Consumo: <strong>{fmt(consumed)}</strong>
                      </span>
                      <span className="text-success">Pago: {fmt(paid)}</span>
                      {pending > 0 && (
                        <span className="text-warning font-bold">A receber: {fmt(pending)}</span>
                      )}
                    </div>
                    {w.credit_limit > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Limite: {fmt(w.credit_limit)}
                      </p>
                    )}
                  </div>
                </div>

                {w.status === 'active' && (
                  <div className="flex items-center gap-2 mt-3">
                    {pending > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                        onClick={() => markAsPaid(w.id, w.code, pending)}
                      >
                        💰 Receber {fmt(pending)}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-destructive"
                      onClick={() => closeWristband(w.id, w.code)}
                    >
                      Encerrar
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* New wristband dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir pulseira(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium block mb-1">Quantidade</label>
              <div className="flex gap-2">
                {[1, 5, 10, 25, 50].map((n) => (
                  <button
                    key={n}
                    onClick={() => setBatchQty(n)}
                    className={`flex-1 rounded-lg py-1.5 text-sm font-bold ${
                      batchQty === n ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {batchQty > 1 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {batchQty} códigos aleatórios serão gerados.
                </p>
              )}
            </div>

            {batchQty === 1 && (
              <>
                <div>
                  <label className="text-xs font-medium block mb-1">Código</label>
                  <div className="flex gap-2">
                    <Input
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase().slice(0, 12))}
                      className="font-mono uppercase tracking-wider"
                    />
                    <Button variant="outline" onClick={() => setNewCode(genCode())} type="button">
                      🎲
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium block mb-1">Nome (opc.)</label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Telefone (opc.)</label>
                    <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium block mb-1">Tipo</label>
                <select
                  value={newTier}
                  onChange={(e) => setNewTier(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="standard">Padrão</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">
                  Limite (R$, 0 = sem limite)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={createWristbands} disabled={creating}>
              {creating ? 'Emitindo…' : `Emitir ${batchQty > 1 ? batchQty + ' pulseiras' : 'pulseira'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
