import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'pill';
}

/**
 * Global dark/light toggle. Renders a pill button by default; use variant="icon" for compact.
 */
export function ThemeToggle({ className, variant = 'icon' }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
          'bg-card ring-1 ring-border/50 hover:bg-muted transition-all active:scale-95',
          className,
        )}
      >
        {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        <span>{isDark ? 'Claro' : 'Escuro'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className={cn(
        'h-10 w-10 inline-flex items-center justify-center rounded-full',
        'bg-card ring-1 ring-border/50 hover:bg-muted transition-all active:scale-95 shadow-sm',
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
