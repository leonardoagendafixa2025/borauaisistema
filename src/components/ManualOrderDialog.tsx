import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRestaurantProducts, useRestaurantSettings } from '@/hooks/useRestaurantData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, Search } from 'lucide-react';
import { z } from 'zod';

interface ManualOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  notes?: string;
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const orderSchema = z.object({
  customerName: z.string().trim().min(2, 'Nome muito curto').max(100),
  customerPhone: z.string().trim().max(20).optional().or(z.literal('')),
  type: z.enum(['delivery', 'pickup', 'dine_in']),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  paymentMethod: z.string().min(1, 'Selecione a forma de pagamento'),
  notes: z.string().max(500).optional().or(z.literal('')),
});

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  cash: 'Dinheiro',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
};

export default function ManualOrderDialog({ open, onOpenChange }: ManualOrderDialogProps) {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const { data: products = [] } = useRestaurantProducts();
  const { data: settings } = useRestaurantSettings();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [type, setType] = useState<'delivery' | 'pickup' | 'dine_in'>('delivery');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const deliveryFee = type === 'delivery' ? Number(settings?.delivery_fee || 0) : 0;
  const subtotal = cart.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const total = subtotal + deliveryFee;

  const availablePayments: string[] = useMemo(() => {
    const pm = (settings?.payment_methods as string[]) || ['pix', 'cash', 'credit_card', 'debit_card'];
    return pm;
  }, [settings]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((p: any) => p.active && !p.sold_out)
      .filter((p: any) => !term || p.name.toLowerCase().includes(term))
      .slice(0, 30);
  }, [products, search]);

  const addItem = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((it) => it.productId === product.id);
      if (existing) {
        return prev.map((it) =>
          it.productId === product.id ? { ...it, qty: it.qty + 1 } : it
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: Number(product.promo_price ?? product.price),
          qty: 1,
        },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) =>
          it.productId === productId ? { ...it, qty: Math.max(0, it.qty + delta) } : it
        )
        .filter((it) => it.qty > 0)
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((it) => it.productId !== productId));
  };

  const reset = () => {
    setCustomerName('');
    setCustomerPhone('');
    setType('delivery');
    setAddress('');
    setPaymentMethod('');
    setNotes('');
    setCart([]);
    setSearch('');
  };

  const handleSubmit = async () => {
    if (!restaurantId) return;
    if (cart.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido');
      return;
    }

    const parsed = orderSchema.safeParse({
      customerName,
      customerPhone,
      type,
      address,
      paymentMethod,
      notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Dados inválidos');
      return;
    }
    if (type === 'delivery' && address.trim().length < 5) {
      toast.error('Informe o endereço de entrega');
      return;
    }

    setSubmitting(true);
    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId,
          type,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || null,
          address: type === 'delivery' ? address.trim() : null,
          subtotal,
          delivery_fee: deliveryFee,
          total,
          payment_method: paymentMethod,
          payment_status: 'pending',
          notes: notes.trim() || null,
          status: 'new',
        })
        .select()
        .single();

      if (orderErr || !order) throw orderErr || new Error('Falha ao criar pedido');

      const itemsPayload = cart.map((it) => ({
        order_id: order.id,
        product_id: it.productId,
        name: it.name,
        qty: it.qty,
        unit_price: it.unitPrice,
        total_price: it.unitPrice * it.qty,
        notes: it.notes || null,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      toast.success(`Pedido #${order.number} criado!`);
      queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pedido Manual</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 mt-2">
          {/* Left: customer + items selection */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label>Cliente *</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome do cliente" maxLength={100} />
              </div>
              <div className="col-span-2">
                <Label>Telefone / WhatsApp</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(31) 99999-9999" maxLength={20} />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivery">🛵 Entrega</SelectItem>
                    <SelectItem value="pickup">🏪 Retirada</SelectItem>
                    <SelectItem value="dine_in">🍽️ Local</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pagamento *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {availablePayments.map((pm) => (
                      <SelectItem key={pm} value={pm}>{PAYMENT_LABELS[pm] || pm}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {type === 'delivery' && (
                <div className="col-span-2">
                  <Label>Endereço de entrega *</Label>
                  <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro, complemento" rows={2} maxLength={300} />
                </div>
              )}
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sem cebola, troco para R$ 50, etc." rows={2} maxLength={500} />
              </div>
            </div>

            <div>
              <Label>Adicionar produtos</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">Nenhum produto</p>
                ) : (
                  filteredProducts.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addItem(p)}
                      className="w-full flex items-center justify-between gap-2 p-2 hover:bg-muted text-left transition-colors"
                    >
                      <span className="text-sm truncate">{p.name}</span>
                      <span className="text-sm font-medium tabular-nums shrink-0">
                        {formatCurrency(Number(p.promo_price ?? p.price))}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: cart + totals */}
          <div className="space-y-3">
            <div>
              <Label>Itens do pedido ({cart.length})</Label>
              <div className="mt-1 max-h-72 overflow-y-auto rounded-lg border border-border">
                {cart.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-4 text-center">Nenhum item adicionado</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {cart.map((it) => (
                      <li key={it.productId} className="p-2 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm flex-1">{it.name}</span>
                          <button onClick={() => removeItem(it.productId)} className="text-destructive hover:opacity-70">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateQty(it.productId, -1)} className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-sm w-6 text-center tabular-nums">{it.qty}</span>
                            <button onClick={() => updateQty(it.productId, 1)} className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-muted">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="text-sm font-medium tabular-nums">{formatCurrency(it.unitPrice * it.qty)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxa de entrega</span>
                  <span className="tabular-nums">{formatCurrency(deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-1 border-t border-border">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              💵 O pagamento é registrado para controle. O recebimento é feito diretamente pelo estabelecimento.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || cart.length === 0}>
            {submitting ? 'Criando...' : 'Criar pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
