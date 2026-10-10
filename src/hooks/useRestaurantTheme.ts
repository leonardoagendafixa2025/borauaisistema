import { useEffect } from 'react';

function hexToHSL(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Applies restaurant's custom primary/secondary colors as CSS variables
 * so Tailwind's `bg-primary`, `text-primary`, etc. pick them up automatically.
 */
export function useRestaurantTheme(
  primaryColor?: string | null,
  secondaryColor?: string | null
) {
  useEffect(() => {
    const root = document.documentElement;
    const overrides: string[] = [];

    if (primaryColor) {
      const hsl = hexToHSL(primaryColor);
      if (hsl) {
        root.style.setProperty('--primary', hsl);
        overrides.push('--primary');

        // Derive primary-foreground: white for dark primaries, dark for light ones
        const lightness = parseInt(hsl.split('%')[0].split(' ').pop() || '50');
        const fgHsl = lightness < 55 ? '0 0% 100%' : '0 0% 10%';
        root.style.setProperty('--primary-foreground', fgHsl);
        overrides.push('--primary-foreground');

        // Also set sidebar-primary to match
        root.style.setProperty('--sidebar-primary', hsl);
        root.style.setProperty('--sidebar-primary-foreground', fgHsl);
        overrides.push('--sidebar-primary', '--sidebar-primary-foreground');
      }
    }

    if (secondaryColor) {
      const hsl = hexToHSL(secondaryColor);
      if (hsl) {
        root.style.setProperty('--secondary', hsl);
        overrides.push('--secondary');

        const lightness = parseInt(hsl.split('%')[0].split(' ').pop() || '50');
        const fgHsl = lightness < 55 ? '0 0% 100%' : '0 0% 10%';
        root.style.setProperty('--secondary-foreground', fgHsl);
        overrides.push('--secondary-foreground');
      }
    }

    return () => {
      overrides.forEach(prop => root.style.removeProperty(prop));
    };
  }, [primaryColor, secondaryColor]);
}
