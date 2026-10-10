import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Disc3, Send, Heart, Loader2 } from 'lucide-react';
import { useSubmitMusicRequest, usePublicMusicQueue, useOpenCommandsForTable } from '@/hooks/useMusicRequests';
import { useToast } from '@/hooks/use-toast';

type Settings = {
  music_requests_enabled?: boolean;
  music_requests_price?: number;
  music_requests_window_start?: string | null;
  music_requests_window_end?: string | null;
  music_requests_require_approval?: boolean;
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function isWithinWindow(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return true;
  const now = new Date();
  // hora local do navegador — bom o suficiente para gating de UI; servidor revalida em SP
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const s = sH * 60 + sM;
  const e = eH * 60 + eM;
  if (s <= e) return cur >= s && cur <= e;
  // janela cruza meia-noite
  return cur >= s || cur <= e;
}

export default function PublicMusicRequest({
  restaurantId,
  settings,
}: {
  restaurantId: string;
  settings: Settings | null | undefined;
}) {
  const enabled = settings?.music_requests_enabled === true;
  const requireApproval = settings?.music_requests_require_approval === true;
  const price = Number(settings?.music_requests_price || 0);
  const inWindow = isWithinWindow(settings?.music_requests_window_start, settings?.music_requests_window_end);
  const submit = useSubmitMusicRequest();
  const { data: queue = [] } = usePublicMusicQueue(enabled ? restaurantId : null);
  const { toast } = useToast();

  const [searchParams] = useSearchParams();
  const mesaFromUrl = searchParams.get('mesa');

  const [open, setOpen] = useState(!!mesaFromUrl);
  const [song, setSong] = useState('');
  const [dedication, setDedication] = useState('');
  const [name, setName] = useState('');
  const [tableLabel, setTableLabel] = useState(mesaFromUrl ? `Mesa ${mesaFromUrl}` : '');
  // 'table' = item "Músicas da mesa" (rateio) | 'command' = comanda específica
  const [billingMode, setBillingMode] = useState<'table' | 'command'>('table');
  const [commandId, setCommandId] = useState<string | null>(null);

  const { data: openCommands = [] } = useOpenCommandsForTable(
    open && tableLabel ? restaurantId : null,
    open ? tableLabel : null,
  );

  useEffect(() => {
    if (mesaFromUrl) {
      setTableLabel(`Mesa ${mesaFromUrl}`);
      setOpen(true);
    }
  }, [mesaFromUrl]);

  if (!enabled) return null;

  const handleSend = async () => {
    if (!song.trim() || song.trim().length < 2) {
      toast({ title: 'Digite o nome da música', variant: 'destructive' });
      return;
    }
    if (song.length > 200 || dedication.length > 300) {
      toast({ title: 'Texto muito longo', variant: 'destructive' });
      return;
    }
    if (price > 0 && billingMode === 'command' && !commandId) {
      toast({ title: 'Escolha em qual comanda lançar', variant: 'destructive' });
      return;
    }
    try {
      await submit.mutateAsync({
        restaurant_id: restaurantId,
        song_text: song,
        dedication: dedication || undefined,
        customer_name: name || undefined,
        table_label: tableLabel || undefined,
        price,
        billing_mode: billingMode,
        command_id: billingMode === 'command' ? commandId : null,
      });
      toast({
        title: requireApproval ? '⏳ Pedido enviado pra revisão!' : '🎶 Pedido enviado!',
        description: requireApproval
          ? (price > 0
            ? `Aguardando aprovação do DJ. Após aprovado, vá ao caixa e pague ${fmt(price)}.`
            : 'O DJ vai revisar e aprovar pra entrar na fila.')
          : (price > 0
            ? `Vá ao caixa e pague ${fmt(price)} pra entrar na fila do DJ.`
            : 'Sua música foi enviada para o DJ.'),
      });
      setSong('');
      setDedication('');
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const playing = queue.find((q) => q.status === 'playing');
  const queued = queue.filter((q) => q.status === 'queued');

  return (
    <section className="mb-8">
      <div className="rounded-3xl bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-fuchsia-500/30 backdrop-blur-xl border border-cyan-400/30 p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <Disc3 className="absolute -bottom-4 -right-4 h-32 w-32 text-white/5 animate-spin" style={{ animationDuration: '8s' }} />
        <div className="flex items-center gap-2 mb-2">
          <Disc3 className="h-3.5 w-3.5 text-cyan-300" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-200">Peça pro DJ</span>
        </div>

        <h3 className="font-heading text-2xl md:text-3xl font-black mb-2">
          Bora colocar SUA música?
        </h3>

        {playing && (
          <p className="text-sm text-white/80 mb-2">
            🔊 Tocando agora: <strong className="text-cyan-200">{playing.song_text}</strong>
          </p>
        )}
        {queued.length > 0 && (
          <p className="text-xs text-white/60 mb-3">
            {queued.length} pedido{queued.length !== 1 ? 's' : ''} na fila
          </p>
        )}

        {!inWindow ? (
          <p className="text-sm text-white/70 bg-black/20 rounded-lg p-3 mt-3">
            Pedidos de música abrem das{' '}
            <strong>{settings?.music_requests_window_start?.slice(0, 5)}</strong> às{' '}
            <strong>{settings?.music_requests_window_end?.slice(0, 5)}</strong>. Volta mais tarde! 🎵
          </p>
        ) : !open ? (
          <button
            onClick={() => setOpen(true)}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-white text-black font-bold px-5 py-3 text-sm hover:bg-white/90 transition-all hover:scale-105 active:scale-95 shadow-xl"
          >
            <Send className="h-4 w-4" />
            Pedir música {price > 0 && `· ${fmt(price)}`}
          </button>
        ) : (
          <div className="space-y-3 mt-3">
            <div>
              <label className="text-xs font-medium text-white/80 block mb-1">Música / Artista *</label>
              <input
                value={song}
                onChange={(e) => setSong(e.target.value)}
                maxLength={200}
                placeholder="Ex: Evidências - Chitãozinho e Xororó"
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-white/80 block mb-1 flex items-center gap-1">
                <Heart className="h-3 w-3" /> Dedicatória (opcional)
              </label>
              <textarea
                value={dedication}
                onChange={(e) => setDedication(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Pra galera da mesa 5 que tá fazendo aniversário 🎂"
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                placeholder="Seu nome"
                className="rounded-lg bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400"
              />
              <input
                value={tableLabel}
                onChange={(e) => setTableLabel(e.target.value)}
                maxLength={20}
                placeholder="Mesa nº"
                className="rounded-lg bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {price > 0 && tableLabel && (
              <div className="rounded-lg bg-black/25 border border-white/15 p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                  Cobrar de quem? · {fmt(price)}
                </p>
                <label className="flex items-start gap-2 cursor-pointer rounded-md p-2 hover:bg-white/5">
                  <input
                    type="radio"
                    name="billing"
                    checked={billingMode === 'table'}
                    onChange={() => { setBillingMode('table'); setCommandId(null); }}
                    className="mt-0.5 accent-cyan-400"
                  />
                  <span className="text-sm text-white">
                    🤝 <strong>Dividir com a mesa</strong>
                    <span className="block text-[11px] text-white/60">Vai como item "Músicas da mesa" no fechamento.</span>
                  </span>
                </label>

                {openCommands.length > 0 && (
                  <>
                    <label className="flex items-start gap-2 cursor-pointer rounded-md p-2 hover:bg-white/5">
                      <input
                        type="radio"
                        name="billing"
                        checked={billingMode === 'command'}
                        onChange={() => setBillingMode('command')}
                        className="mt-0.5 accent-cyan-400"
                      />
                      <span className="text-sm text-white">
                        🙋 <strong>Cobrar só de mim</strong>
                        <span className="block text-[11px] text-white/60">Lança na minha comanda individual.</span>
                      </span>
                    </label>

                    {billingMode === 'command' && (
                      <div className="ml-6 space-y-1 pt-1">
                        {openCommands.map((c) => (
                          <label
                            key={c.id}
                            className={`flex items-center justify-between gap-2 cursor-pointer rounded-md px-2 py-1.5 text-sm border transition ${
                              commandId === c.id
                                ? 'bg-cyan-400/15 border-cyan-400/50 text-white'
                                : 'border-white/10 text-white/80 hover:bg-white/5'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <input
                                type="radio"
                                name="cmd"
                                checked={commandId === c.id}
                                onChange={() => setCommandId(c.id)}
                                className="accent-cyan-400"
                              />
                              <span className="truncate">{c.customer_name}</span>
                            </span>
                            <span className="text-[11px] text-white/50 shrink-0">{fmt(c.open_total)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {openCommands.length === 0 && (
                  <p className="text-[11px] text-white/50 px-2">
                    Nenhuma comanda individual aberta nessa mesa — vai pra conta da mesa.
                  </p>
                )}
              </div>
            )}

            {price > 0 && !tableLabel && (
              <p className="text-xs text-yellow-200 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5">
                💰 Taxa de <strong>{fmt(price)}</strong> — pague no caixa após enviar.
              </p>
            )}

            {requireApproval && (
              <p className="text-xs text-cyan-100 bg-cyan-500/10 border border-cyan-400/30 rounded-lg p-2.5">
                ⏳ Os pedidos passam por aprovação do DJ antes de entrar na fila.
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-white/20 text-white/80 text-sm font-medium py-2.5 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={submit.isPending}
                className="flex-1 rounded-lg bg-white text-black font-bold py-2.5 text-sm hover:bg-white/90 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
