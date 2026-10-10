import { useState, useMemo } from 'react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Receipt, AlertCircle, CheckCircle2, Clock, Trash2, DollarSign, TrendingDown, Calendar } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import MetricCard from '@/components/MetricCard';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning', icon: Clock },
  paid: { label: 'Pago', className: 'bg-success/10 text-success', icon: CheckCircle2 },
  overdue: { label: 'Atrasado', className: 'bg-destructive/10 text-destructive', icon: AlertCircle },
  cancelled: { label: 'Cancelado', className: 'bg-muted text-muted-foreground', icon: Trash2 },
};

export default function ExpensesPage() {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [form, setForm] = useState({
    description: '', supplier: '', amount: '', due_date: new Date().toISOString().slice(0, 10),
    payment_method: 'pix', notes: '', recurring: false, category_id: '',
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', restaurantId],
    queryFn: async () => {
      const { data } = await supabase.from('expenses').select('*, expense_categories(name, color)').eq('restaurant_id', restaurantId!).order('due_date', { ascending: false });
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories', restaurantId],
    queryFn: async () => {
      const { data } = await supabase.from('expense_categories').select('*').eq('restaurant_id', restaurantId!).eq('active', true);
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(); monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const pending = expenses.filter(e => e.status === 'pending');
    const paid = expenses.filter(e => e.status === 'paid');
    const overdue = pending.filter(e => e.due_date < today);
    const monthExpenses = expenses.filter(e => e.due_date >= monthStartStr);
    return {
      totalPending: pending.reduce((s, e) => s + Number(e.amount), 0),
      totalPaid: paid.reduce((s, e) => s + Number(e.amount), 0),
      totalOverdue: overdue.reduce((s, e) => s + Number(e.amount), 0),
      monthTotal: monthExpenses.reduce((s, e) => s + Number(e.amount), 0),
      countOverdue: overdue.length,
    };
  }, [expenses]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return expenses;
    if (statusFilter === 'overdue') {
      const today = new Date().toISOString().slice(0, 10);
      return expenses.filter(e => e.status === 'pending' && e.due_date < today);
    }
    return expenses.filter(e => e.status === statusFilter);
  }, [expenses, statusFilter]);

  const handleCreate = async () => {
    if (!form.description || !form.amount || !form.due_date) { toast.error('Preencha os campos obrigatórios'); return; }
    const { error } = await supabase.from('expenses').insert({
      restaurant_id: restaurantId!,
      description: form.description,
      supplier: form.supplier || null,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      payment_method: form.payment_method,
      notes: form.notes || null,
      recurring: form.recurring,
      category_id: form.category_id || null,
    });
    if (error) { toast.error('Erro ao criar despesa'); return; }
    toast.success('Despesa criada');
    setDialogOpen(false);
    setForm({ description: '', supplier: '', amount: '', due_date: new Date().toISOString().slice(0, 10), payment_method: 'pix', notes: '', recurring: false, category_id: '' });
    queryClient.invalidateQueries({ queryKey: ['expenses', restaurantId] });
  };

  const markPaid = async (id: string) => {
    await supabase.from('expenses').update({ status: 'paid', paid_at: new Date().toISOString().slice(0, 10) } as any).eq('id', id);
    toast.success('Marcado como pago');
    queryClient.invalidateQueries({ queryKey: ['expenses', restaurantId] });
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Excluir esta despesa?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    toast.success('Despesa excluída');
    queryClient.invalidateQueries({ queryKey: ['expenses', restaurantId] });
  };

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold">Despesas e Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">Controle financeiro de saídas e fornecedores</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Despesa</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <MetricCard label="Pendente" value={fmt(stats.totalPending)} icon={Clock} />
          <MetricCard label="Atrasado" value={fmt(stats.totalOverdue)} icon={AlertCircle} change={`${stats.countOverdue} contas`} />
          <MetricCard label="Pago (total)" value={fmt(stats.totalPaid)} icon={CheckCircle2} />
          <MetricCard label="Mês atual" value={fmt(stats.monthTotal)} icon={TrendingDown} />
        </div>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Label className="text-sm">Filtrar:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="overdue">Atrasados</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma despesa encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(e => {
                const today = new Date().toISOString().slice(0, 10);
                const isOverdue = e.status === 'pending' && e.due_date < today;
                const cfg = statusConfig[isOverdue ? 'overdue' : e.status];
                const Icon = cfg.icon;
                return (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.className}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-medium text-sm">{e.description}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        {e.supplier && <span>{e.supplier}</span>}
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(e.due_date + 'T00:00').toLocaleDateString('pt-BR')}</span>
                        <Badge variant="secondary" className={cfg.className}>{cfg.label}</Badge>
                      </div>
                    </div>
                    <div className="font-bold text-base">{fmt(Number(e.amount))}</div>
                    <div className="flex gap-1">
                      {e.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => markPaid(e.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Pagar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => deleteExpense(e.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Descrição *</Label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: Conta de luz" />
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Ex: CPFL" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor *</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
                </div>
                <div>
                  <Label>Vencimento *</Label>
                  <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                    <SelectItem value="bank_transfer">Transferência</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RestaurantLayout>
  );
}
