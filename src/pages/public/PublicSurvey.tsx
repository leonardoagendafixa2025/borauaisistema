import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, CheckCircle2 } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { usePublicRestaurant } from '@/hooks/useRestaurantData';
import { toast } from 'sonner';

export default function PublicSurvey() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const { data: restaurant } = usePublicRestaurant(slug);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (score === null) { toast.error('Escolha uma nota'); return; }
    if (!restaurant) return;
    setSubmitting(true);
    const { error } = await publicSupabase.from('satisfaction_surveys').insert({
      restaurant_id: restaurant.id,
      order_id: orderId,
      score,
      comment: comment || null,
      food_rating: foodRating || null,
      service_rating: serviceRating || null,
      delivery_rating: deliveryRating || null,
    });
    setSubmitting(false);
    if (error) { toast.error('Erro ao enviar'); return; }
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
          <h1 className="text-2xl font-heading font-bold mb-2">Obrigado!</h1>
          <p className="text-muted-foreground mb-6">Sua avaliação ajuda {restaurant.name} a melhorar cada dia mais.</p>
          <Link to={`/${slug}`}><Button variant="outline" className="w-full">Voltar ao cardápio</Button></Link>
        </Card>
      </div>
    );
  }

  const StarRow = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <div>
      <p className="text-sm font-medium mb-1.5">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)} className="p-1">
            <Star className={`h-7 w-7 ${n <= value ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background p-4 py-8 font-public">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-heading font-bold">Como foi sua experiência?</h1>
          <p className="text-muted-foreground text-sm">{restaurant.name}</p>
        </div>
        <Card className="p-5 space-y-5">
          <div>
            <p className="text-sm font-medium mb-2">Em uma escala de 0 a 10, o quanto você recomendaria?</p>
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setScore(i)}
                  className={`aspect-square rounded text-sm font-bold transition-all ${
                    score === i
                      ? i >= 9 ? 'bg-success text-success-foreground scale-110'
                        : i >= 7 ? 'bg-warning text-warning-foreground scale-110'
                        : 'bg-destructive text-destructive-foreground scale-110'
                      : 'bg-muted hover:bg-muted/70'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>Não recomendaria</span>
              <span>Com certeza!</span>
            </div>
          </div>

          <StarRow value={foodRating} onChange={setFoodRating} label="🍽️ Comida" />
          <StarRow value={serviceRating} onChange={setServiceRating} label="👨‍🍳 Atendimento" />
          <StarRow value={deliveryRating} onChange={setDeliveryRating} label="🛵 Entrega (se aplicável)" />

          <div>
            <p className="text-sm font-medium mb-1.5">Comentário (opcional)</p>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Conte como foi..." />
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar avaliação'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
