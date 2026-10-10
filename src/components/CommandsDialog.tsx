import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Users, Plus, CheckCircle2, Trash2, Receipt } from 'lucide-react';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface CommandsDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  table: { id: string; number: number; label?: string | null } | null;
}

export default function CommandsDialog({ open, onOpenChange, table }: CommandsDialogProps) {
  const { restaurantId, user } = useAuth();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: commands = [], refetch } = useQuery({
    queryKey: ['table-commands', table?.id],
    queryFn: async () => {
      if (!table?.id) return [];
      const { data } = await (supabase as any)
        .from('table_commands')
        .select('*')
        .eq('table_id', table.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!table?.id && open,
  });

  // Aggregate items per command
  const commandIds = commands.map((c) => c.id);
  const { data: items = [] } = useQuery({
    queryKey: ['command-items', commandIds.join(',')],
    queryFn: async () => {
      if (commandIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from('order_items')
        .select('id, command_id, name, qty, total_price')
        .in('command_id', commandIds);
      return (data || []) as any[];
    },
    enabled: commandIds.length > 0 && open,
  });

  const totalsPerCommand = commands.reduce<Record<string, { count: number; total: number }>>((acc, c) => {
    const list = items.filter((i) => i.command_id === c.id);
    acc[c.id] = {
      count: list.reduce((s, i) => s + Number(i.qty || 0), 0),
      total: list.reduce((s, i) => s + Number(i.total_price || 0), 0),
    };
    return acc;
  }, {});

  const addCommand = async () => {
    if (!restaurantId || !table?.id || !newName.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).from('table_commands').insert({
      restaurant_id: restaurantId,
      table_id: table.id,
      customer_name: newName.trim(),
      created_by: user?.id || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Erro ao abrir comanda');
      return;
    }
    toast.success(`Comanda "${newName}" aberta!`);
    setNewName('');
    refetch();
    queryClient.invalidateQueries({ queryKey: ['commands-by-table'] });
  };

  const closeCommand = async (id: string, name: string) => {
    if (!confirm(`Fechar comanda de ${name}?`)) return;
    await (supabase as any)
      .from('table_commands')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', id);
    toast.success(`Comanda de ${name} fechada`);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['commands-by-table'] });
  };

  const deleteCommand = async (id: string, name: string) => {
    if (!confirm(`Excluir comanda de ${name}? Itens lançados ficarão sem vínculo.`)) return;
    await (supabase as any).from('table_commands').delete().eq('id', id);
    toast.success('Comanda excluída');
    refetch();
    queryClient.invalidateQueries({ queryKey: ['commands-by-table'] });
  };

  if (!table) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Comandas — {table.label || `Mesa ${table.number}`}
          </DialogTitle>
          <DialogDescription>Cadastre uma comanda para cada cliente da mesa</DialogDescription>
        </DialogHeader>

        {/* Add new command */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-1">
            <Plus className="h-4 w-4" /> Nova comanda
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Nome (ex: João, Cliente 1...)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCommand(); }}
              maxLength={40}
              className="h-9"
            />
            <Button onClick={addCommand} disabled={submitting || !newName.trim()} className="h-9">
              Abrir
            </Button>
          </div>
        </div>

        {/* List */}
        {commands.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-6">
            Nenhuma comanda aberta nesta mesa
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              {commands.length} {commands.length === 1 ? 'comanda aberta' : 'comandas abertas'}
            </p>
            {commands.map((c) => {
              const totals = totalsPerCommand[c.id] || { count: 0, total: 0 };
              return (
                <div key={c.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.customer_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Aberta às {new Date(c.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      <Receipt className="h-3 w-3 mr-1" />
                      {totals.count} {totals.count === 1 ? 'item' : 'itens'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold tabular-nums text-primary">{fmt(totals.total)}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => closeCommand(c.id, c.customer_name)}
                        className="p-1.5 rounded hover:bg-success/10 text-success transition-colors"
                        title="Fechar comanda"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteCommand(c.id, c.customer_name)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
