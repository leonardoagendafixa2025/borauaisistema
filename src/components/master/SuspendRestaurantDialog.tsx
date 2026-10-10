import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Ban, CheckCircle } from 'lucide-react';

interface Props {
  restaurant: { id: string; name: string; status: string } | null;
  mode: 'suspend' | 'reactivate';
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function SuspendRestaurantDialog({ restaurant, mode, open, onClose, onDone }: Props) {
  const [reason, setReason] = useState('non_payment');
  const [details, setDetails] = useState('');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!restaurant) return null;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const newStatus = mode === 'suspend' ? 'suspended' : 'active';
      const fullReason = mode === 'suspend' ? `${reason}: ${details}` : null;

      const { error } = await supabase.from('restaurants').update({
        status: newStatus as any,
        suspension_reason: fullReason,
        suspended_at: mode === 'suspend' ? new Date().toISOString() : null,
      } as any).eq('id', restaurant.id);
      if (error) throw error;

      if (notify) {
        const body = mode === 'suspend'
          ? `🚫 *${restaurant.name}*, sua conta foi suspensa.\n\nMotivo: ${details || reason}\n\nEntre em contato com o suporte.`
          : `✅ *${restaurant.name}*, sua conta foi reativada! Bem-vindo(a) de volta.`;
        await supabase.functions.invoke('master-broadcast', {
          body: {
            channel: 'telegram',
            template_key: mode === 'suspend' ? 'subscription_suspended' : 'broadcast_default',
            body,
            segment: { restaurant_ids: [restaurant.id] },
          },
        });
      }

      toast.success(mode === 'suspend' ? 'Restaurante suspenso' : 'Restaurante reativado');
      onDone();
      onClose();
      setDetails(''); setReason('non_payment');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'suspend' ? <Ban className="h-5 w-5 text-destructive" /> : <CheckCircle className="h-5 w-5 text-success" />}
            {mode === 'suspend' ? 'Suspender' : 'Reativar'} {restaurant.name}
          </DialogTitle>
          <DialogDescription>
            {mode === 'suspend'
              ? 'Esta ação bloqueia o acesso ao painel e ao cardápio público. Será registrada na auditoria.'
              : 'Restaura todos os acessos do restaurante.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {mode === 'suspend' && (
            <>
              <div className="space-y-1">
                <Label>Motivo</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="non_payment">Falta de pagamento</SelectItem>
                    <SelectItem value="tos_violation">Violação dos termos</SelectItem>
                    <SelectItem value="customer_request">Pedido do próprio cliente</SelectItem>
                    <SelectItem value="suspected_fraud">Suspeita de fraude</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Detalhes (obrigatório)</Label>
                <Textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} placeholder="Descreva o motivo..." />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
            Notificar o dono via Telegram
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              variant={mode === 'suspend' ? 'destructive' : 'default'}
              onClick={handleConfirm}
              disabled={saving || (mode === 'suspend' && !details.trim())}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === 'suspend' ? 'Suspender' : 'Reativar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
