import { useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { SEO } from '@/components/seo/SEO';
import logoImg from '@/assets/logo.png';

const DOC_MAP: Record<string, { key: string; title: string; description: string }> = {
  termos: { key: 'legal_terms', title: 'Termos de Uso', description: 'Regras de uso da plataforma Bora Uai' },
  privacidade: { key: 'legal_privacy', title: 'Política de Privacidade', description: 'Como tratamos seus dados pessoais' },
  lgpd: { key: 'legal_lgpd', title: 'LGPD', description: 'Conformidade com a Lei Geral de Proteção de Dados' },
};

export default function LegalPage() {
  const { doc } = useParams<{ doc: string }>();
  const meta = doc ? DOC_MAP[doc] : null;

  const { data, isLoading } = useQuery({
    queryKey: ['legal-doc', meta?.key],
    enabled: !!meta,
    queryFn: async () => {
      const { data } = await (publicSupabase.from('platform_settings' as any).select('value').eq('key', meta!.key).maybeSingle() as any);
      return (data?.value as string) || '';
    },
  });

  const content = useMemo(() => data || '', [data]);

  if (!meta) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background font-public">
      <SEO
        title={`${meta.title} — Bora Uai`}
        description={meta.description}
        path={`/legal/${doc}`}
      />
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImg} alt="Bora Uai" className="h-8 w-auto" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-heading text-3xl font-bold mb-2">{meta.title}</h1>
        <p className="text-muted-foreground mb-8">{meta.description}</p>

        <article className="prose prose-sm sm:prose-base max-w-none prose-headings:font-heading prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-li:text-foreground/90 prose-a:text-primary">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando documento...</p>
          ) : content ? (
            <ReactMarkdown>{content}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground">Documento ainda não publicado.</p>
          )}
        </article>

        <div className="mt-12 pt-6 border-t border-border flex flex-wrap gap-4 text-sm">
          <Link to="/legal/termos" className="text-muted-foreground hover:text-foreground transition-colors">Termos de Uso</Link>
          <Link to="/legal/privacidade" className="text-muted-foreground hover:text-foreground transition-colors">Privacidade</Link>
          <Link to="/legal/lgpd" className="text-muted-foreground hover:text-foreground transition-colors">LGPD</Link>
        </div>
      </main>
    </div>
  );
}
