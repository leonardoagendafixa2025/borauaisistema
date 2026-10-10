import { useEffect, useState } from 'react';
import { Send, X, ExternalLink, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const DISMISS_KEY = 'telegram_banner_dismissed';

interface Props {
  slug?: string;
}

export default function TelegramLinkBanner({ slug }: Props) {
  const { restaurantId } = useAuth();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');
  const [linked, setLinked] = useState<boolean | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!restaurantId || dismissed) return;
    let cancelled = false;
    (async () => {
      const [{ data: settings }, { data: bot }] = await Promise.all([
        supabase.from('restaurant_settings').select('telegram_chat_id').eq('restaurant_id', restaurantId).maybeSingle(),
        supabase.from('platform_settings').select('value').eq('key', 'telegram_bot_username').maybeSingle(),
      ]);
      if (cancelled) return;
      setLinked(!!(settings as any)?.telegram_chat_id);
      setBotUsername((bot?.value || '').replace(/^@/, '') || null);
    })();
    return () => { cancelled = true; };
  }, [restaurantId, dismissed]);

  if (dismissed || linked === null || linked === true || !botUsername || !slug) return null;

  const startCommand = `/start ${slug}`;
  const deepLink = `https://t.me/${botUsername}?start=${slug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(startCommand);
    setCopied(true);
    toast.success('Comando copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="rounded-2xl border border-[#229ED9]/30 bg-gradient-to-r from-[#229ED9]/10 to-[#229ED9]/5 p-4 sm:p-5 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pr-8">
        <div className="h-12 w-12 rounded-xl bg-[#229ED9] flex items-center justify-center text-white shrink-0">
          <Send className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-base sm:text-lg">
            Conecte o Telegram em 30 segundos
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Receba <b>novos pedidos</b>, <b>chamadas de mesa</b> e <b>relatórios</b> direto no seu celular — grátis.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:shrink-0">
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#229ED9] hover:bg-[#1d8cc1] text-white px-4 py-2.5 text-sm font-semibold transition-all"
          >
            <ExternalLink className="h-4 w-4" /> Abrir Telegram
          </a>
          <button
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium hover:bg-muted transition-all"
            title="Copiar comando"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            <code className="text-xs">{startCommand}</code>
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3 sm:ml-16">
        Não tem o app?{' '}
        <Link to="/restaurant/settings" className="underline hover:text-foreground">
          Ver instruções completas
        </Link>
      </p>
    </div>
  );
}
