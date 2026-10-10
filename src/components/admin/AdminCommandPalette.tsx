import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import { ADMIN_NAV } from './adminNav';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useRestaurant } from '@/hooks/useRestaurantData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  PlusCircle, Power, RotateCcw, ExternalLink, Lock,
} from 'lucide-react';

export default function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const plan = usePlanFeatures();
  const { data: restaurant } = useRestaurant();

  // Cmd+K / Ctrl+K toggles
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const action = async (fn: () => Promise<void> | void) => {
    setOpen(false);
    await fn();
  };

  const toggleOpen = async () => {
    if (!restaurant) return;
    const isOpen = restaurant.is_open;
    await supabase
      .from('restaurants')
      .update({ force_closed: isOpen, is_open: !isOpen } as any)
      .eq('id', restaurant.id);
    toast.success(isOpen ? 'Restaurante fechado' : 'Restaurante reaberto');
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar páginas, ações… (Cmd+K)" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => action(toggleOpen)}>
            <Power className="h-4 w-4 mr-2" />
            {restaurant?.is_open ? 'Fechar restaurante agora' : 'Reabrir restaurante'}
          </CommandItem>
          <CommandItem onSelect={() => go('/restaurant/menu?new=1')}>
            <PlusCircle className="h-4 w-4 mr-2" /> Criar produto
          </CommandItem>
          <CommandItem onSelect={() => go('/restaurant/cashier')}>
            <RotateCcw className="h-4 w-4 mr-2" /> Abrir/fechar caixa
          </CommandItem>
          {restaurant?.slug && (
            <CommandItem onSelect={() => action(() => { window.open(`/${restaurant.slug}`, '_blank'); })}>
              <ExternalLink className="h-4 w-4 mr-2" /> Abrir cardápio público
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {ADMIN_NAV.map((g) => (
          <CommandGroup key={g.id} heading={g.label}>
            {g.items.map((item) => {
              const isLocked = item.requiredFeature && !plan.loading && !plan[item.requiredFeature];
              return (
                <CommandItem
                  key={item.path}
                  value={`${item.label} ${item.keywords?.join(' ') ?? ''} ${g.label}`}
                  onSelect={() => !isLocked && go(item.path)}
                  className={isLocked ? 'opacity-50' : ''}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  <span>{item.label}</span>
                  {isLocked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
