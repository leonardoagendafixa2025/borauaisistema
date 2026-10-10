import { useEffect, useState } from 'react';
import { Users, Trash2, Power, QrCode, Copy, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

interface StaffLink {
  id: string;
  chat_id: string;
  staff_name: string;
  active: boolean;
  created_at: string;
}

export default function TelegramStaffManager({ slug }: { slug?: string }) {
  const { restaurantId } = useAuth();
  const [staff, setStaff] = useState<StaffLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: botUsername } = useQuery({
    queryKey: ['platform-setting', 'telegram_bot_username'],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'telegram_bot_username')
        .maybeSingle();
      return (data?.value || '').replace(/^@/, '') || null;
    },
  });

  const load = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('telegram_staff_links')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    setStaff((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  const toggle = async (s: StaffLink) => {
    await supabase.from('telegram_staff_links')
      .update({ active: !s.active } as any).eq('id', s.id);
    toast.success(s.active ? 'Garçom desativado' : 'Garçom reativado');
    load();
  };

  const remove = async (s: StaffLink) => {
    if (!confirm(`Remover ${s.staff_name}?`)) return;
    await supabase.from('telegram_staff_links').delete().eq('id', s.id);
    toast.success('Removido');
    load();
  };

  const command = `/garcom ${slug || 'seu-slug'} Nome Sobrenome`;
  // Telegram deep link pre-fills the bot chat — staff still needs to type their name
  const deepLink = botUsername ? `https://t.me/${botUsername}` : null;
  const qrUrl = deepLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(deepLink)}`
    : null;

  const handleCopyCommand = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    toast.success('Comando copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-[#0088cc]" />
        <h4 className="font-semibold text-sm">Garçons vinculados</h4>
        <span className="ml-auto text-xs text-muted-foreground">
          {staff.filter(s => s.active).length} ativo(s)
        </span>
      </div>

      <div className="rounded-lg bg-muted/50 p-3 mb-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Cada garçom envia para o bot:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs font-mono truncate">
            {command}
          </code>
          <button
            onClick={handleCopyCommand}
            className="shrink-0 p-1.5 rounded border border-border hover:bg-background transition-colors"
            title="Copiar comando"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {qrUrl && (
            <button
              onClick={() => setShowQR(true)}
              className="shrink-0 inline-flex items-center gap-1 rounded border border-[#229ED9]/40 bg-[#229ED9]/10 text-[#229ED9] px-2 py-1.5 text-xs font-medium hover:bg-[#229ED9]/20 transition-colors"
              title="Mostrar QR code"
            >
              <QrCode className="h-3.5 w-3.5" /> QR
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Garçons ativos recebem chamadas de mesa em tempo real.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : staff.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum garçom vinculado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {staff.map(s => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${s.active ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
              <span className="font-medium flex-1 truncate">{s.staff_name}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">chat {s.chat_id.slice(-6)}</span>
              <button onClick={() => toggle(s)} title={s.active ? 'Desativar' : 'Ativar'}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <Power className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => remove(s)} title="Remover"
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showQR && qrUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-sm w-full relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-heading font-bold text-lg mb-1">QR para garçom</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Mostre este QR ao garçom. Ele escaneia, abre o bot e envia o comando abaixo.
            </p>
            <div className="bg-white rounded-xl p-4 flex items-center justify-center mb-4">
              <img src={qrUrl} alt="QR code do bot Telegram" className="w-full max-w-[240px]" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium">Depois de abrir o bot, envie:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded px-2 py-1.5 text-xs font-mono truncate">
                  {command}
                </code>
                <button
                  onClick={handleCopyCommand}
                  className="shrink-0 p-1.5 rounded border border-border hover:bg-muted"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Substitua "Nome Sobrenome" pelo nome real do garçom.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
