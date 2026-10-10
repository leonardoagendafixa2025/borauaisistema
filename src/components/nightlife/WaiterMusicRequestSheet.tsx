import { useState } from 'react';
import { Disc3, Send, Loader2, Music } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSubmitMusicRequest, useOpenCommandsForTable } from '@/hooks/useMusicRequests';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/**
 * Sheet para o garçom lançar pedido de música em nome do cliente da mesa.
 * Reutiliza o submit hook (mesmo fluxo de aprovação/cobrança via approve_music_request).
 */
export default function WaiterMusicRequestSheet({
  open,
  onOpenChange,
  restaurantId,
  tableLabel,
  customerName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  restaurantId: string;
  tableLabel: string; // ex: "Mesa 5"
  customerName?: string;
}) {
  const [song, setSong] = useState('');
  const [dedication, setDedication] = useState('');
  const [billingMode, setBillingMode] = useState<'table' | 'command'>('table');
  const [commandId, setCommandId] = useState<string | null>(null);
  const submit = useSubmitMusicRequest();
  const { data: openCommands = [] } = useOpenCommandsForTable(open ? restaurantId : null, open ? tableLabel : null);

  // Busca settings (preço + se está habilitado) só quando abre
  const { data: settings } = useQuery({
    queryKey: ['restaurant-music-settings', restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_settings' as any)
        .select('music_requests_enabled, music_requests_price, music_requests_require_approval')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!restaurantId && open,
    staleTime: 60_000,
  });

  const enabled = settings?.music_requests_enabled === true;
  const requireApproval = settings?.music_requests_require_approval === true;
  const price = Number(settings?.music_requests_price || 0);

  const handleSend = async () => {
    if (!song.trim() || song.trim().length < 2) {
      toast.error('Digite o nome da música');
      return;
    }
    if (price > 0 && billingMode === 'command' && !commandId) {
      toast.error('Escolha em qual comanda lançar');
      return;
    }
    try {
      await submit.mutateAsync({
        restaurant_id: restaurantId,
        song_text: song,
        dedication: dedication || undefined,
        customer_name: customerName,
        table_label: tableLabel,
        price,
        billing_mode: billingMode,
        command_id: billingMode === 'command' ? commandId : null,
      });
      toast.success(
        requireApproval
          ? '⏳ Enviado para aprovação do DJ'
          : price > 0
            ? `🎵 Lançado! ${fmt(price)} entra ${billingMode === 'command' ? 'na comanda escolhida' : 'na conta da mesa'} quando aprovado.`
            : '🎵 Pedido enviado pro DJ!',
      );
      setSong('');
      setDedication('');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Disc3 className="h-5 w-5 text-primary" />
            Pedir música pro DJ
          </SheetTitle>
          <SheetDescription>
            {tableLabel}
            {price > 0 && enabled && ` · taxa ${fmt(price)} (lançada na comanda quando aprovado)`}
          </SheetDescription>
        </SheetHeader>

        {!enabled ? (
          <div className="py-8 text-center">
            <Music className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Pedidos de música estão desativados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ative em Programação Noite → Pedidos de música.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-4 pb-6">
            <div>
              <label className="text-xs font-medium block mb-1">Música / Artista *</label>
              <input
                value={song}
                onChange={(e) => setSong(e.target.value)}
                maxLength={200}
                autoFocus
                placeholder="Ex: Evidências - Chitãozinho e Xororó"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Dedicatória (opcional)</label>
              <textarea
                value={dedication}
                onChange={(e) => setDedication(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Pra galera da mesa que tá fazendo aniversário..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {price > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cobrar de quem? · {fmt(price)}
                </p>
                <label className="flex items-start gap-2 cursor-pointer rounded-md p-1.5 hover:bg-muted/50">
                  <input
                    type="radio"
                    checked={billingMode === 'table'}
                    onChange={() => { setBillingMode('table'); setCommandId(null); }}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-sm">
                    🤝 <strong>Dividir com a mesa</strong>
                    <span className="block text-[11px] text-muted-foreground">Item "Músicas da mesa" no fechamento.</span>
                  </span>
                </label>
                {openCommands.length > 0 ? (
                  <>
                    <label className="flex items-start gap-2 cursor-pointer rounded-md p-1.5 hover:bg-muted/50">
                      <input
                        type="radio"
                        checked={billingMode === 'command'}
                        onChange={() => setBillingMode('command')}
                        className="mt-0.5 accent-primary"
                      />
                      <span className="text-sm">
                        🙋 <strong>Cobrar de uma comanda</strong>
                      </span>
                    </label>
                    {billingMode === 'command' && (
                      <div className="ml-6 space-y-1">
                        {openCommands.map((c) => (
                          <label
                            key={c.id}
                            className={`flex items-center justify-between gap-2 cursor-pointer rounded-md px-2 py-1.5 text-sm border transition ${
                              commandId === c.id ? 'bg-primary/10 border-primary/40' : 'border-border hover:bg-muted/50'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <input
                                type="radio"
                                checked={commandId === c.id}
                                onChange={() => setCommandId(c.id)}
                                className="accent-primary"
                              />
                              <span className="truncate">{c.customer_name}</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0">{fmt(c.open_total)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground px-1.5">
                    Nenhuma comanda aberta nessa mesa — vai pra conta da mesa.
                  </p>
                )}
              </div>
            )}

            {requireApproval && (
              <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-2">
                ⏳ DJ revisa antes de entrar na fila.
              </p>
            )}

            <Button onClick={handleSend} disabled={submit.isPending} className="w-full">
              {submit.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar pedido
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
