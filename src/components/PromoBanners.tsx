import { useEffect, useState, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/public-client';

interface Banner {
  id: string;
  image_url: string;
  title: string | null;
  link_type: string;
  link_target: string | null;
}

interface PromoBannersProps {
  restaurantId: string | undefined;
  onCategoryClick?: (categoryId: string) => void;
  onProductClick?: (productId: string) => void;
}

export default function PromoBanners({ restaurantId, onCategoryClick, onProductClick }: PromoBannersProps) {
  const { data: banners = [] } = useQuery({
    queryKey: ['promo-banners', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await publicSupabase
        .from('restaurant_banners' as any)
        .select('id, image_url, title, link_type, link_target, sort_order, active, starts_at, ends_at')
        .eq('restaurant_id', restaurantId!)
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]).filter((b) => {
        if (b.starts_at && b.starts_at > nowIso) return false;
        if (b.ends_at && b.ends_at < nowIso) return false;
        return true;
      }) as Banner[];
    },
  });

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' }, [
    Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  if (banners.length === 0) return null;

  const handleBannerClick = (b: Banner) => {
    if (b.link_type === 'category' && b.link_target && onCategoryClick) {
      onCategoryClick(b.link_target);
    } else if (b.link_type === 'product' && b.link_target && onProductClick) {
      onProductClick(b.link_target);
    } else if (b.link_type === 'external' && b.link_target) {
      window.open(b.link_target, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-3">
      <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
        <div className="flex">
          {banners.map((b) => (
            <div key={b.id} className="flex-[0_0_100%] min-w-0">
              <button
                type="button"
                onClick={() => handleBannerClick(b)}
                disabled={b.link_type === 'none'}
                className={`block w-full aspect-[3/1] bg-muted overflow-hidden ${b.link_type !== 'none' ? 'cursor-pointer active:scale-[0.99] transition-transform' : 'cursor-default'}`}
                aria-label={b.title || 'Promoção'}
              >
                <img
                  src={b.image_url}
                  alt={b.title || 'Promoção'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            </div>
          ))}
        </div>
      </div>
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === selected ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
              aria-label={`Ir para banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
