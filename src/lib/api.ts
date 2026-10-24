/**
 * API utility for resolving backend endpoints.
 * Automatically handles native Capacitor/Android environments where origin is localhost
 * and redirects requests to the production backend (https://borauai.com).
 */

const PROD_API_BASE = 'https://borauai.com';

export function getApiUrl(endpoint: string): string {
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (typeof window !== 'undefined') {
    const isCapacitorOrNative =
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      (window as any).Capacitor?.isNativePlatform?.() ||
      (window.location.hostname === 'localhost' && window.location.port !== '5173' && window.location.port !== '8080');

    if (isCapacitorOrNative) {
      return `${PROD_API_BASE}${cleanPath}`;
    }
  }

  return cleanPath;
}
