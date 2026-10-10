import { useState, useMemo, useCallback } from 'react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CalendarCheck, Plus, Phone, Users, Clock, Check, X, MessageCircle, QrCode, Copy, Download, Printer } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurant } from '@/hooks/useRestaurantData';
import { toast } from 'sonner';
import MetricCard from '@/components/MetricCard';

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning' },
  confirmed: { label: 'Confirmada', className: 'bg-info/10 text-info' },
  seated: { label: 'Acomodada', className: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
  no_show: { label: 'Não compareceu', className: 'bg-destructive/10 text-destructive' },
};

export default function ReservationsPage() {
  const { restaurantId } = useAuth();
  const { data: restaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('upcoming');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '',
    reservation_date: new Date().toISOString().slice(0, 10),
    reservation_time: '20:00', people_count: '2', notes: '',
  });

  const reservationUrl = restaurant?.slug ? `${window.location.origin}/${restaurant.slug}/reservar` : '';

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(reservationUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  }, [reservationUrl]);

  const downloadQR = useCallback(() => {
    const canvas = document.getElementById('reservation-qr-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-reservas-${restaurant?.slug || 'restaurante'}.png`;
    a.click();
    toast.success('QR Code baixado!');
  }, [restaurant?.slug]);

  const printQR = useCallback(() => {
    const canvas = document.getElementById('reservation-qr-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>QR Reservas — ${restaurant?.name || ''}</title></head><body style="text-align:center;font-family:sans-serif;padding:40px;">
      <h2>Reserve sua mesa</h2>
      <h3>${restaurant?.name || ''}</h3>
      <img src="${dataUrl}" style="max-width:300px;margin:20px auto;display:block;" />
      <p style="color:#666;font-size:14px;">Escaneie o QR Code para reservar</p>
      <p style="font-size:12px;color:#999;">${reservationUrl}</p>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }, [restaurant?.name, reservationUrl]);

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: async () => {
      const { data } = await supabase.from('table_reservations').select('*').eq('restaurant_id', restaurantId!).order('reservation_date', { ascending: false }).order('reservation_time');
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayList = reservations.filter(r => r.reservation_date === today);
    return {
      total: reservations.length,
      todayCount: todayList.length,
      pending: reservations.filter(r => r.status === 'pending').length,
      seated: reservations.filter(r => r.status === 'seated').length,
    };
  }, [reservations]);

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (filter === 'today') return reservations.filter(r => r.reservation_date === today);
    if (filter === 'upcoming') return reservations.filter(r => r.reservation_date >= today && !['cancelled', 'no_show'].includes(r.status));
    if (filter === 'past') return reservations.filter(r => r.reservation_date < today);
    return reservations.filter(r => r.status === filter);
  }, [reservations, filter]);

  const handleCreate = async () => {
    if (!form.customer_name || !form.customer_phone) { toast.error('Nome e telefone obrigatórios'); return; }
    const { error } = await supabase.from('table_reservations').insert({
      restaurant_id: restaurantId!,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_email: form.customer_email || null,
      reservation_date: form.reservation_date,
      reservation_time: form.reservation_time,
      people_count: parseInt(form.people_count),
      notes: form.notes || null,
      status: 'confirmed',
    });
    if (error) { toast.error('Erro ao criar reserva'); return; }
    toast.success('Reserva criada');
    setDialogOpen(false);
    setForm({ customer_name: '', customer_phone: '', customer_email: '', reservation_date: new Date().toISOString().slice(0, 10), reservation_time: '20:00', people_count: '2', notes: '' });
    queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('table_reservations').update({ status } as any).eq('id', id);
    toast.success('Status atualizado');
    queryClient.invalidateQueries({ queryKey: ['reservations', restaurantId] });
  };

  const sendWhatsApp = (r: any) => {
    const phone = r.customer_phone.replace(/\D/g, '');
    const fullPhone = phone.startsWith('55') ? phone : '55' + phone;
    const date = new Date(r.reservation_date + 'T00:00').toLocaleDateString('pt-BR');
    const msg = encodeURIComponent(`Olá ${r.customer_name}! Sua reserva para ${r.people_count} pessoas em ${date} às ${r.reservation_time.slice(0, 5)} está confirmada. Te esperamos! 🍽️`);
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank');
  };

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold">Reservas de Mesa</h1>
            <p className="text-sm text-muted-foreground">Gerencie reservas e confirmações</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setQrOpen(true)} disabled={!restaurant?.slug}>
              <QrCode className="h-4 w-4 mr-2" />QR Reservas
            </Button>
            <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Reserva</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <MetricCard label="Hoje" value={stats.todayCount} icon={Clock} />
          <MetricCard label="Pendentes" value={stats.pending} icon={CalendarCheck} />
          <MetricCard label="Acomodadas" value={stats.seated} icon={Check} />
          <MetricCard label="Total" value={stats.total} icon={Users} />
        </div>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Label className="text-sm">Filtrar:</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="upcoming">Próximas</SelectItem>
                <SelectItem value="past">Passadas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="confirmed">Confirmadas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma reserva</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => {
                const cfg = statusConfig[r.status] || statusConfig.pending;
                return (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex flex-col items-center justify-center shrink-0 text-xs font-bold">
                      <span className="text-sm leading-none">{new Date(r.reservation_date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit' })}</span>
                      <span className="leading-none mt-0.5">{new Date(r.reservation_date + 'T00:00').toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-medium text-sm">{r.customer_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.reservation_time.slice(0, 5)}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.people_count}p</span>
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.customer_phone}</span>
                        <Badge variant="secondary" className={cfg.className}>{cfg.label}</Badge>
                      </div>
                      {r.notes && <div className="text-xs text-muted-foreground mt-1">{r.notes}</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => sendWhatsApp(r)} title="WhatsApp">
                        <MessageCircle className="h-3.5 w-3.5 text-success" />
                      </Button>
                      {r.status !== 'seated' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, 'seated')}>
                          <Check className="h-3.5 w-3.5 mr-1" />Acomodar
                        </Button>
                      )}
                      {!['cancelled', 'no_show'].includes(r.status) && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, 'cancelled')}>
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nova Reserva</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome do Cliente *</Label>
                <Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Telefone *</Label>
                  <Input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} placeholder="(31) 99999-9999" />
                </div>
                <div>
                  <Label>Pessoas</Label>
                  <Input type="number" min="1" value={form.people_count} onChange={e => setForm({ ...form, people_count: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={form.reservation_date} onChange={e => setForm({ ...form, reservation_date: e.target.value })} />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Input type="time" value={form.reservation_time} onChange={e => setForm({ ...form, reservation_time: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Ex: aniversário, mesa próxima janela..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: QR Code de Reservas */}
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code de Reservas</DialogTitle>
              <DialogDescription>
                Compartilhe este QR Code para que clientes reservem mesas direto pelo celular.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="mx-auto w-64 h-64 bg-white rounded-xl flex items-center justify-center p-4 border border-border">
                {reservationUrl && (
                  <QRCodeCanvas id="reservation-qr-canvas" value={reservationUrl} size={224} level="M" includeMargin />
                )}
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Link de reservas</p>
                <p className="text-sm font-mono break-all">{reservationUrl}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadQR}>
                  <Download className="h-4 w-4 mr-1" />Baixar
                </Button>
                <Button variant="outline" size="sm" onClick={printQR}>
                  <Printer className="h-4 w-4 mr-1" />Imprimir
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                💡 Cole esse QR no balcão, cardápio físico ou poste no Instagram para receber reservas 24h.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RestaurantLayout>
  );
}
