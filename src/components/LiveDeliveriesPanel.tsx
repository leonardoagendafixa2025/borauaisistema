import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Truck, Phone, MessageCircle, MapPin, RefreshCw, AlertTriangle, Clock } from 'lucide-react';

// Fix default marker icons (Leaflet + bundlers issue)
const driverIcon = L.divIcon({
  className: '',
  html: `<div style="background:hsl(var(--primary));color:hsl(var(--primary-foreground));width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.25);border:3px solid white;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="16.5" r="3.5"/><circle cx="16.5" cy="16.5" r="3.5"/><path d="M5.5 17h-2c-.6 0-1-.4-1-1v-3c0-.9.7-1.7 1.5-1.9L7 9.5l3-7h6l1 4h2.6c.7 0 1.4.5 1.4 1.4V17"/></svg></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  vehicle: string;
  status: string;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
}

interface ActiveOrder {
  id: string;
  number: number;
  customer_name: string;
  customer_phone: string | null;
  address: string | null;
  total: number;
  driver_id: string | null;
  dispatched_at: string | null;
  created_at: string;
  status: string;
}

const elapsedMin = (iso: string | null) => {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
};

const formatElapsed = (m: number) => m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${m % 60}min`;

export default function LiveDeliveriesPanel() {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [reassignOrder, setReassignOrder] = useState<ActiveOrder | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('');
  const [tick, setTick] = useState(0);

  // Re-render every 30s for live elapsed counters
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(i);
  }, []);

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ['drivers_live', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase.from('delivery_drivers')
        .select('id,name,phone,vehicle,status,last_lat,last_lng,last_location_at')
        .eq('restaurant_id', restaurantId);
      return (data as any) || [];
    },
    enabled: !!restaurantId,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: activeOrders = [] } = useQuery<ActiveOrder[]>({
    queryKey: ['active_deliveries', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase.from('orders')
        .select('id,number,customer_name,customer_phone,address,total,driver_id,dispatched_at,created_at,status')
        .eq('restaurant_id', restaurantId)
        .in('status', ['delivering', 'ready'])
        .eq('type', 'delivery')
        .order('dispatched_at', { ascending: true, nullsFirst: false });
      return (data as any) || [];
    },
    enabled: !!restaurantId,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  // Realtime subscription for driver location
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase.channel('drivers-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'delivery_drivers', filter: `restaurant_id=eq.${restaurantId}` },
        () => queryClient.invalidateQueries({ queryKey: ['drivers_live'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => queryClient.invalidateQueries({ queryKey: ['active_deliveries'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, queryClient]);

  const driversWithGps = drivers.filter(d => d.last_lat != null && d.last_lng != null);
  const driverMap = useMemo(() => Object.fromEntries(drivers.map(d => [d.id, d])), [drivers]);

  // Map center: average of GPS positions, fallback São Paulo
  const center: [number, number] = driversWithGps.length
    ? [
        driversWithGps.reduce((s, d) => s + (d.last_lat || 0), 0) / driversWithGps.length,
        driversWithGps.reduce((s, d) => s + (d.last_lng || 0), 0) / driversWithGps.length,
      ]
    : [-19.9167, -43.9345]; // Belo Horizonte/MG (fallback)

  const handleReassign = async () => {
    if (!reassignOrder || !reassignTo) return;
    const { error } = await supabase.from('orders').update({ driver_id: reassignTo } as any).eq('id', reassignOrder.id);
    if (error) { toast.error('Erro ao reatribuir'); return; }
    toast.success('Entregador reatribuído');
    setReassignOrder(null); setReassignTo('');
    queryClient.invalidateQueries({ queryKey: ['active_deliveries'] });
  };

  const callPhone = (phone: string) => window.open(`tel:${phone.replace(/\D/g, '')}`, '_self');
  const whatsapp = (phone: string) => {
    const c = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${c.startsWith('55') ? c : '55' + c}`, '_blank');
  };

  const availableDrivers = drivers.filter(d => d.status === 'available' || d.status === 'busy');

  // Detect stale GPS (>2min)
  const isStale = (iso: string | null) => !iso || (Date.now() - new Date(iso).getTime()) > 120000;

  return (
    <div className="space-y-4">
      {/* Map */}
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-xl">
          <div className="h-[400px] w-full relative">
            {driversWithGps.length === 0 && (
              <div className="absolute inset-0 z-[400] bg-background/90 flex flex-col items-center justify-center gap-2 text-center p-4 pointer-events-none">
                <MapPin className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">Nenhum entregador online</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Os entregadores aparecem no mapa quando ativam o GPS no app deles em <code className="text-primary">/entregador</code>
                </p>
              </div>
            )}
            <MapContainer center={center} zoom={driversWithGps.length ? 13 : 11} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {driversWithGps.map(d => (
                <Marker key={d.id} position={[d.last_lat!, d.last_lng!]} icon={driverIcon}>
                  <Popup>
                    <div className="space-y-1">
                      <p className="font-semibold">{d.name}</p>
                      <p className="text-xs">Veículo: {d.vehicle}</p>
                      <p className="text-xs">Status: {d.status}</p>
                      <p className="text-xs text-muted-foreground">
                        GPS: {elapsedMin(d.last_location_at)}min atrás
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Active deliveries cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg font-bold">Entregas em andamento</h2>
          <Badge variant="secondary">{activeOrders.length} ativa(s)</Badge>
        </div>

        {activeOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Truck className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Nenhuma entrega em andamento</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {activeOrders.map(o => {
              const driver = o.driver_id ? driverMap[o.driver_id] : null;
              const mins = elapsedMin(o.dispatched_at || o.created_at);
              const late = mins > 45;
              return (
                <Card key={o.id} className={late ? 'border-destructive/40' : ''}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm">Pedido #{o.number}</p>
                        <p className="text-xs text-muted-foreground truncate">{o.customer_name}</p>
                      </div>
                      <Badge variant={o.status === 'delivering' ? 'default' : 'secondary'}>
                        {o.status === 'delivering' ? '🛵 Em rota' : 'Aguardando'}
                      </Badge>
                    </div>

                    {o.address && (
                      <p className="text-xs flex items-start gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{o.address}</span>
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span className={late ? 'text-destructive font-semibold' : ''}>
                          {o.dispatched_at ? `Saiu há ${formatElapsed(mins)}` : `Pronto há ${formatElapsed(mins)}`}
                        </span>
                        {late && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      </span>
                      <span className="font-semibold">R$ {Number(o.total).toFixed(2)}</span>
                    </div>

                    <div className="rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
                      {driver ? (
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${isStale(driver.last_location_at) ? 'bg-muted-foreground/40' : 'bg-primary animate-pulse'}`} />
                          <span className="font-medium">{driver.name}</span>
                          <span className="text-muted-foreground ml-auto">
                            {isStale(driver.last_location_at) ? 'GPS offline' : 'GPS ativo'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Sem entregador atribuído</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {o.customer_phone && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => callPhone(o.customer_phone!)}>
                            <Phone className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => whatsapp(o.customer_phone!)}>
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" onClick={() => { setReassignOrder(o); setReassignTo(o.driver_id || ''); }}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reatribuir
                      </Button>
                      {o.status === 'delivering' && (
                        <Badge className="ml-auto" variant="secondary">Aguardando entregador concluir</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Reassign dialog */}
      <Dialog open={!!reassignOrder} onOpenChange={(o) => !o && setReassignOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reatribuir pedido #{reassignOrder?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger><SelectValue placeholder="Escolha um entregador" /></SelectTrigger>
              <SelectContent>
                {availableDrivers.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} · {d.status === 'available' ? 'Disponível' : 'Em entrega'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableDrivers.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum entregador disponível.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOrder(null)}>Cancelar</Button>
            <Button onClick={handleReassign} disabled={!reassignTo}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
