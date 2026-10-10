import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import ScrollReveal from '@/components/ScrollReveal';
import { Disc3, Music, Play, Check, X, Trash2, Clock, DollarSign, ExternalLink, MessageSquare, ShieldCheck, CheckCheck, Receipt, Undo2, LayoutGrid, Hourglass, ThumbsUp, Ban, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMusicRequestsList, useUpdateMusicRequest, useDeleteMusicRequest, useApproveMusicRequest, useRejectMusicRequest, type MusicRequest } from '@/hooks/useMusicRequests';
import { useRestaurant, useRestaurantSettings } from '@/hooks/useRestaurantData';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

const REJECT_REASONS = [
  'Música não disponível',
  'Repetida há pouco',
  'Fora do estilo da noite',
  'Conteúdo impróprio',
  'Pagamento não confirmado',
];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h`;
};

function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  count = 1,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => void;
  count?: number;
}) {
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [custom, setCustom] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar {count > 1 ? `${count} pedidos` : 'pedido'}</DialogTitle>
          <DialogDescription>
            O motivo aparece no histórico e ajuda a explicar pro cliente caso pergunte.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {REJECT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm cursor-pointer rounded-md p-2 hover:bg-muted">
              <input type="radio" name="reason" checked={reason === r} onChange={() => { setReason(r); setCustom(''); }} />
              {r}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm cursor-pointer rounded-md p-2 hover:bg-muted">
            <input type="radio" name="reason" checked={reason === '__custom'} onChange={() => setReason('__custom')} />
            Outro motivo
          </label>
          {reason === '__custom' && (
            <input
              type="text"
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Descreva..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => {
              const final = reason === '__custom' ? (custom.trim() || 'Não disponível') : reason;
              onConfirm(final);
              onOpenChange(false);
            }}
          >
            Confirmar recusa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestCard({ r, onUpdate, onDelete, onApprove, selectable, selected, onSelectChange, onRequestReject }: {
  r: MusicRequest;
  onUpdate: (patch: Partial<MusicRequest> & { id: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onApprove?: (id: string) => Promise<void>;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (v: boolean) => void;
  onRequestReject?: (id: string) => void;
}) {
  const isPaid = r.payment_status === 'paid';
  const isPending = r.payment_status === 'pending';
  const isPendingApproval = r.status === 'pending_approval';
  return (
    <div className={`card-elevated p-4 space-y-3 ${isPendingApproval ? 'border-l-4 border-yellow-500' : ''}`}>
      <div className="flex items-start gap-3">
        {selectable && (
          <Checkbox
            checked={!!selected}
            onCheckedChange={(v) => onSelectChange?.(Boolean(v))}
            className="mt-1"
            aria-label="Selecionar pedido"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-lg truncate">🎵 {r.song_text}</p>
          {r.dedication && (
            <p className="text-sm text-muted-foreground italic mt-1 flex items-start gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{r.dedication}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
            {isPendingApproval && (
              <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/15">
                <ShieldCheck className="h-3 w-3 mr-0.5" /> Aguardando aprovação
              </Badge>
            )}
            {r.status === 'rejected' && r.rejected_reason && (
              <Badge variant="outline" className="text-destructive border-destructive/30">
                Recusada: {r.rejected_reason}
              </Badge>
            )}
            {r.payment_status === 'refunded' && (
              <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">
                <Undo2 className="h-3 w-3 mr-0.5" /> Estornado da comanda
              </Badge>
            )}
            {r.order_item_id && r.status !== 'rejected' && (
              <Badge variant="outline" className="border-primary/30 text-primary">
                <Receipt className="h-3 w-3 mr-0.5" /> Lançado na comanda
              </Badge>
            )}
            {r.customer_name && <Badge variant="secondary">{r.customer_name}</Badge>}
            {r.table_label && (
              <Badge variant="outline" className={(r as any).billing_mode === 'command' ? 'border-primary/40 text-primary' : 'border-amber-400/40 text-amber-700 dark:text-amber-300'}>
                📍 {r.table_label} · {(r as any).billing_mode === 'command' ? 'comanda' : 'rateio'}
              </Badge>
            )}
            {r.price > 0 && (
              <Badge className={isPaid ? 'bg-success/10 text-success hover:bg-success/10' : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/10'}>
                <DollarSign className="h-3 w-3 mr-0.5" />{fmt(r.price)} {isPaid ? '✓' : '· aguardando'}
              </Badge>
            )}
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />{timeAgo(r.created_at)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {r.status === 'pending_approval' && (
          <>
            <Button size="sm" onClick={() => onApprove?.(r.id)}>
              <Check className="h-3.5 w-3.5 mr-1" /> Aprovar {r.price > 0 && r.table_label ? '(lança na comanda)' : ''}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onRequestReject?.(r.id)}>
              <X className="h-3.5 w-3.5 mr-1" /> Recusar
            </Button>
          </>
        )}
        {r.status === 'queued' && (
          <>
            {isPending && r.price > 0 && (
              <Button size="sm" variant="outline" onClick={() => onUpdate({ id: r.id, payment_status: 'paid' })}>
                <Check className="h-3.5 w-3.5 mr-1" /> Marcar pago
              </Button>
            )}
            <Button size="sm" onClick={() => onUpdate({ id: r.id, status: 'playing' })}>
              <Play className="h-3.5 w-3.5 mr-1" /> Tocando agora
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onRequestReject?.(r.id)}>
              <X className="h-3.5 w-3.5 mr-1" /> Recusar
            </Button>
          </>
        )}
        {r.status === 'playing' && (
          <Button size="sm" onClick={() => onUpdate({ id: r.id, status: 'played' })}>
            <Check className="h-3.5 w-3.5 mr-1" /> Marcar tocada
          </Button>
        )}
        {(r.status === 'played' || r.status === 'rejected') && (
          <Button size="sm" variant="ghost" onClick={() => {
            if (confirm('Excluir este pedido?')) onDelete(r.id);
          }}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}

type KanbanColId = 'pending' | 'approved' | 'rejected' | 'played';

function KanbanColumn({
  id,
  title,
  icon,
  accent,
  count,
  empty,
  children,
  isOver,
  variant = 'kanban',
  defaultOpen = true,
}: {
  id: KanbanColId;
  title: string;
  icon: React.ReactNode;
  accent: string;
  count: number;
  empty: string;
  children: React.ReactNode;
  isOver?: boolean;
  variant?: 'kanban' | 'accordion';
  defaultOpen?: boolean;
}) {
  const { setNodeRef, isOver: dropOver } = useDroppable({ id });
  const highlight = (isOver ?? dropOver) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '';
  const [open, setOpen] = useState(defaultOpen);

  if (variant === 'accordion') {
    return (
      <div ref={setNodeRef} className={`rounded-xl border bg-card/40 transition-all ${highlight}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-3 ${accent} ${open ? 'rounded-t-xl border-b' : 'rounded-xl'}`}
          aria-expanded={open}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {icon}
            <span>{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-background/60">{count}</Badge>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {open && (
          <div className="p-2 space-y-2 max-h-[55vh] overflow-y-auto">
            {count === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 px-2">{empty}</p>
            ) : (
              children
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border bg-card/40 min-h-[60vh] transition-all ${highlight}`}
    >
      <div className={`flex items-center justify-between gap-2 px-3 py-2.5 border-b rounded-t-xl ${accent}`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          <span>{title}</span>
        </div>
        <Badge variant="outline" className="bg-background/60">{count}</Badge>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[70vh]">
        {count === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 px-2">{empty}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Arrastar pedido"
        className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

function KanbanBoard({
  pending,
  approved,
  rejected,
  played,
  requireApproval,
  onUpdate,
  onDelete,
  onApprove,
  onRequestReject,
  onDropTransition,
}: {
  pending: MusicRequest[];
  approved: MusicRequest[];
  rejected: MusicRequest[];
  played: MusicRequest[];
  requireApproval: boolean;
  onUpdate: (patch: Partial<MusicRequest> & { id: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  onRequestReject: (id: string) => void;
  onDropTransition: (requestId: string, from: KanbanColId, to: KanbanColId) => void;
}) {
  const isMobile = useIsMobile();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const allRequests = useMemo(
    () => [...pending, ...approved, ...rejected, ...played],
    [pending, approved, rejected, played],
  );
  const findColumn = (id: string): KanbanColId | null => {
    if (pending.some((r) => r.id === id)) return 'pending';
    if (approved.some((r) => r.id === id)) return 'approved';
    if (rejected.some((r) => r.id === id)) return 'rejected';
    if (played.some((r) => r.id === id)) return 'played';
    return null;
  };
  const activeRequest = allRequests.find((r) => r.id === activeId) || null;

  const handleStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const to = e.over.id as KanbanColId;
    const from = findColumn(id);
    if (!from || from === to) return;
    onDropTransition(id, from, to);
  };

  // Mobile: cards sem drag handle (usa botões); Desktop: drag-and-drop
  const renderCard = (r: MusicRequest, withReject = true) => {
    const card = (
      <RequestCard
        r={r}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onApprove={onApprove}
        onRequestReject={withReject ? onRequestReject : undefined}
      />
    );
    if (isMobile) return <div key={r.id}>{card}</div>;
    return (
      <DraggableCard key={r.id} id={r.id}>
        {card}
      </DraggableCard>
    );
  };

  const variant = isMobile ? 'accordion' : 'kanban';
  const containerClass = isMobile
    ? 'flex flex-col gap-2'
    : 'grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4';

  const board = (
    <>
      <div className={containerClass}>
        <KanbanColumn
          id="pending"
          variant={variant}
          defaultOpen={pending.length > 0}
          title={requireApproval ? 'Pendente' : 'Pendente (sem aprovação)'}
          icon={<Hourglass className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />}
          accent="bg-yellow-500/10"
          count={pending.length}
          empty={requireApproval ? 'Sem pedidos aguardando aprovação.' : 'Aprovação manual desativada — pedidos vão direto pra "Aprovado".'}
        >
          {pending.map((r) => renderCard(r))}
        </KanbanColumn>

        <KanbanColumn
          id="approved"
          variant={variant}
          defaultOpen={approved.length > 0}
          title="Aprovado"
          icon={<ThumbsUp className="h-4 w-4 text-primary" />}
          accent="bg-primary/10"
          count={approved.length}
          empty={isMobile ? 'Nenhum pedido aprovado na fila.' : 'Arraste cards de Pendente aqui pra aprovar.'}
        >
          {approved.map((r) => renderCard(r))}
        </KanbanColumn>

        <KanbanColumn
          id="rejected"
          variant={variant}
          defaultOpen={false}
          title="Recusado"
          icon={<Ban className="h-4 w-4 text-destructive" />}
          accent="bg-destructive/10"
          count={rejected.length}
          empty={isMobile ? 'Nenhum pedido recusado.' : 'Arraste pra cá pra recusar (pede o motivo).'}
        >
          {rejected.slice(0, 30).map((r) => renderCard(r, false))}
        </KanbanColumn>

        <KanbanColumn
          id="played"
          variant={variant}
          defaultOpen={false}
          title="Concluído"
          icon={<CheckCheck className="h-4 w-4 text-success" />}
          accent="bg-success/10"
          count={played.length}
          empty={isMobile ? 'Nenhuma música tocada ainda.' : 'Arraste de Aprovado pra marcar como tocada.'}
        >
          {played.slice(0, 30).map((r) => renderCard(r, false))}
        </KanbanColumn>
      </div>

      <DragOverlay>
        {activeRequest ? (
          <div className="card-elevated p-3 shadow-2xl rotate-2 max-w-sm opacity-95">
            <p className="font-heading font-bold text-sm truncate">🎵 {activeRequest.song_text}</p>
            {activeRequest.table_label && (
              <p className="text-xs text-muted-foreground mt-1">📍 {activeRequest.table_label}</p>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </>
  );

  // Mobile: sem DnD (usa botões dos cards), evita conflito com scroll vertical
  if (isMobile) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground px-1">
          Toque pra expandir cada coluna. Use os botões nos cards pra mover entre status.
        </p>
        {board}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd} onDragCancel={() => setActiveId(null)}>
      {board}
    </DndContext>
  );
}

export default function DjPanelPage() {
  const { data: requests = [], isLoading } = useMusicRequestsList();
  const { data: restaurant } = useRestaurant();
  const { data: settings } = useRestaurantSettings();
  const update = useUpdateMusicRequest();
  const del = useDeleteMusicRequest();
  const approve = useApproveMusicRequest();
  const reject = useRejectMusicRequest();
  const { toast } = useToast();
  const [tab, setTab] = useState('kanban');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null); // null = bulk

  const enabled = (settings as any)?.music_requests_enabled === true;
  const requireApproval = (settings as any)?.music_requests_require_approval === true;

  const groups = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'pending_approval');
    const queue = requests.filter((r) => r.status === 'queued');
    const playing = requests.filter((r) => r.status === 'playing');
    const rejected = requests.filter((r) => r.status === 'rejected');
    const played = requests.filter((r) => r.status === 'played');
    const history = [...played, ...rejected];
    // Kanban "Aprovado" = queued + playing (já aprovado, ainda não tocou ou tocando)
    const approved = [...playing, ...queue];
    return { pending, queue, playing, history, rejected, played, approved };
  }, [requests]);

  // Auto-jump to approval tab when new pending arrives and tab is queue/empty
  // (intentional minimal UX — don't override if user picked another tab manually)

  const stats = useMemo(() => {
    const today = requests.filter((r) => new Date(r.created_at).toDateString() === new Date().toDateString());
    const revenue = today.filter((r) => r.payment_status === 'paid').reduce((s, r) => s + Number(r.price), 0);
    return {
      total: today.length,
      pending: today.filter((r) => r.status === 'queued').length,
      awaiting: today.filter((r) => r.status === 'pending_approval').length,
      revenue,
    };
  }, [requests]);

  const handleUpdate = async (patch: Partial<MusicRequest> & { id: string }) => {
    try {
      await update.mutateAsync(patch);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };
  const handleDelete = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast({ title: 'Pedido excluído' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const toggleSelect = (id: string, v: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (v) next.add(id); else next.delete(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleDropTransition = async (
    requestId: string,
    from: 'pending' | 'approved' | 'rejected' | 'played',
    to: 'pending' | 'approved' | 'rejected' | 'played',
  ) => {
    try {
      // Pendente → Aprovado: aprova (lança na comanda se aplicável)
      if (from === 'pending' && to === 'approved') {
        const res = await approve.mutateAsync(requestId);
        toast({
          title: 'Aprovado',
          description: res?.linked_to_tab ? '🎵 Lançado na comanda.' : 'Foi pra fila.',
        });
        return;
      }
      // Pendente/Aprovado → Recusado: abre dialog de motivo (estorna comanda se houver)
      if (to === 'rejected' && (from === 'pending' || from === 'approved')) {
        openRejectDialog(requestId);
        return;
      }
      // Aprovado → Concluído: marca como tocada
      if (from === 'approved' && to === 'played') {
        await update.mutateAsync({ id: requestId, status: 'played' });
        toast({ title: 'Marcada como tocada' });
        return;
      }
      // Concluído → Aprovado: reabre na fila
      if (from === 'played' && to === 'approved') {
        await update.mutateAsync({ id: requestId, status: 'queued', played_at: null });
        toast({ title: 'Reaberta na fila' });
        return;
      }
      // Recusado → Pendente/Aprovado: reabre (sem re-lançar comanda automaticamente)
      if (from === 'rejected' && (to === 'pending' || to === 'approved')) {
        await update.mutateAsync({
          id: requestId,
          status: to === 'pending' ? 'pending_approval' : 'queued',
          rejected_reason: null,
        });
        toast({ title: 'Pedido reaberto', description: 'Se precisar cobrar, lance manualmente na comanda.' });
        return;
      }
      // Aprovado → Pendente: volta pra aprovação
      if (from === 'approved' && to === 'pending') {
        await update.mutateAsync({ id: requestId, status: 'pending_approval' });
        toast({ title: 'Movido para Pendente' });
        return;
      }
      // Pendente → Concluído (atalho raro): aprova e marca tocada
      if (from === 'pending' && to === 'played') {
        await approve.mutateAsync(requestId);
        await update.mutateAsync({ id: requestId, status: 'played' });
        toast({ title: 'Aprovada e marcada como tocada' });
        return;
      }
      // Concluído → Recusado / Recusado → Concluído: bloqueia (faz pouco sentido)
      toast({
        title: 'Movimento não suportado',
        description: 'Use os botões do card pra essa transição.',
        variant: 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Erro ao mover', description: e.message, variant: 'destructive' });
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await approve.mutateAsync(id);
      toast({
        title: 'Pedido aprovado',
        description: res?.linked_to_tab
          ? '🎵 Lançado na comanda da mesa.'
          : 'Adicionado à fila.',
      });
    } catch (e: any) {
      toast({ title: 'Erro ao aprovar', description: e.message, variant: 'destructive' });
    }
  };

  const bulkApprove = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      const results = await Promise.all(ids.map((id) => approve.mutateAsync(id)));
      const linked = results.filter((r) => r?.linked_to_tab).length;
      toast({
        title: `${ids.length} pedido(s) aprovados`,
        description: linked > 0 ? `${linked} lançado(s) em comandas de mesa.` : undefined,
      });
      clearSelection();
    } catch (e: any) {
      toast({ title: 'Erro ao aprovar', description: e.message, variant: 'destructive' });
    }
  };

  const openRejectDialog = (id: string | null) => {
    setRejectTargetId(id);
    setRejectOpen(true);
  };

  const confirmReject = async (reason: string) => {
    const ids = rejectTargetId ? [rejectTargetId] : [...selectedIds];
    if (ids.length === 0) return;
    try {
      const results = await Promise.all(ids.map((id) => reject.mutateAsync({ id, reason })));
      const refunded = results.filter((r) => r?.refunded_from_tab).length;
      toast({
        title: `${ids.length} pedido(s) recusados`,
        description: refunded > 0
          ? `💸 ${refunded} item(s) removido(s) automaticamente da comanda.`
          : undefined,
      });
      if (!rejectTargetId) clearSelection();
      setRejectTargetId(null);
    } catch (e: any) {
      toast({ title: 'Erro ao recusar', description: e.message, variant: 'destructive' });
    }
  };

  const selectAllPending = () => {
    setSelectedIds(new Set(groups.pending.map((r) => r.id)));
  };

  const publicUrl = restaurant?.slug ? `/${restaurant.slug}/balada` : null;

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground flex items-center gap-1">
          <Link to="/restaurant" className="hover:text-foreground hover:underline transition-colors">Painel</Link>
          <span>›</span>
          <span className="text-foreground font-medium">DJ — Pedidos de música</span>
        </nav>

        <ScrollReveal>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Disc3 className="h-6 w-6 text-primary animate-spin-slow" style={{ animationDuration: '4s' }} />
                <h1 className="font-heading text-2xl font-bold">Pedidos de música</h1>
                {enabled ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Aberto
                  </span>
                ) : (
                  <Badge variant="outline">Fechado</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Fila em tempo real. Cliente pede pelo cardápio digital ou tela pública.
              </p>
            </div>
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Ver tela pública <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </ScrollReveal>

        {!enabled && (
          <ScrollReveal>
            <div className="card-elevated p-5 border-l-4 border-yellow-500">
              <p className="font-medium text-sm">Pedidos de música estão desativados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ative em <Link to="/restaurant/programacao" className="text-primary underline">Programação Noite → Pedidos de música</Link> para começar a receber.
              </p>
            </div>
          </ScrollReveal>
        )}

        {/* KPIs */}
        <div className={`grid gap-3 ${requireApproval ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
          <div className="card-elevated p-4">
            <p className="text-xs text-muted-foreground">Pedidos hoje</p>
            <p className="font-heading text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          {requireApproval && (
            <div className="card-elevated p-4">
              <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
              <p className="font-heading text-2xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">{stats.awaiting}</p>
            </div>
          )}
          <div className="card-elevated p-4">
            <p className="text-xs text-muted-foreground">Na fila</p>
            <p className="font-heading text-2xl font-bold mt-1 text-primary">{stats.pending}</p>
          </div>
          <div className="card-elevated p-4">
            <p className="text-xs text-muted-foreground">Receita hoje</p>
            <p className="font-heading text-xl font-bold mt-1 text-success">{fmt(stats.revenue)}</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => { setTab(v); clearSelection(); }}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="kanban">
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              Kanban
            </TabsTrigger>
            {requireApproval && (
              <TabsTrigger value="approval">
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                Aprovação {groups.pending.length > 0 && (
                  <Badge className="ml-1.5 bg-yellow-500 text-white hover:bg-yellow-500">{groups.pending.length}</Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="queue">
              Na fila {groups.queue.length > 0 && <Badge className="ml-1.5 bg-primary text-primary-foreground">{groups.queue.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="playing">
              Tocando {groups.playing.length > 0 && <Badge className="ml-1.5">{groups.playing.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-4">
            <KanbanBoard
              pending={groups.pending}
              approved={groups.approved}
              rejected={groups.rejected}
              played={groups.played}
              requireApproval={requireApproval}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onApprove={handleApprove}
              onRequestReject={(id) => openRejectDialog(id)}
              onDropTransition={handleDropTransition}
            />
          </TabsContent>

          {requireApproval && (
            <TabsContent value="approval" className="space-y-3 mt-4">
              {groups.pending.length === 0 ? (
                <div className="card-elevated p-12 text-center">
                  <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Nenhum pedido aguardando aprovação</p>
                  <p className="text-sm text-muted-foreground mt-1">Quando chegar um novo pedido, aparece aqui pra você revisar.</p>
                </div>
              ) : (
                <>
                  <div className="sticky top-0 z-10 -mx-1 px-1">
                    <div className="card-elevated p-3 flex flex-wrap items-center gap-2 bg-card/95 backdrop-blur">
                      <Button size="sm" variant="outline" onClick={selectedIds.size === groups.pending.length ? clearSelection : selectAllPending}>
                        {selectedIds.size === groups.pending.length ? 'Limpar seleção' : `Selecionar todos (${groups.pending.length})`}
                      </Button>
                      <span className="text-xs text-muted-foreground flex-1">
                        {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : 'Selecione pra agir em lote'}
                      </span>
                      <Button size="sm" disabled={selectedIds.size === 0} onClick={bulkApprove}>
                        <CheckCheck className="h-3.5 w-3.5 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" disabled={selectedIds.size === 0} onClick={() => openRejectDialog(null)}>
                        <X className="h-3.5 w-3.5 mr-1" /> Recusar
                      </Button>
                    </div>
                  </div>

                  {groups.pending.map((r) => (
                    <RequestCard
                      key={r.id}
                      r={r}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onApprove={handleApprove}
                      selectable
                      selected={selectedIds.has(r.id)}
                      onSelectChange={(v) => toggleSelect(r.id, v)}
                      onRequestReject={(id) => openRejectDialog(id)}
                    />
                  ))}
                </>
              )}
            </TabsContent>
          )}

          <TabsContent value="queue" className="space-y-3 mt-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : groups.queue.length === 0 ? (
              <div className="card-elevated p-12 text-center">
                <Music className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium">Nenhum pedido na fila</p>
                <p className="text-sm text-muted-foreground mt-1">Quando o cliente pedir, aparece aqui em tempo real.</p>
              </div>
            ) : (
              groups.queue.map((r) => (
                <RequestCard key={r.id} r={r} onUpdate={handleUpdate} onDelete={handleDelete} onRequestReject={(id) => openRejectDialog(id)} />
              ))
            )}
          </TabsContent>

          <TabsContent value="playing" className="space-y-3 mt-4">
            {groups.playing.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma música tocando.</p>
            ) : (
              groups.playing.map((r) => <RequestCard key={r.id} r={r} onUpdate={handleUpdate} onDelete={handleDelete} />)
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {groups.history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem histórico ainda.</p>
            ) : (
              groups.history.slice(0, 50).map((r) => <RequestCard key={r.id} r={r} onUpdate={handleUpdate} onDelete={handleDelete} />)
            )}
          </TabsContent>
        </Tabs>

        <RejectDialog
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          onConfirm={confirmReject}
          count={rejectTargetId ? 1 : selectedIds.size}
        />
      </div>
    </RestaurantLayout>
  );
}
