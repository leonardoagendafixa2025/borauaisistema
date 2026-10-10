import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { Truck, MapPin, Wifi, WifiOff } from 'lucide-react';

interface DriverLocation {
  driver_name: string | null;
  vehicle: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
  status: string | null;
  order_status: string;
  order_address: string | null;
}

const driverIcon = L.divIcon({
  className: '',
  html: `<div style="background:hsl(var(--primary));color:hsl(var(--primary-foreground));width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.3);border:3px solid white;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="16.5" r="3.5"/><circle cx="16.5" cy="16.5" r="3.5"/><path d="M5.5 17h-2c-.6 0-1-.4-1-1v-3c0-.9.7-1.7 1.5-1.9L7 9.5l3-7h6l1 4h2.6c.7 0 1.4.5 1.4 1.4V17"/></svg></div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const elapsedSec = (iso: string | null) => {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
};

export default function CustomerDeliveryMap({ orderId }: { orderId: string }) {
  const [data, setData] = useState<DriverLocation | null>(null);
  const [tick, setTick] = useState(0);

  // Refresh every 15s while delivering
  useEffect(() => {
    const fetchLoc = async () => {
      const { data: rows } = await publicSupabase
        .rpc('get_order_driver_location', { _order_id: orderId });
      if (rows && rows.length > 0) setData(rows[0] as any);
    };
    fetchLoc();
    const i = setInterval(() => { fetchLoc(); setTick(t => t + 1); }, 15000);
    return () => clearInterval(i);
  }, [orderId]);

  if (!data || data.last_lat == null || data.last_lng == null) {
    return (
      <div className="card-elevated p-5">
        <h3 className="font-heading font-semibold mb-2 flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" /> Rastreio do entregador
        </h3>
        <div className="rounded-lg bg-muted/40 p-6 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">Aguardando GPS do entregador</p>
          <p className="text-xs text-muted-foreground mt-1">
            O rastreio aparecerá aqui assim que o entregador iniciar a rota.
          </p>
        </div>
      </div>
    );
  }

  const stale = elapsedSec(data.last_location_at) > 120;
  const center: [number, number] = [data.last_lat, data.last_lng];

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" /> Rastreio em tempo real
        </h3>
        <span className={`text-xs flex items-center gap-1 ${stale ? 'text-muted-foreground' : 'text-success'}`}>
          {stale ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3 animate-pulse" />}
          {stale ? 'GPS pausado' : 'Ao vivo'}
        </span>
      </div>

      <div className="h-[280px] w-full rounded-lg overflow-hidden border border-border">
        <MapContainer key={tick === 0 ? 'init' : 'refresh'} center={center} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={center} icon={driverIcon}>
            <Popup>
              <div className="space-y-0.5">
                <p className="font-semibold text-sm">{data.driver_name || 'Entregador'}</p>
                <p className="text-xs">🛵 {data.vehicle}</p>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-medium">{data.driver_name} · {data.vehicle}</span>
        <span className="text-muted-foreground">
          Atualizado {elapsedSec(data.last_location_at) < 60 ? 'agora' : `há ${Math.floor(elapsedSec(data.last_location_at) / 60)}min`}
        </span>
      </div>

      {data.order_address && (
        <p className="mt-2 text-xs text-muted-foreground flex items-start gap-1.5">
          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Destino: {data.order_address}</span>
        </p>
      )}
    </div>
  );
}
