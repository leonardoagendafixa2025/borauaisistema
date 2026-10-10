import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Music, Disc3, Flame, Clock, Users, Headphones, Mic2,
  ArrowLeft, Sparkles, TrendingUp, Heart, Volume2, Zap,
  CheckCircle2, Play,
} from 'lucide-react';

// ════════════════════════════════════════════════════════
// DEMO MODO BALADA — mock animado sempre vivo
// Sem banco. Sem auth. Visitante chega a qualquer hora
// e vê fila rolando, hour drink em countdown, line-up evoluindo.
// ════════════════════════════════════════════════════════

type Track = {
  id: string;
  title: string;
  artist: string;
  requester: string;
  table: string;
  tip: number;
  votes: number;
  status: 'playing' | 'next' | 'queue' | 'pending';
  cover: string;
};

const SEED_TRACKS: Track[] = [
  { id: '1', title: 'Evidências', artist: 'Chitãozinho & Xororó', requester: 'Bruno', table: 'Mesa 7', tip: 15, votes: 42, status: 'playing', cover: '🎤' },
  { id: '2', title: 'Garçom', artist: 'Reginaldo Rossi', requester: 'Carla', table: 'Mesa 12', tip: 25, votes: 38, status: 'next', cover: '🍺' },
  { id: '3', title: 'Liga Pra Mim', artist: 'Henrique & Juliano', requester: 'Diego', table: 'Bar', tip: 10, votes: 29, status: 'queue', cover: '🤠' },
  { id: '4', title: 'Anti-Herói', artist: 'Marília Mendonça', requester: 'Ana', table: 'Mesa 3', tip: 20, votes: 27, status: 'queue', cover: '💔' },
  { id: '5', title: 'Volta', artist: 'Lauana Prado', requester: 'Felipe', table: 'Mesa 9', tip: 8, votes: 18, status: 'queue', cover: '🌹' },
  { id: '6', title: 'Solteiro Forçado', artist: 'Marcos & Belutti', requester: 'Júlia', table: 'Mesa 5', tip: 12, votes: 14, status: 'queue', cover: '🎸' },
  { id: '7', title: 'Pipoco', artist: 'Ana Castela', requester: 'Lucas', table: 'Mesa 1', tip: 5, votes: 9, status: 'pending', cover: '🌽' },
  { id: '8', title: 'Cabaré', artist: 'Henrique & Juliano', requester: 'Marina', table: 'Mesa 8', tip: 30, votes: 7, status: 'pending', cover: '💃' },
];

const HOUR_DRINKS = [
  { name: 'Caipirinha de Maracujá', original: 18, promo: 9, emoji: '🍹', desc: 'Cachaça artesanal + maracujá fresco' },
  { name: 'Chopp Pilsen 600ml', original: 16, promo: 8, emoji: '🍺', desc: 'Geladíssimo, colarinho perfeito' },
  { name: 'Gin Tropical', original: 28, promo: 14, emoji: '🍸', desc: 'Gin + abacaxi + manjericão' },
  { name: 'Combo 2 Caipirosca', original: 36, promo: 18, emoji: '🥃', desc: 'Vodka premium + frutas vermelhas' },
];

const LINEUP = [
  { time: '20:00', artist: 'DJ Lê Costa', genre: 'Sunset / Lounge', status: 'done' as const },
  { time: '22:00', artist: 'Banda Pé na Estrada', genre: 'Sertanejo Raiz', status: 'live' as const },
  { time: '00:00', artist: 'DJ Marcão', genre: 'Sertanejo Universitário', status: 'next' as const },
  { time: '02:00', artist: 'After Set — DJ Bia', genre: 'House Remix', status: 'soon' as const },
];

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DemoBalada() {
  // ─── Hour Drink countdown loop (15 min) ───
  const [drinkIdx, setDrinkIdx] = useState(0);
  const [drinkEnd, setDrinkEnd] = useState(() => Date.now() + 15 * 60 * 1000);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (now >= drinkEnd) {
      setDrinkIdx(i => (i + 1) % HOUR_DRINKS.length);
      setDrinkEnd(Date.now() + 15 * 60 * 1000);
    }
  }, [now, drinkEnd]);

  // ─── Queue rotation: every ~12s, "playing" finishes, next becomes playing ───
  const [tracks, setTracks] = useState<Track[]>(SEED_TRACKS);
  const tickRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      tickRef.current += 1;
      setTracks(prev => {
        const next = [...prev];
        // bump votes randomly
        next.forEach(tr => {
          if (tr.status === 'queue' || tr.status === 'pending') {
            if (Math.random() > 0.55) tr.votes += 1;
          }
        });
        // every 4 ticks (~24s) advance the queue
        if (tickRef.current % 4 === 0) {
          const playingIdx = next.findIndex(t => t.status === 'playing');
          const nextIdx = next.findIndex(t => t.status === 'next');
          if (playingIdx >= 0) {
            // move played to bottom (history removed)
            next.splice(playingIdx, 1);
          }
          if (nextIdx >= 0) {
            const newPlayingIdx = next.findIndex(t => t.status === 'next');
            next[newPlayingIdx].status = 'playing';
          }
          // first 'queue' becomes 'next'
          const firstQueue = next.findIndex(t => t.status === 'queue');
          if (firstQueue >= 0) next[firstQueue].status = 'next';

          // add a fresh "pending" at the bottom
          const pool = [
            { title: 'Senhorita', artist: 'Henrique & Diego', cover: '👒' },
            { title: 'Coração Cigano', artist: 'Maiara & Maraisa', cover: '💃' },
            { title: 'Ai Se Eu Te Pego', artist: 'Michel Teló', cover: '🔥' },
            { title: 'Cuida Bem Dela', artist: 'Henrique & Juliano', cover: '💕' },
            { title: 'Festa', artist: 'Luan Santana', cover: '🎉' },
            { title: 'Largado às Traças', artist: 'Zé Neto & Cristiano', cover: '🥃' },
          ];
          const requesters = ['Pedro', 'Camila', 'Rafa', 'Bia', 'Tiago', 'Yasmin', 'Murilo'];
          const tables = ['Mesa 2', 'Mesa 4', 'Mesa 6', 'Mesa 11', 'Bar', 'Camarote 1'];
          const r = pool[Math.floor(Math.random() * pool.length)];
          next.push({
            id: `gen-${Date.now()}`,
            title: r.title,
            artist: r.artist,
            cover: r.cover,
            requester: requesters[Math.floor(Math.random() * requesters.length)],
            table: tables[Math.floor(Math.random() * tables.length)],
            tip: [5, 8, 10, 15, 20, 25][Math.floor(Math.random() * 6)],
            votes: Math.floor(Math.random() * 5) + 1,
            status: 'pending',
          });
        }
        // resort queue/pending by votes
        const playing = next.filter(t => t.status === 'playing');
        const next1 = next.filter(t => t.status === 'next');
        const queue = next.filter(t => t.status === 'queue').sort((a, b) => b.votes - a.votes);
        const pending = next.filter(t => t.status === 'pending').sort((a, b) => b.votes - a.votes);
        return [...playing, ...next1, ...queue, ...pending].slice(0, 12);
      });
    }, 6000);
    return () => clearInterval(t);
  }, []);

  // ─── Live KPIs that drift ───
  const [kpis, setKpis] = useState({ revenue: 4280, requests: 47, people: 184, avgTicket: 38 });
  useEffect(() => {
    const t = setInterval(() => {
      setKpis(k => ({
        revenue: k.revenue + Math.floor(Math.random() * 80),
        requests: k.requests + (Math.random() > 0.6 ? 1 : 0),
        people: Math.max(120, k.people + (Math.random() > 0.5 ? 1 : -1)),
        avgTicket: 36 + Math.floor(Math.random() * 8),
      }));
    }, 3500);
    return () => clearInterval(t);
  }, []);

  const playingTrack = tracks.find(t => t.status === 'playing');
  const nextTrack = tracks.find(t => t.status === 'next');
  const queueTracks = tracks.filter(t => t.status === 'queue').slice(0, 5);
  const pendingTracks = tracks.filter(t => t.status === 'pending').slice(0, 4);
  const drink = HOUR_DRINKS[drinkIdx];
  const remainingMs = drinkEnd - now;
  const drinkProgress = 100 - (remainingMs / (15 * 60 * 1000)) * 100;

  return (
    <div className="min-h-screen bg-[#08060f] text-white font-body overflow-x-hidden relative">
      {/* Animated nightclub background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-purple-600/30 blur-[140px] animate-pulse-slow" />
        <div className="absolute top-[30%] -right-40 w-[500px] h-[500px] rounded-full bg-pink-500/25 blur-[140px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-cyan-400/20 blur-[120px] animate-pulse-slow" style={{ animationDelay: '3s' }} />
        {/* Strobe scan lines */}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(255,255,255,0.015)_50%)] bg-[length:100%_4px]" />
      </div>

      {/* ─── Top bar ─── */}
      <header className="relative z-20 border-b border-white/10 backdrop-blur-xl bg-black/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar para Bora Uai</span>
            <span className="sm:hidden">Voltar</span>
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-pink-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">Demo interativa</span>
          </div>
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-lg shadow-pink-500/40 hover:scale-[1.03] active:scale-95 transition-all"
          >
            Quero no meu bar
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ─── Hero strip: Now Playing + Live KPIs ─── */}
        <section className="grid lg:grid-cols-[1.4fr_1fr] gap-4 lg:gap-6 mb-6">
          {/* NOW PLAYING — gigante */}
          <div className="relative overflow-hidden rounded-3xl border border-pink-500/30 bg-gradient-to-br from-purple-900/60 via-pink-900/40 to-black/60 p-6 sm:p-8 shadow-2xl shadow-pink-500/20">
            {/* Equalizer bars background */}
            <div className="absolute right-6 top-6 flex gap-1 items-end h-12 opacity-40">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-gradient-to-t from-pink-500 to-purple-300 rounded-full animate-pulse"
                  style={{
                    height: `${30 + Math.sin(now / 200 + i) * 30 + Math.random() * 20}%`,
                    animationDelay: `${i * 0.07}s`,
                    animationDuration: `${0.4 + (i % 3) * 0.2}s`,
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-pink-400" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-pink-400 animate-ping" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-pink-300">Tocando agora</span>
            </div>

            <div className="flex items-start gap-4 sm:gap-5">
              <div className="text-6xl sm:text-7xl flex-shrink-0 animate-spin-slow">
                <Disc3 className="h-16 w-16 sm:h-20 sm:w-20 text-pink-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading font-black text-2xl sm:text-4xl leading-tight truncate">
                  {playingTrack?.title}
                </h2>
                <p className="text-base sm:text-lg text-white/70 truncate mt-1">{playingTrack?.artist}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2.5 py-1 text-[11px] font-semibold">
                    <Heart className="h-3 w-3 text-pink-400 fill-pink-400" /> Pediu: {playingTrack?.requester} • {playingTrack?.table}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                    R$ {playingTrack?.tip} de gorjeta
                  </span>
                </div>
              </div>
            </div>

            {/* Audio progress bar */}
            <div className="mt-5 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-purple-400 transition-all"
                style={{ width: `${(now / 100) % 100}%` }}
              />
            </div>
          </div>

          {/* LIVE KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard icon={TrendingUp} label="Faturamento ao vivo" value={`R$ ${kpis.revenue.toLocaleString('pt-BR')}`} color="emerald" />
            <KpiCard icon={Music} label="Pedidos de música" value={kpis.requests.toString()} color="pink" />
            <KpiCard icon={Users} label="Pessoas no salão" value={kpis.people.toString()} color="cyan" />
            <KpiCard icon={Zap} label="Ticket médio" value={`R$ ${kpis.avgTicket}`} color="amber" />
          </div>
        </section>

        {/* ─── Hour Drink + Lineup ─── */}
        <section className="grid lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
          {/* HOUR DRINK */}
          <div className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/20 via-orange-600/15 to-red-700/20 p-6 sm:p-7">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-5 w-5 text-amber-400 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300">Hour drink • acaba em</span>
              <span className="ml-auto font-mono text-2xl font-black text-amber-300 tabular-nums">
                {formatCountdown(remainingMs)}
              </span>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-7xl">{drink.emoji}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-black text-2xl sm:text-3xl leading-tight">{drink.name}</h3>
                <p className="text-sm text-white/70 mt-1">{drink.desc}</p>
                <div className="flex items-baseline gap-3 mt-3">
                  <span className="text-3xl font-black text-amber-300">R$ {drink.promo}</span>
                  <span className="text-base line-through text-white/40">R$ {drink.original}</span>
                  <span className="rounded-full bg-amber-400 text-black text-xs font-black px-2 py-0.5">-50%</span>
                </div>
              </div>
            </div>

            <div className="mt-5 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-1000"
                style={{ width: `${drinkProgress}%` }}
              />
            </div>
          </div>

          {/* LINE-UP */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
            <div className="flex items-center gap-2 mb-5">
              <Mic2 className="h-5 w-5 text-purple-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">Line-up de hoje</span>
            </div>

            <div className="space-y-3">
              {LINEUP.map((slot, i) => (
                <div
                  key={i}
                  className={`relative flex items-center gap-3 rounded-2xl p-3 transition-all ${
                    slot.status === 'live'
                      ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-400/40'
                      : slot.status === 'done'
                      ? 'bg-white/[0.02] border border-white/5 opacity-50'
                      : 'bg-white/[0.04] border border-white/10'
                  }`}
                >
                  <div className="flex-shrink-0 w-14 text-center">
                    <div className="font-mono font-black text-lg text-white/90">{slot.time}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-bold text-base truncate">{slot.artist}</div>
                    <div className="text-xs text-white/60 truncate">{slot.genre}</div>
                  </div>
                  {slot.status === 'live' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-pink-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> No palco
                    </span>
                  )}
                  {slot.status === 'next' && (
                    <span className="rounded-full bg-purple-500/30 border border-purple-400/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-200">
                      Próximo
                    </span>
                  )}
                  {slot.status === 'done' && <CheckCircle2 className="h-4 w-4 text-white/30" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── DJ Queue ─── */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden mb-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-purple-900/30 to-transparent">
            <div className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-purple-300" />
              <h3 className="font-heading font-black text-lg">Fila do DJ</h3>
              <span className="rounded-full bg-purple-500/30 px-2 py-0.5 text-[11px] font-bold text-purple-200">
                {queueTracks.length + pendingTracks.length + 1} na fila
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/50">
              <Volume2 className="h-3.5 w-3.5" />
              Ordenado por gorjeta + votos
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {/* Next up */}
            {nextTrack && <TrackRow track={nextTrack} position="next" />}
            {/* Queue */}
            {queueTracks.map((t, i) => (
              <TrackRow key={t.id} track={t} position={`#${i + 2}`} />
            ))}
            {/* Pending DJ approval */}
            {pendingTracks.length > 0 && (
              <div className="px-6 py-2 bg-amber-500/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300/80">
                  Aguardando aprovação do DJ
                </span>
              </div>
            )}
            {pendingTracks.map(t => (
              <TrackRow key={t.id} track={t} position="?" pending />
            ))}
          </div>
        </section>

        {/* ─── How it works ─── */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 sm:p-8 mb-6">
          <h3 className="font-heading font-black text-xl sm:text-2xl mb-5 text-center">
            Como funciona o <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Modo Balada</span>
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <Step n={1} icon={Music} title="Cliente pede pelo QR" desc="Escaneia, escolhe a música, paga a gorjeta no PIX. Cai direto na fila." color="pink" />
            <Step n={2} icon={Headphones} title="DJ aprova ou recusa" desc="Painel mostra fila por gorjeta + votos. Aceita, rejeita com motivo, ou bloqueia palavrão." color="purple" />
            <Step n={3} icon={Flame} title="Hour drink ao vivo" desc="Bar configura promoção da hora, countdown público no cardápio empurra a venda." color="amber" />
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="text-center py-8">
          <h3 className="font-heading font-black text-3xl sm:text-4xl mb-3">
            Pronto pra encher a casa?
          </h3>
          <p className="text-white/70 mb-6 max-w-xl mx-auto">
            Modo Balada está incluído nos planos Profissional e Premium. Teste 14 dias grátis, sem cartão.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/cadastro"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 px-8 py-4 text-base font-bold shadow-2xl shadow-pink-500/40 hover:scale-[1.03] active:scale-95 transition-all"
            >
              <Play className="h-5 w-5" /> Começar grátis
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/5 border border-white/15 px-8 py-4 text-base font-semibold hover:bg-white/10 transition-all"
            >
              Ver outras funcionalidades
            </Link>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 6s linear infinite; }
        @keyframes pulse-slow { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───
function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-400/30 text-emerald-300',
    pink: 'from-pink-500/20 to-pink-500/5 border-pink-400/30 text-pink-300',
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-400/30 text-cyan-300',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-400/30 text-amber-300',
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${colors[color]} p-4`}>
      <Icon className="h-4 w-4 mb-2 opacity-80" />
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
      <div className="font-heading font-black text-xl sm:text-2xl text-white mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function TrackRow({ track, position, pending }: { track: Track; position: string; pending?: boolean }) {
  const isNext = position === 'next';
  return (
    <div className={`flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors hover:bg-white/[0.03] ${isNext ? 'bg-purple-500/5' : ''}`}>
      <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-sm ${
        isNext ? 'bg-purple-500 text-white' : pending ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-white/60'
      }`}>
        {isNext ? '▶' : position}
      </div>
      <div className="text-2xl flex-shrink-0">{track.cover}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm sm:text-base truncate">{track.title}</div>
        <div className="text-[11px] sm:text-xs text-white/50 truncate">
          {track.artist} • {track.requester} ({track.table})
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          <Heart className="h-2.5 w-2.5 text-pink-400" /> {track.votes}
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black ${
          track.tip >= 20 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/80'
        }`}>
          R$ {track.tip}
        </span>
      </div>
    </div>
  );
}

function Step({ n, icon: Icon, title, desc, color }: { n: number; icon: any; title: string; desc: string; color: string }) {
  const colors: Record<string, string> = {
    pink: 'from-pink-500 to-pink-600',
    purple: 'from-purple-500 to-purple-600',
    amber: 'from-amber-500 to-orange-600',
  };
  return (
    <div className="relative rounded-2xl bg-white/[0.03] border border-white/10 p-5">
      <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center font-black text-sm shadow-lg`}>
        {n}
      </div>
      <Icon className="h-6 w-6 text-white/80 mb-3" />
      <h4 className="font-heading font-black text-base mb-1.5">{title}</h4>
      <p className="text-xs text-white/60 leading-relaxed">{desc}</p>
    </div>
  );
}
