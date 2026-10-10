import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { Send, Megaphone, Users, Loader2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CommunicationsPage() {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<'telegram' | 'in_app'>('telegram');
  const [segmentStatus, setSegmentStatus] = useState('all');
  const [segmentTier, setSegmentTier] = useState('all');
  const [templateKey, setTemplateKey] = useState<string>('broadcast_default');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [tplBody, setTplBody] = useState('');

  const { data: templates = [] } = useQuery({
    queryKey: ['master-templates'],
    queryFn: async () => {
      const { data } = await (supabase.from('master_message_templates' as any).select('*').eq('active', true).order('name') as any);
      return data || [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['master-broadcasts'],
    queryFn: async () => {
      const { data } = await (supabase.from('master_broadcasts' as any).select('*').order('created_at', { ascending: false }).limit(20) as any);
      return data || [];
    },
  });

  const { data: targetCount } = useQuery({
    queryKey: ['broadcast-target-count', segmentStatus, segmentTier],
    queryFn: async () => {
      let q = supabase.from('restaurants').select('id', { count: 'exact', head: true }).not('owner_id', 'is', null);
      if (segmentStatus !== 'all') q = q.eq('status', segmentStatus as any);
      const { count } = await q;
      // Tier filter would need join — we approximate here, real count comes from edge fn
      return count ?? 0;
    },
  });

  const handleApplyTemplate = (key: string) => {
    setTemplateKey(key);
    const tpl = templates.find((t: any) => t.key === key);
    if (tpl) {
      setBody(tpl.body);
      if (tpl.subject) setSubject(tpl.subject);
    }
  };

  const handleSend = async () => {
    if (!body.trim()) { toast.error('Mensagem vazia'); return; }
    if (!confirm(`Enviar para até ${targetCount ?? 0} restaurante(s)?`)) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('master-broadcast', {
        body: {
          template_key: templateKey,
          channel,
          subject: subject || null,
          body,
          segment: {
            ...(segmentStatus !== 'all' ? { status: segmentStatus } : {}),
            ...(segmentTier !== 'all' ? { plan_tier: segmentTier } : {}),
          },
        },
      });
      if (error) throw error;
      toast.success(`Enviado: ${data.sent}/${data.total} (${data.failed} falhas)`);
      queryClient.invalidateQueries({ queryKey: ['master-broadcasts'] });
      setBody('');
      setSubject('');
    } catch (e: any) {
      toast.error(e.message ?? 'Falha ao enviar');
    } finally {
      setSending(false);
    }
  };

  const openTemplate = (tpl: any) => {
    setEditingTemplate(tpl);
    setTplBody(tpl.body);
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    const { error } = await (supabase.from('master_message_templates' as any)
      .update({ body: tplBody } as any)
      .eq('id', editingTemplate.id) as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Template salvo');
    queryClient.invalidateQueries({ queryKey: ['master-templates'] });
    setEditingTemplate(null);
  };

  return (
    <MasterLayout>
      <div className="space-y-6">
        <ScrollReveal>
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6" /> Comunicados
            </h1>
            <p className="text-sm text-muted-foreground">Broadcast para restaurantes via Telegram ou notificação in-app</p>
          </div>
        </ScrollReveal>

        <Tabs defaultValue="send">
          <TabsList>
            <TabsTrigger value="send"><Send className="h-3.5 w-3.5 mr-1.5" />Enviar</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1.5" />Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="space-y-4 mt-4">
            <ScrollReveal>
              <div className="card-elevated p-5 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Canal</Label>
                    <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="telegram">Telegram</SelectItem>
                        <SelectItem value="in_app">Notificação in-app</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Template base</Label>
                    <Select value={templateKey} onValueChange={handleApplyTemplate}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {templates.map((t: any) => (
                          <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Status do restaurante</Label>
                    <Select value={segmentStatus} onValueChange={setSegmentStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="active">Ativos</SelectItem>
                        <SelectItem value="trial">Em trial</SelectItem>
                        <SelectItem value="overdue">Inadimplentes</SelectItem>
                        <SelectItem value="suspended">Suspensos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Plano</Label>
                    <Select value={segmentTier} onValueChange={setSegmentTier}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os planos</SelectItem>
                        <SelectItem value="basic">Básico</SelectItem>
                        <SelectItem value="professional">Profissional</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Alcance estimado: <strong>{targetCount ?? 0}</strong> restaurante(s)</span>
                </div>

                {channel === 'in_app' && (
                  <div className="space-y-1">
                    <Label>Assunto / Título</Label>
                    <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex: Manutenção programada" />
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={8}
                    placeholder="Digite sua mensagem... Use {{nome}} para personalizar com o nome do restaurante."
                  />
                  <p className="text-xs text-muted-foreground">
                    Telegram suporta Markdown. Variáveis disponíveis: <code className="px-1 bg-muted rounded">{'{{nome}}'}</code>
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSend} disabled={sending || !body.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    {sending ? 'Enviando...' : 'Enviar comunicado'}
                  </Button>
                </div>
              </div>
            </ScrollReveal>
          </TabsContent>

          <TabsContent value="templates" className="space-y-3 mt-4">
            {templates.map((t: any) => (
              <ScrollReveal key={t.id}>
                <div className="card-elevated p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-semibold">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                      <code className="text-[10px] text-muted-foreground">{t.key}</code>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{t.channel}</Badge>
                      <Button size="sm" variant="outline" onClick={() => openTemplate(t)}>Editar</Button>
                    </div>
                  </div>
                  <pre className="text-xs bg-muted/50 p-3 rounded whitespace-pre-wrap font-sans">{t.body}</pre>
                  {Array.isArray(t.variables) && t.variables.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.variables.map((v: string) => (
                        <code key={v} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">{`{{${v}}}`}</code>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollReveal>
            ))}

            {editingTemplate && (
              <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingTemplate(null)}>
                <div className="card-elevated p-6 max-w-2xl w-full space-y-4" onClick={e => e.stopPropagation()}>
                  <div>
                    <h3 className="font-semibold">{editingTemplate.name}</h3>
                    <p className="text-xs text-muted-foreground">{editingTemplate.description}</p>
                  </div>
                  <Textarea value={tplBody} onChange={e => setTplBody(e.target.value)} rows={12} />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancelar</Button>
                    <Button onClick={saveTemplate}>Salvar template</Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-2 mt-4">
            {history.length === 0 ? (
              <ScrollReveal>
                <div className="card-elevated p-8 text-center text-muted-foreground">Nenhum comunicado enviado ainda</div>
              </ScrollReveal>
            ) : history.map((b: any) => (
              <ScrollReveal key={b.id}>
                <div className="card-elevated p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h4 className="font-medium text-sm">{b.subject ?? b.template_key ?? 'Sem assunto'}</h4>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(b.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · canal: {b.channel}
                      </p>
                    </div>
                    <Badge variant="outline" className={
                      b.status === 'completed' ? 'bg-success/10 text-success border-success/30'
                      : b.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/30'
                      : 'bg-muted text-muted-foreground'
                    }>
                      {b.sent_count}/{b.total_recipients} enviados
                    </Badge>
                  </div>
                  <pre className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap font-sans">{b.body}</pre>
                </div>
              </ScrollReveal>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </MasterLayout>
  );
}
