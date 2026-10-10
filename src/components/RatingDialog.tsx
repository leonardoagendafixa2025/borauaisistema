import { useEffect, useRef, useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/public-client';
import { toast } from 'sonner';

interface Props {
  orderId: string;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

const RESTAURANT_TAGS = [
  'Comida quente', 'Bem embalado', 'Sabor excelente',
  'Boa apresentação', 'Comida fria', 'Faltou item', 'Veio errado'
];

const DRIVER_TAGS = [
  'Rápido', 'Educado', 'Cuidadoso',
  'Pontual', 'Demorou', 'Mau humor'
];

export default function RatingDialog({ orderId, open, onClose, onSubmitted }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [order, setOrder] = useState<any>(null);
  const [existingSurvey, setExistingSurvey] = useState<any>(null);
  const [existingDriverRating, setExistingDriverRating] = useState<any>(null);

  // Restaurant
  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [restaurantTags, setRestaurantTags] = useState<string[]>([]);
  const [restaurantComment, setRestaurantComment] = useState('');

  // Driver
  const [driverRating, setDriverRating] = useState(0);
  const [driverTags, setDriverTags] = useState<string[]>([]);
  const [driverComment, setDriverComment] = useState('');

  const fetchRatingStatus = async () => {
    const { data } = await (publicSupabase as any)
      .rpc('get_order_rating_status', { _order_id: orderId });
    const status = Array.isArray(data) ? data[0] : data;
    return {
      restaurantDone: !!status?.restaurant_done,
      driverDone: status?.driver_done !== false,
    };
  };

  useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    submittingRef.current = false;
    (async () => {
      const { data: o } = await publicSupabase
        .from('orders')
        .select('id, restaurant_id, driver_id, customer_name, customer_phone, type, status, restaurants(name)')
        .eq('id', orderId).maybeSingle();
      setOrder(o);

      const status = await fetchRatingStatus();
      setExistingSurvey(status.restaurantDone ? { id: 'done' } : null);
      setExistingDriverRating(status.driverDone ? { id: 'done' } : null);

      setLoading(false);
    })();
  }, [open, orderId]);

  const toggleTag = (list: string[], setList: (v: string[]) => void, tag: string) => {
    setList(list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag]);
  };

  const submit = async () => {
    if (submittingRef.current) return;
    if (!order) return;
    if (!existingSurvey && foodRating === 0 && serviceRating === 0) {
      toast.error('Avalie a comida e o atendimento');
      return;
    }
    const isDelivery = order.type === 'delivery' && order.driver_id;
    if (isDelivery && !existingDriverRating && driverRating === 0) {
      toast.error('Avalie o entregador');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const freshStatus = await fetchRatingStatus();
      const restaurantAlreadyDone = freshStatus.restaurantDone;
      const driverAlreadyDone = freshStatus.driverDone;
      setExistingSurvey(restaurantAlreadyDone ? { id: 'done' } : null);
      setExistingDriverRating(driverAlreadyDone ? { id: 'done' } : null);

      if (restaurantAlreadyDone && (!isDelivery || driverAlreadyDone)) {
        toast.info('Este pedido já foi avaliado. Obrigado pelo feedback!');
        onSubmitted?.();
        onClose();
        return;
      }

      // Restaurant survey
      if (!restaurantAlreadyDone) {
        const overall = Math.round(((foodRating + serviceRating) / 2) * 2); // escala 0-10
        const { error } = await publicSupabase.from('satisfaction_surveys').insert({
          restaurant_id: order.restaurant_id,
          order_id: order.id,
          customer_name: order.customer_name?.slice(0, 100) || null,
          customer_phone: order.customer_phone?.slice(0, 20) || null,
          score: overall,
          food_rating: foodRating || null,
          service_rating: serviceRating || null,
          tags: restaurantTags,
          comment: restaurantComment.trim().slice(0, 500) || null,
        } as any);
        if (error) throw error;
      }

      // Driver rating
      if (isDelivery && !driverAlreadyDone) {
        const { error } = await publicSupabase.from('driver_ratings').insert({
          restaurant_id: order.restaurant_id,
          driver_id: order.driver_id,
          order_id: order.id,
          customer_name: order.customer_name?.slice(0, 100) || null,
          customer_phone: order.customer_phone?.slice(0, 20) || null,
          rating: driverRating,
          tags: driverTags,
          comment: driverComment.trim().slice(0, 500) || null,
        } as any);
        if (error) throw error;
      }

      toast.success('Obrigado pela sua avaliação! ⭐');
      onSubmitted?.();
      onClose();
    } catch (e: any) {
      if (e?.code === '23505' || String(e?.message || '').toLowerCase().includes('duplicate')) {
        toast.info('Este pedido já foi avaliado. Obrigado pelo feedback!');
        onSubmitted?.();
        onClose();
      } else {
        toast.error('Erro ao enviar: ' + (e.message || 'tente novamente'));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const isDelivery = order?.type === 'delivery' && order?.driver_id;
  const restaurantDone = !!existingSurvey;
  const driverDone = !!existingDriverRating;
  const allDone = restaurantDone && (!isDelivery || driverDone);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-heading font-bold text-lg">Avaliar pedido</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : allDone ? (
          <div className="p-8 text-center space-y-3">
            <div className="text-5xl">⭐</div>
            <h3 className="font-bold text-lg">Você já avaliou este pedido</h3>
            <p className="text-sm text-muted-foreground">Obrigado pelo feedback!</p>
            <button onClick={onClose} className="mt-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium">Fechar</button>
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Restaurant section */}
            {!restaurantDone && (
              <section className="space-y-4">
                <h3 className="font-semibold">🍽️ {order?.restaurants?.name || 'Restaurante'}</h3>

                <RatingStars label="Qualidade da comida" value={foodRating} onChange={setFoodRating} />
                <RatingStars label="Atendimento" value={serviceRating} onChange={setServiceRating} />

                <TagSelector tags={RESTAURANT_TAGS} selected={restaurantTags} onToggle={(t) => toggleTag(restaurantTags, setRestaurantTags, t)} />

                <textarea
                  value={restaurantComment}
                  onChange={(e) => setRestaurantComment(e.target.value.slice(0, 500))}
                  placeholder="Comentário (opcional)"
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                />
              </section>
            )}

            {/* Driver section */}
            {isDelivery && !driverDone && (
              <section className="space-y-4 pt-4 border-t border-border">
                <h3 className="font-semibold">🛵 Entregador</h3>

                <RatingStars label="Como foi a entrega?" value={driverRating} onChange={setDriverRating} />

                <TagSelector tags={DRIVER_TAGS} selected={driverTags} onToggle={(t) => toggleTag(driverTags, setDriverTags, t)} />

                <textarea
                  value={driverComment}
                  onChange={(e) => setDriverComment(e.target.value.slice(0, 500))}
                  placeholder="Comentário sobre o entregador (opcional)"
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                />
              </section>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full rounded-lg bg-primary text-primary-foreground font-semibold py-3 disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {submitting ? 'Enviando...' : 'Enviar avaliação'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RatingStars({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-1 transition-transform active:scale-90"
            aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
          >
            <Star className={`h-8 w-8 ${n <= value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function TagSelector({ tags, selected, onToggle }: { tags: string[]; selected: string[]; onToggle: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => {
        const on = selected.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onToggle(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              on ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border hover:bg-muted'
            }`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
