import { useState } from 'react';
import { Send, Check, RefreshCw, Bell, BellOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  customerIds: string[];
}

/**
 * 1-click Telegram link via deep link: t.me/<bot>?start=<token>.
 * No copy/paste of chat_id needed — bot captures it automatically.
 */
export default function CustomerTelegramLink({ customerIds }: Props) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  // Bot username from platform_settings (set by super admin alongside the notify URL)
  const { data: botUsername } = useQuery({
    queryKey: ['platform-setting', 'telegram_bot_username'],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'telegram_bot_username')
        .maybeSingle();
      return data?.value || null;
    },
  });

  // Existing links for this user (any of their customer ids)
  const { data: links = [], isLoading } = useQuery({
    queryKey: ['customer-telegram-links', customerIds],
    queryFn: async () => {
      if (customerIds.length === 0) return [];
      const { data } = await supabase
        .from('customer_telegram_links')
        .select('id, status, chat_id, link_token, notify_status_updates, linked_at, customer_id')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: customerIds.length > 0,
    refetchInterval: (q) => {
      // Auto-refetch while there is a pending token waiting to be linked
      const list = (q.state.data as any[]) || [];
      return list.some((l) => l.status === 'pending') ? 3000 : false;
    },
  });

  const activeLink = links.find((l: any) => l.status === 'active');
  const pendingLink = links.find((l: any) => l.status === 'pending');

  const handleGenerate = async () => {
    if (customerIds.length === 0) {
      toast.error('Faça um pedido primeiro para vincular o Telegram.');
      return;
    }
    setGenerating(true);
    try {
      // Generate cryptographically random token
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const token = 'c_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase.from('customer_telegram_links').insert({
        customer_id: customerIds[0],
        link_token: token,
        status: 'pending',
      } as any);

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['customer-telegram-links', customerIds] });

      // Open Telegram immediately
      if (botUsername) {
        const url = `https://t.me/${botUsername}?start=${token}`;
        window.open(url, '_blank', 'noopener');
      }
    } catch (e: any) {
      toast.error('Falha ao gerar link: ' + (e.message || 'erro desconhecido'));
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenPending = () => {
    if (botUsername && pendingLink) {
      window.open(`https://t.me/${botUsername}?start=${pendingLink.link_token}`, '_blank', 'noopener');
    }
  };

  const handleToggleNotify = async () => {
    if (!activeLink) return;
    const { error } = await supabase
      .from('customer_telegram_links')
      .update({ notify_status_updates: !activeLink.notify_status_updates } as any)
      .eq('id', activeLink.id);
    if (error) {
      toast.error('Falha ao atualizar.');
    } else {
      qc.invalidateQueries({ queryKey: ['customer-telegram-links', customerIds] });
      toast.success(activeLink.notify_status_updates ? 'Notificações pausadas' : 'Notificações ativadas');
    }
  };

  const handleUnlink = async () => {
    if (!activeLink) return;
    if (!confirm('Desvincular o Telegram? Você não receberá mais atualizações.')) return;
    const { error } = await supabase
      .from('customer_telegram_links')
      .update({ status: 'revoked' } as any)
      .eq('id', activeLink.id);
    if (error) {
      toast.error('Falha ao desvincular.');
    } else {
      qc.invalidateQueries({ queryKey: ['customer-telegram-links', customerIds] });
      toast.success('Telegram desvinculado.');
    }
  };

  const handleCancelPending = async () => {
    if (!pendingLink) return;
    await supabase
      .from('customer_telegram_links')
      .update({ status: 'revoked' } as any)
      .eq('id', pendingLink.id);
    qc.invalidateQueries({ queryKey: ['customer-telegram-links', customerIds] });
  };

  if (isLoading) return null;

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-[#229ED9]/10 flex items-center justify-center text-[#229ED9]">
          <Send className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold">Acompanhar no Telegram</h3>
          <p className="text-xs text-muted-foreground">Receba o status do pedido em tempo real</p>
        </div>
      </div>

      {!botUsername && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          O Telegram ainda não está configurado pelo restaurante.
        </p>
      )}

      {botUsername && activeLink && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-2.5 text-sm font-medium">
            <Check className="h-4 w-4" /> Telegram vinculado
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleToggleNotify}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-all flex items-center justify-center gap-2"
            >
              {activeLink.notify_status_updates ? (
                <>
                  <BellOff className="h-4 w-4" /> Pausar
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" /> Ativar
                </>
              )}
            </button>
            <button
              onClick={handleUnlink}
              className="flex-1 rounded-xl border border-destructive/30 text-destructive py-2.5 text-sm font-medium hover:bg-destructive/5 transition-all"
            >
              Desvincular
            </button>
          </div>
        </div>
      )}

      {botUsername && !activeLink && pendingLink && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-2.5 text-sm">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="flex-1">Aguardando você apertar "Iniciar" no Telegram...</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenPending}
              className="flex-1 rounded-xl bg-[#229ED9] text-white py-2.5 text-sm font-semibold hover:bg-[#1d8cc1] transition-all flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" /> Abrir Telegram
            </button>
            <button
              onClick={handleCancelPending}
              className="rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-muted transition-all"
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {botUsername && !activeLink && !pendingLink && (
        <button
          onClick={handleGenerate}
          disabled={generating || customerIds.length === 0}
          className="w-full rounded-xl bg-[#229ED9] text-white py-3 text-sm font-semibold hover:bg-[#1d8cc1] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {generating ? 'Gerando link...' : 'Vincular em 1 clique'}
        </button>
      )}
    </div>
  );
}
