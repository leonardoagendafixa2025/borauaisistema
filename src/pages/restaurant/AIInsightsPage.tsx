import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import { useRestaurant } from '@/hooks/useRestaurantData';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Send, Loader2, TrendingUp, AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function AIInsightsPage() {
  const { data: restaurant } = useRestaurant();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [overview, setOverview] = useState<string>('');
  const [input, setInput] = useState('');

  const askAI = useMutation({
    mutationFn: async (payload: { question?: string; history?: Msg[] }) => {
      if (!restaurant?.id) throw new Error('Restaurante não encontrado');
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: { restaurant_id: restaurant.id, ...payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { answer: string };
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao consultar IA'),
  });

  const generateOverview = async () => {
    try {
      const data = await askAI.mutateAsync({});
      setOverview(data.answer);
    } catch {}
  };

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    setInput('');
    const newHistory: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(newHistory);
    try {
      const data = await askAI.mutateAsync({ question: q, history: messages });
      setMessages([...newHistory, { role: 'assistant', content: data.answer }]);
    } catch {
      setMessages(messages);
    }
  };

  const examples = [
    'Qual produto está vendendo mais?',
    'Como está minha margem?',
    'O que devo melhorar urgentemente?',
    'Tenho estoque para o fim de semana?',
  ];

  return (
    <RestaurantLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Insights com IA
            </h1>
            <p className="text-sm text-muted-foreground">
              Análise inteligente do seu negócio nos últimos 30 dias
            </p>
          </div>
          <button
            onClick={generateOverview}
            disabled={askAI.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {askAI.isPending && !messages.length ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {overview ? 'Atualizar análise' : 'Gerar análise'}
          </button>
        </div>

        {!overview && !askAI.isPending && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-3" />
            <h2 className="font-semibold text-lg">Pronto para analisar seu negócio?</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Clique em "Gerar análise" para receber um diagnóstico completo com pontos fortes, alertas e ações recomendadas.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mt-6">
              <div className="rounded-xl bg-muted/50 p-4">
                <TrendingUp className="h-5 w-5 text-success mb-2" />
                <p className="text-xs font-medium">Diagnóstico</p>
                <p className="text-[11px] text-muted-foreground">Visão geral baseada em dados reais</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <AlertTriangle className="h-5 w-5 text-warning mb-2" />
                <p className="text-xs font-medium">Alertas</p>
                <p className="text-[11px] text-muted-foreground">Estoque, despesas vencidas e NPS</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <Lightbulb className="h-5 w-5 text-primary mb-2" />
                <p className="text-xs font-medium">Ações</p>
                <p className="text-[11px] text-muted-foreground">Recomendações priorizadas</p>
              </div>
            </div>
          </div>
        )}

        {overview && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Análise executiva
            </h2>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{overview}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Chat */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold">Pergunte à IA</h2>
            <p className="text-xs text-muted-foreground">Faça perguntas sobre seu negócio em linguagem natural</p>
          </div>

          <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
            {messages.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="text-left text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    💬 {ex}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {askAI.isPending && messages.length > 0 && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !askAI.isPending && send()}
              placeholder="Ex: Qual produto vende mais à noite?"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={send}
              disabled={askAI.isPending || !input.trim()}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </RestaurantLayout>
  );
}
