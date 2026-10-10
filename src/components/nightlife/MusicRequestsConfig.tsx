import { useEffect, useState } from 'react';
import { Disc3, ExternalLink, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantSettings } from '@/hooks/useRestaurantData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function MusicRequestsConfig() {
  const { restaurantId } = useAuth();
  const { data: settings } = useRestaurantSettings();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [price, setPrice] = useState('0');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setEnabled(Boolean((settings as any).music_requests_enabled));
    setRequireApproval(Boolean((settings as any).music_requests_require_approval));
    setPrice(String((settings as any).music_requests_price ?? 0));
    setWindowStart(((settings as any).music_requests_window_start || '').slice(0, 5));
    setWindowEnd(((settings as any).music_requests_window_end || '').slice(0, 5));
  }, [settings]);

  const save = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const payload: any = {
        music_requests_enabled: enabled,
        music_requests_require_approval: requireApproval,
        music_requests_price: Number(price) || 0,
        music_requests_window_start: windowStart || null,
        music_requests_window_end: windowEnd || null,
      };
      const { error } = await supabase
        .from('restaurant_settings')
        .update(payload as any)
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['restaurant_settings', restaurantId] });
      toast({ title: 'Configurações salvas' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card-elevated p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-heading font-bold text-lg flex items-center gap-2">
              <Disc3 className="h-5 w-5 text-primary" />
              Pedidos de música
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Cliente pode sugerir músicas pra noite. Você cobra uma taxa fixa (paga no balcão) e gerencia tudo no painel do DJ.
            </p>
          </div>
          <Link
            to="/restaurant/dj"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium whitespace-nowrap"
          >
            Painel DJ <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/20">
            <div>
              <Label className="text-base font-semibold">Aceitar pedidos de música</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Liga/desliga o formulário na tela pública.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/20">
            <div className="pr-3">
              <Label className="text-base font-semibold">Exigir aprovação manual</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quando ativado, pedidos novos ficam aguardando aprovação no painel do DJ antes de entrar na fila pública. Útil pra filtrar repetidos ou impróprios.
              </p>
            </div>
            <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
          </div>

          <div>
            <Label>Preço por pedido (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="10.00"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use 0 para pedidos gratuitos. Pagamento é registrado como pendente — confirme no painel do DJ quando o cliente pagar no caixa.
            </p>
          </div>

          <div>
            <Label>Janela de horário (opcional)</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <Input
                  type="time"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">Início (ex: 22:00)</p>
              </div>
              <div>
                <Input
                  type="time"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">Fim (ex: 04:00 — pode cruzar meia-noite)</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Deixe ambos vazios para aceitar pedidos sempre que estiver ligado. Horário do servidor: America/Sao_Paulo.
            </p>
          </div>

          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </Button>
        </div>
      </div>
    </div>
  );
}
