import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MasterLayout from '@/components/layout/MasterLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { MessageSquare, Plus, Edit2, Trash2, Loader2, Mail, Send, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const channels = [
  { value: 'telegram', label: 'Telegram', icon: Send },
  { value: 'email', label: 'E-mail', icon: Mail },
  { value: 'in_app', label: 'In-app', icon: Bell },
];

const emptyForm = {
  key: '', name: '', description: '', channel: 'telegram',
  subject: '', body: '', variables: '', active: true,
};

export default function MessageTemplatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['message-templates-all'],
    queryFn: async () => {
      const { data } = await supabase.from('master_message_templates').select('*').order('name');
      return data || [];
    },
  });

  const openNew = () => {
    setForm(emptyForm);
    setEditing({ id: null });
  };

  const openEdit = (t: any) => {
    setForm({
      key: t.key, name: t.name, description: t.description || '',
      channel: t.channel, subject: t.subject || '', body: t.body,
      variables: Array.isArray(t.variables) ? t.variables.join(', ') : '',
      active: t.active,
    });
    setEditing(t);
  };

  const handleSave = async () => {
    if (!form.key || !form.name || !form.body) {
      toast.error('Preencha chave, nome e corpo da mensagem');
      return;
    }
    setSaving(true);
    try {
      const variables = form.variables
        .split(',').map(v => v.trim()).filter(Boolean);
      const payload = {
        key: form.key, name: form.name, description: form.description || null,
        channel: form.channel, subject: form.subject || null,
        body: form.body, variables, active: form.active,
      };
      if (editing?.id) {
        const { error } = await supabase.from('master_message_templates').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Template atualizado!');
      } else {
        const { error } = await supabase.from('master_message_templates').insert(payload);
        if (error) throw error;
        toast.success('Template criado!');
      }
      queryClient.invalidateQueries({ queryKey: ['message-templates-all'] });
      queryClient.invalidateQueries({ queryKey: ['master-templates'] });
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const handleDelete = async (t: any) => {
    if (!confirm(`Excluir template "${t.name}"?`)) return;
    const { error } = await supabase.from('master_message_templates').delete().eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Template excluído');
    queryClient.invalidateQueries({ queryKey: ['message-templates-all'] });
  };

  const toggleActive = async (t: any) => {
    await supabase.from('master_message_templates').update({ active: !t.active }).eq('id', t.id);
    queryClient.invalidateQueries({ queryKey: ['message-templates-all'] });
  };

  const channelMeta = (c: string) => channels.find(x => x.value === c) || channels[0];

  return (
    <MasterLayout>
      <ScrollReveal>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" /> Templates de Mensagem
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crie modelos reutilizáveis para comunicados, alertas e onboarding.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo template
          </Button>
        </div>

        <div className="grid gap-3">
          {isLoading && <p className="text-muted-foreground">Carregando...</p>}
          {!isLoading && templates.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              Nenhum template cadastrado.
            </div>
          )}
          {templates.map((t: any) => {
            const meta = channelMeta(t.channel);
            const Icon = meta.icon;
            return (
              <div key={t.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{t.name}</h3>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.key}</code>
                    <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                    {!t.active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                  <p className="text-sm mt-2 line-clamp-2 text-foreground/80 whitespace-pre-wrap">{t.body}</p>
                  {Array.isArray(t.variables) && t.variables.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {t.variables.map((v: string) => (
                        <code key={v} className="text-xs bg-muted/60 px-1.5 py-0.5 rounded">{`{{${v}}}`}</code>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={t.active} onCheckedChange={() => toggleActive(t)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(t)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing?.id ? 'Editar template' : 'Novo template'}</DialogTitle>
              <DialogDescription>Use {`{{variavel}}`} no corpo para substituições dinâmicas.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Chave técnica *</Label>
                  <Input value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} placeholder="welcome_owner" disabled={!!editing?.id} />
                </div>
                <div>
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Boas-vindas ao proprietário" />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Quando é usado" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Canal</Label>
                  <Select value={form.channel} onValueChange={v => setForm({ ...form, channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {channels.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex items-center gap-2 h-10">
                    <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
                    <Label className="cursor-pointer">Ativo</Label>
                  </div>
                </div>
              </div>
              {form.channel === 'email' && (
                <div>
                  <Label>Assunto</Label>
                  <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
                </div>
              )}
              <div>
                <Label>Corpo *</Label>
                <Textarea
                  value={form.body}
                  onChange={e => setForm({ ...form, body: e.target.value })}
                  rows={8}
                  placeholder="Olá {{nome}}, seu restaurante {{restaurante}} foi criado com sucesso!"
                />
              </div>
              <div>
                <Label>Variáveis disponíveis (separadas por vírgula)</Label>
                <Input value={form.variables} onChange={e => setForm({ ...form, variables: e.target.value })} placeholder="nome, restaurante, plano" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </ScrollReveal>
    </MasterLayout>
  );
}
