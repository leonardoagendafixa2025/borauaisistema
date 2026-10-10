import { useState } from 'react';
import RestaurantLayout from '@/components/layout/RestaurantLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Truck, Bike, Car, Edit2, Trash2, Phone, User, Power, PowerOff, Copy, KeyRound, MapPin, Star } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import LiveDeliveriesPanel from '@/components/LiveDeliveriesPanel';

const vehicleLabels: Record<string, { label: string; icon: typeof Truck }> = {
  moto: { label: 'Moto', icon: Bike },
  carro: { label: 'Carro', icon: Car },
  bicicleta: { label: 'Bicicleta', icon: Bike },
  a_pe: { label: 'A pé', icon: User },
};

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  available: { label: 'Disponível', variant: 'default' },
  busy: { label: 'Em entrega', variant: 'secondary' },
  offline: { label: 'Offline', variant: 'outline' },
};

interface DriverForm {
  name: string;
  phone: string;
  vehicle: string;
}

export default function DeliveryDriversPage() {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DriverForm>({ name: '', phone: '', vehicle: 'moto' });

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['delivery_drivers', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('delivery_drivers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });

  // Active deliveries count per driver
  const { data: activeDeliveries = {} } = useQuery({
    queryKey: ['driver_active_deliveries', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return {};
      const { data } = await supabase
        .from('orders')
        .select('driver_id')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'delivering')
        .not('driver_id', 'is', null);
      const counts: Record<string, number> = {};
      data?.forEach(o => {
        if (o.driver_id) counts[o.driver_id] = (counts[o.driver_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!restaurantId,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  // Driver ratings summary
  const { data: ratings = {} } = useQuery({
    queryKey: ['driver_ratings_summary', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return {};
      const { data } = await (supabase as any)
        .from('driver_ratings_summary')
        .select('driver_id, avg_rating, total_ratings')
        .eq('restaurant_id', restaurantId);
      const map: Record<string, { avg: number; total: number }> = {};
      (data || []).forEach((r: any) => {
        map[r.driver_id] = { avg: Number(r.avg_rating) || 0, total: r.total_ratings || 0 };
      });
      return map;
    },
    enabled: !!restaurantId,
  });

  const openNew = () => {
    setEditingId(null);
    setForm({ name: '', phone: '', vehicle: 'moto' });
    setDialogOpen(true);
  };

  const openEdit = (driver: any) => {
    setEditingId(driver.id);
    setForm({ name: driver.name, phone: driver.phone || '', vehicle: driver.vehicle });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!restaurantId) return;

    if (editingId) {
      const { error } = await supabase.from('delivery_drivers').update({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        vehicle: form.vehicle,
      }).eq('id', editingId);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Entregador atualizado');
    } else {
      const { error } = await supabase.from('delivery_drivers').insert({
        restaurant_id: restaurantId,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        vehicle: form.vehicle,
      });
      if (error) { toast.error('Erro ao cadastrar'); return; }
      toast.success('Entregador cadastrado');
    }
    queryClient.invalidateQueries({ queryKey: ['delivery_drivers'] });
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este entregador?')) return;
    await supabase.from('delivery_drivers').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['delivery_drivers'] });
    toast.success('Entregador removido');
  };

  const toggleStatus = async (id: string, current: string) => {
    const next = current === 'available' ? 'offline' : 'available';
    await supabase.from('delivery_drivers').update({ status: next }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['delivery_drivers'] });
  };

  const available = drivers.filter((d: any) => d.status === 'available').length;
  const busy = drivers.filter((d: any) => d.status === 'busy').length;

  return (
    <RestaurantLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Entregadores</h1>
            <p className="text-sm text-muted-foreground">Acompanhe entregas em tempo real e gerencie sua equipe</p>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Entregador</Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{drivers.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Disponíveis</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">{available}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Em entrega</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-accent-foreground">{busy}</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="live" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="live" className="gap-1">
              <MapPin className="h-3.5 w-3.5" /> Em rota (mapa)
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1">
              <User className="h-3.5 w-3.5" /> Equipe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live">
            <LiveDeliveriesPanel />
          </TabsContent>

          <TabsContent value="team">
            {/* Onboarding hint */}
            <Card className="mb-4 border-primary/30 bg-primary/5">
              <CardContent className="py-4 text-sm flex items-start gap-3">
                <KeyRound className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Como o entregador acessa o app</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Cada entregador entra em <code className="bg-background px-1 py-0.5 rounded">/entregador</code> com o código do restaurante e o PIN abaixo. Lá ele ativa o GPS e aparece no mapa em tempo real.
                  </p>
                </div>
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : drivers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum entregador cadastrado</p>
                  <Button className="mt-4" onClick={openNew}>Cadastrar primeiro entregador</Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>PIN do app</TableHead>
                      <TableHead>Em rota</TableHead>
                      <TableHead>Avaliação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.map((driver: any) => {
                      const veh = vehicleLabels[driver.vehicle] || vehicleLabels.moto;
                      const VehIcon = veh.icon;
                      const copyPin = () => {
                        navigator.clipboard.writeText(driver.access_pin || '');
                        toast.success(`PIN ${driver.access_pin} copiado`);
                      };
                      return (
                        <TableRow key={driver.id}>
                          <TableCell className="font-medium">{driver.name}</TableCell>
                          <TableCell>
                            {driver.phone ? (
                              <span className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" />{driver.phone}</span>
                            ) : <span className="text-muted-foreground text-sm">—</span>}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1 text-sm"><VehIcon className="h-4 w-4" />{veh.label}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={driver.status !== 'offline'}
                                onCheckedChange={() => toggleStatus(driver.id, driver.status)}
                                disabled={driver.status === 'busy'}
                                aria-label={driver.status === 'offline' ? 'Ativar entregador' : 'Desativar entregador'}
                              />
                              {driver.status === 'busy' ? (
                                <Badge variant="secondary" className="gap-1">
                                  <Truck className="h-3 w-3" /> Em entrega
                                </Badge>
                              ) : driver.status === 'available' ? (
                                <span className="text-sm font-medium text-primary flex items-center gap-1">
                                  <Power className="h-3 w-3" /> Online
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <PowerOff className="h-3 w-3" /> Offline
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <button onClick={copyPin}
                              className="font-mono text-sm bg-muted hover:bg-muted/70 px-2 py-1 rounded inline-flex items-center gap-1.5 transition-colors"
                              title="Copiar PIN">
                              {driver.access_pin || '—'}
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </TableCell>
                          <TableCell>{activeDeliveries[driver.id] || 0}</TableCell>
                          <TableCell>
                            {ratings[driver.id]?.total > 0 ? (
                              <span className="inline-flex items-center gap-1 text-sm font-medium">
                                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                {ratings[driver.id].avg.toFixed(1)}
                                <span className="text-xs text-muted-foreground">({ratings[driver.id].total})</span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem avaliações</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(driver)}><Edit2 className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(driver.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>


      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Entregador' : 'Novo Entregador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do entregador" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label>Veículo</Label>
              <Select value={form.vehicle} onValueChange={v => setForm(f => ({ ...f, vehicle: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="moto">🏍️ Moto</SelectItem>
                  <SelectItem value="carro">🚗 Carro</SelectItem>
                  <SelectItem value="bicicleta">🚲 Bicicleta</SelectItem>
                  <SelectItem value="a_pe">🚶 A pé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? 'Salvar' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RestaurantLayout>
  );
}
