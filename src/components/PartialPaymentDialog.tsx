import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { DollarSign, Users, Trash2, CheckCircle2, Plus, Wallet } from 'lucide-react';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface PartialPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: {
    id: string;
    number: number;
    label?: string | null;
    capacity?: number | null;
  } | null;
  onTableClosed?: () => void;
}

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'credit_card', label: 'Crédito' },
  { value: 'debit_card', label: 'Débito' },
];

export default function PartialPaymentDialog({ open, onOpenChange, table, onTableClosed }: PartialPaymentDialogProps) {
  const { restaurantId, user } = useAuth();
  const queryClient = useQueryClient();
  const [peopleAtTable, setPeopleAtTable] = useState<number>(table?.capacity || 4);
  const [payingPeople, setPayingPeople] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('pix');
  const [paidBy, setPaidBy] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Active orders for the table (not cancelled)
  const { data: orders = [] } = useQuery({
    queryKey: ['table-orders-active', table?.id],
    queryFn: async () => {
      if (!table?.id) return [];
      const { data } = await supabase
        .from('orders')
        .select('id, total, status, created_at')
        .eq('table_id', table.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!table?.id && open,
  });

  // Existing partial payments (not yet closed)
  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ['table-partials', table?.id],
    queryFn: async () => {
      if (!table?.id) return [];
      const { data } = await (supabase as any)
        .from('table_partial_payments')
        .select('*')
        .eq('table_id', table.id)
        .eq('closed', false)
        .order('created_at', { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!table?.id && open,
  });

  const totalBill = useMemo(() => orders.reduce((s, o) => s + Number(o.total || 0), 0), [orders]);
  const totalPaid = useMemo(() => payments.reduce((s, p) => s + Number(p.amount || 0), 0), [payments]);
  const peoplePaidCount = useMemo(() => payments.reduce((s, p) => s + Number(p.people_count || 0), 0), [payments]);
  const remaining = Math.max(0, totalBill - totalPaid);
  const peopleRemaining = Math.max(0, peopleAtTable - peoplePaidCount);
  const perPerson = peopleRemaining > 0 ? remaining / peopleRemaining : 0;
  const suggestedAmount = perPerson * payingPeople;

  const handleAddPayment = async () => {
    if (!restaurantId || !table?.id) return;
    const amount = customAmount ? Number(customAmount.replace(',', '.')) : suggestedAmount;
    if (!amount || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (amount > remaining + 0.01) {
      toast.error(`Valor maior que o saldo restante (${fmt(remaining)})`);
      return;
    }
    if (payingPeople > peopleRemaining) {
      toast.error('Mais pessoas pagando do que faltam na mesa');
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).from('table_partial_payments').insert({
      restaurant_id: restaurantId,
      table_id: table.id,
      amount,
      people_count: payingPeople,
      payment_method: method,
      paid_by: paidBy || null,
      created_by: user?.id || null,
    });

    // Also log financial transaction
    await (supabase as any).from('financial_transactions').insert({
      restaurant_id: restaurantId,
      amount,
      type: 'partial_payment',
      description: `Pagamento parcial mesa ${table.number}${paidBy ? ` — ${paidBy}` : ''} (${payingPeople} ${payingPeople === 1 ? 'pessoa' : 'pessoas'})`,
    });

    setSubmitting(false);
    if (error) {
      toast.error('Erro ao registrar pagamento');
      return;
    }
    toast.success(`Pagamento de ${fmt(amount)} registrado!`);
    setCustomAmount('');
    setPaidBy('');
    setPayingPeople(1);
    refetchPayments();
  };

  const handleDeletePayment = async (id: string, amount: number) => {
    if (!confirm(`Estornar este pagamento de ${fmt(amount)}?`)) return;
    await (supabase as any).from('table_partial_payments').delete().eq('id', id);
    toast.success('Pagamento estornado');
    refetchPayments();
  };

  const handleCloseTable = async () => {
    if (!restaurantId || !table?.id) return;
    if (remaining > 0.01) {
      toast.error(`Ainda falta ${fmt(remaining)} para fechar a mesa`);
      return;
    }
    // Mark partials as closed
    await (supabase as any)
      .from('table_partial_payments')
      .update({ closed: true })
      .eq('table_id', table.id)
      .eq('closed', false);

    // Mark orders as completed (if not already)
    await supabase
      .from('orders')
      .update({ status: 'completed' as any })
      .eq('table_id', table.id)
      .in('status', ['new', 'accepted', 'preparing', 'ready'] as any);

    // Free the table
    await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', table.id);

    // End sessions
    await (supabase as any).from('table_sessions').update({ status: 'closed' }).eq('table_id', table.id).eq('status', 'active');

    queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
    toast.success('Mesa fechada com sucesso! 🎉');
    onOpenChange(false);
    onTableClosed?.();
  };

  if (!table) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Pagamento Parcial — {table.label || `Mesa ${table.number}`}
          </DialogTitle>
          <DialogDescription>Registre quem já pagou e veja quanto falta</DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
            <p className="text-sm font-bold">{fmt(totalBill)}</p>
          </div>
          <div className="rounded-lg bg-success/10 p-3 text-center">
            <p className="text-[10px] text-success uppercase">Pago</p>
            <p className="text-sm font-bold text-success">{fmt(totalPaid)}</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${remaining > 0.01 ? 'bg-destructive/10' : 'bg-success/20'}`}>
            <p className={`text-[10px] uppercase ${remaining > 0.01 ? 'text-destructive' : 'text-success'}`}>Falta</p>
            <p className={`text-sm font-bold ${remaining > 0.01 ? 'text-destructive' : 'text-success'}`}>{fmt(remaining)}</p>
          </div>
        </div>

        {/* People management */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm flex items-center gap-1">
              <Users className="h-4 w-4" /> Pessoas na mesa
            </Label>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                onClick={() => setPeopleAtTable(p => Math.max(peoplePaidCount + 1, p - 1))}
                disabled={peopleAtTable <= peoplePaidCount + 1 || peopleAtTable <= 1}>−</Button>
              <Input
                type="number"
                min={Math.max(1, peoplePaidCount)}
                value={peopleAtTable}
                onChange={e => setPeopleAtTable(Math.max(1, Number(e.target.value) || 1))}
                className="w-14 h-7 text-center"
              />
              <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                onClick={() => setPeopleAtTable(p => p + 1)}>+</Button>
            </div>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Já pagaram: <strong className="text-foreground">{peoplePaidCount}</strong></span>
            <span className="text-muted-foreground">Faltam: <strong className="text-foreground">{peopleRemaining}</strong></span>
          </div>
          {peopleRemaining > 0 && remaining > 0.01 && (
            <div className="bg-primary/10 rounded p-2 text-center">
              <p className="text-[11px] text-muted-foreground">Por pessoa restante</p>
              <p className="text-lg font-bold text-primary">{fmt(perPerson)}</p>
            </div>
          )}
        </div>

        {/* New payment form */}
        {remaining > 0.01 && peopleRemaining > 0 && (
          <div className="rounded-lg border border-primary/30 p-3 space-y-3 bg-primary/5">
            <p className="text-sm font-medium flex items-center gap-1">
              <Plus className="h-4 w-4" /> Registrar pagamento
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Pessoas pagando</Label>
                <div className="flex items-center gap-1 mt-1">
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                    onClick={() => setPayingPeople(p => Math.max(1, p - 1))} disabled={payingPeople <= 1}>−</Button>
                  <Input type="number" min={1} max={peopleRemaining} value={payingPeople}
                    onChange={e => setPayingPeople(Math.max(1, Math.min(peopleRemaining, Number(e.target.value) || 1)))}
                    className="text-center h-8" />
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                    onClick={() => setPayingPeople(p => Math.min(peopleRemaining, p + 1))}
                    disabled={payingPeople >= peopleRemaining}>+</Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Forma de pagamento</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Valor (sugerido: {fmt(suggestedAmount)})</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder={suggestedAmount.toFixed(2).replace('.', ',')}
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                className="mt-1 h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Nome (opcional)</Label>
              <Input
                placeholder="Ex: João, Pessoa 1..."
                value={paidBy}
                onChange={e => setPaidBy(e.target.value)}
                maxLength={40}
                className="mt-1 h-8"
              />
            </div>
            <Button onClick={handleAddPayment} disabled={submitting} className="w-full h-9">
              <DollarSign className="h-4 w-4 mr-1" /> Confirmar pagamento
            </Button>
          </div>
        )}

        {/* Existing payments */}
        {payments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Pagamentos registrados</p>
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{p.paid_by || `${p.people_count} ${p.people_count === 1 ? 'pessoa' : 'pessoas'}`}</span>
                    <Badge variant="outline" className="text-[10px] h-4">{PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label || p.payment_method}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {p.people_count} {p.people_count === 1 ? 'pessoa' : 'pessoas'} • {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="font-bold text-success tabular-nums">{fmt(Number(p.amount))}</span>
                <button onClick={() => handleDeletePayment(p.id, Number(p.amount))}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Close table */}
        <Button
          onClick={handleCloseTable}
          disabled={remaining > 0.01 || totalBill === 0}
          className="w-full h-11"
          variant={remaining <= 0.01 && totalBill > 0 ? 'default' : 'outline'}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          {remaining <= 0.01 && totalBill > 0 ? 'Fechar mesa (saldo zerado)' : `Fechar mesa — falta ${fmt(remaining)}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
