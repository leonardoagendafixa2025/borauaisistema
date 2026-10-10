import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { usePublicRestaurant } from '@/hooks/useRestaurantData';
import { toast } from 'sonner';

export default function PublicReservation() {
  const { slug } = useParams();
  const { data: restaurant } = usePublicRestaurant(slug);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '',
    reservation_date: new Date().toISOString().slice(0, 10),
    reservation_time: '20:00', people_count: '2', notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    if (!form.customer_name || !form.customer_phone) { toast.error('Preencha nome e telefone'); return; }
    setSubmitting(true);
    const { error } = await publicSupabase.from('table_reservations').insert({
      restaurant_id: restaurant.id,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_email: form.customer_email || null,
      reservation_date: form.reservation_date,
      reservation_time: form.reservation_time,
      people_count: parseInt(form.people_count),
      notes: form.notes || null,
      status: 'pending',
    });
    setSubmitting(false);
    if (error) { toast.error('Erro ao enviar reserva'); return; }
    setDone(true);
  };

  if (!restaurant) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
          <h1 className="text-2xl font-heading font-bold mb-2">Reserva enviada!</h1>
          <p className="text-muted-foreground mb-6">Em breve {restaurant.name} confirmará sua reserva via WhatsApp.</p>
          <Link to={`/${slug}`}><Button variant="outline" className="w-full">Voltar ao cardápio</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background p-4 py-8 font-public">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <CalendarCheck className="h-12 w-12 text-primary mx-auto mb-2" />
          <h1 className="text-2xl font-heading font-bold">Reservar Mesa</h1>
          <p className="text-muted-foreground text-sm">{restaurant.name}</p>
        </div>
        <Card className="p-5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Seu nome *</Label>
              <Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} required />
            </div>
            <div>
              <Label>WhatsApp *</Label>
              <Input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} placeholder="(31) 99999-9999" required />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data *</Label>
                <Input type="date" min={new Date().toISOString().slice(0, 10)} value={form.reservation_date} onChange={e => setForm({ ...form, reservation_date: e.target.value })} required />
              </div>
              <div>
                <Label>Horário *</Label>
                <Input type="time" value={form.reservation_time} onChange={e => setForm({ ...form, reservation_time: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>Número de pessoas *</Label>
              <Input type="number" min="1" max="30" value={form.people_count} onChange={e => setForm({ ...form, people_count: e.target.value })} required />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Aniversário, restrição alimentar..." />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Solicitar Reserva'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
