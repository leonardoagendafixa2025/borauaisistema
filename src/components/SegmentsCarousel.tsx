import { useEffect, useRef } from 'react';
import barIcon from '@/assets/category-bar.png';
import snackIcon from '@/assets/category-snack-bar.png';
import pizzaIcon from '@/assets/category-pizzeria.png';
import acaiIcon from '@/assets/category-acaiteria.png';

const segments = [
  { name: 'Bares', icon: barIcon, bg: 'bg-slate-900' },
  { name: 'Restaurantes', icon: snackIcon, bg: 'bg-orange-400' },
  { name: 'Pizzarias', icon: pizzaIcon, bg: 'bg-orange-500' },
  { name: 'Hamburguerias', icon: snackIcon, bg: 'bg-red-500' },
  { name: 'Lanchonetes', icon: snackIcon, bg: 'bg-amber-500' },
  { name: 'Açaiterias', icon: acaiIcon, bg: 'bg-purple-500' },
  { name: 'Cafeterias', icon: snackIcon, bg: 'bg-yellow-700' },
  { name: 'Casas Noturnas', icon: barIcon, bg: 'bg-fuchsia-700' },
];

export default function SegmentsCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);

  // Auto-scroll suave (loop infinito) - apenas em desktop
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const isDesktop = window.matchMedia('(min-width: 640px)').matches;
    if (!isDesktop) return;

    let raf = 0;
    let paused = false;
    const speed = 0.5;

    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    track.addEventListener('mouseenter', onEnter);
    track.addEventListener('mouseleave', onLeave);

    const tick = () => {
      if (!paused && track) {
        track.scrollLeft += speed;
        if (track.scrollLeft >= track.scrollWidth / 2) {
          track.scrollLeft = 0;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener('mouseenter', onEnter);
      track.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // duplica para loop infinito
  const items = [...segments, ...segments];

  return (
    <section className="py-12 lg:py-16 bg-background border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold tracking-tight">
            Feito para o <span className="text-primary">seu negócio</span>
          </h2>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base">
            Bares, restaurantes e baladas de todo tipo já vendem mais com o Bora Uai
          </p>
        </div>

        <div className="relative">
          <div
            ref={trackRef}
            className="flex gap-6 sm:gap-8 overflow-x-auto sm:overflow-x-hidden scroll-smooth py-4 px-2 snap-x snap-mandatory sm:snap-none"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {items.map((seg, i) => (
              <div
                key={`${seg.name}-${i}`}
                className={`flex-shrink-0 w-36 sm:w-40 rounded-2xl ${seg.bg} p-4 flex flex-col items-center justify-end gap-2 shadow-lg hover:scale-105 transition-transform cursor-pointer`}
                style={{ aspectRatio: '1 / 1' }}
              >
                <div className="flex-1 flex items-center justify-center w-full">
                  <img
                    src={seg.icon}
                    alt={seg.name}
                    className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-md"
                    loading="eager"
                    decoding="async"
                  />
                </div>
                <span className="text-white text-xs sm:text-sm font-bold text-center leading-tight">
                  {seg.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
