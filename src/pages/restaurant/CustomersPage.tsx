import { Users, Search, Phone, Mail, ShoppingBag, DollarSign, Eye, Pencil, X, ChevronLeft } from 'lucide-react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import MetricCard from '@/components/MetricCard';
import ScrollReveal from '@/components/ScrollReveal';
import { useState } from 'react';
import { useRestaurantCustomers } from '@/hooks/useRestaurantData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  total_orders: number;
  total_spent: number;
  created_at: string;
  restaurant_id: string;
};

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: customers = [], isLoading } = useRestaurantCustomers();
  const queryClient = useQueryClient();
  const { restaurantId } = useAuth();

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
  );

  const totalCustomers = customers.length;
  const totalSpent = customers.reduce((s, c) => s + Number(c.total_spent), 0);
  const avgTicket = totalCustomers > 0 ? totalSpent / customers.reduce((s, c) => s + c.total_orders, 0) : 0;

  // Customer order history
  const { data: customerOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['customer-orders', selectedCustomer?.id],
    enabled: !!selectedCustomer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, number, status, type, total, created_at')
        .eq('customer_id', selectedCustomer!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditName(c.name);
    setEditPhone(c.phone || '');
    setEditEmail(c.email || '');
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer || !editName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ name: editName.trim(), phone: editPhone.trim() || null, email: editEmail.trim() || null })
        .eq('id', editingCustomer.id);
      if (error) throw error;
      toast.success('Cliente atualizado');
      queryClient.invalidateQueries({ queryKey: ['customers', restaurantId] });
      setEditingCustomer(null);
    } catch {
      toast.error('Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel: Record<string, string> = {
    new: 'Novo', accepted: 'Aceito', preparing: 'Preparando', ready: 'Pronto',
    delivering: 'Em entrega', waiting_pickup: 'Aguardando retirada', completed: 'Concluído', cancelled: 'Cancelado',
  };
  const typeLabel: Record<string, string> = { delivery: 'Delivery', pickup: 'Retirada', dine_in: 'Mesa' };

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div>
            <h1 className="font-heading text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">Base de clientes do seu restaurante</p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Total de clientes', value: totalCustomers, icon: Users },
            { label: 'Ticket médio', value: fmt(avgTicket || 0), icon: DollarSign },
            { label: 'Pedidos/cliente', value: totalCustomers > 0 ? (customers.reduce((s, c) => s + c.total_orders, 0) / totalCustomers).toFixed(1) : '0', icon: ShoppingBag },
          ].map((m, i) => (
            <ScrollReveal key={i} delay={i * 60}>
              <MetricCard {...m} />
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="card-elevated">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 pb-3 gap-3">
              <h3 className="font-heading font-semibold text-base">Todos os clientes</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm w-full sm:w-64"
                />
              </div>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhum cliente encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-border text-muted-foreground">
                      <th className="text-left font-medium px-5 py-3">Cliente</th>
                      <th className="text-left font-medium px-5 py-3 hidden sm:table-cell">Contato</th>
                      <th className="text-right font-medium px-5 py-3">Pedidos</th>
                      <th className="text-right font-medium px-5 py-3 hidden md:table-cell">Total gasto</th>
                      <th className="text-center font-medium px-5 py-3 w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-medium">{c.name}</td>
                        <td className="px-5 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-3 text-muted-foreground">
                            {c.phone && <span className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{c.phone}</span>}
                            {c.email && <span className="flex items-center gap-1 text-xs hidden md:flex"><Mail className="h-3 w-3" />{c.email}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">{c.total_orders}</td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums hidden md:table-cell">{fmt(Number(c.total_spent))}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setSelectedCustomer(c as Customer)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Ver histórico">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </button>
                            <button onClick={() => openEdit(c as Customer)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Editar">
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>

      {/* Order History Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={open => !open && setSelectedCustomer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Histórico — {selectedCustomer?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {selectedCustomer && (
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Total de pedidos</p>
                  <p className="font-bold text-lg">{selectedCustomer.total_orders}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Total gasto</p>
                  <p className="font-bold text-lg">{fmt(Number(selectedCustomer.total_spent))}</p>
                </div>
              </div>
            )}
            {loadingOrders ? (
              <p className="text-center text-sm text-muted-foreground py-6">Carregando pedidos...</p>
            ) : customerOrders.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhum pedido encontrado</p>
            ) : customerOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-medium text-sm">#{order.number}</p>
                  <p className="text-xs text-muted-foreground">{typeLabel[order.type] || order.type} • {new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{fmt(Number(order.total))}</p>
                  <p className="text-xs text-muted-foreground">{statusLabel[order.status] || order.status}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={open => !open && setEditingCustomer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Telefone</label>
              <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mt-1" />
            </div>
            <button onClick={handleSaveEdit} disabled={saving || !editName.trim()} className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </RestaurantLayout>
  );
}
