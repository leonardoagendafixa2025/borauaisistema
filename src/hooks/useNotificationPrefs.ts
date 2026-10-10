import { useEffect, useState, useCallback } from 'react';

export interface NotificationPrefs {
  sound: boolean;
  vibration: boolean;
}

const DEFAULTS: NotificationPrefs = { sound: true, vibration: true };
const STORAGE_KEY = 'notif_prefs:v1';
const EVENT = 'notif-prefs-changed';

function read(): NotificationPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function write(prefs: NotificationPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {}
}

/** Read-only sync getter for use inside non-React callbacks (realtime handlers). */
export function getNotificationPrefs(): NotificationPrefs {
  return read();
}

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(read);

  useEffect(() => {
    const handler = () => setPrefs(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const update = useCallback((patch: Partial<NotificationPrefs>) => {
    const next = { ...read(), ...patch };
    write(next);
    setPrefs(next);
  }, []);

  return {
    prefs,
    setSound: (v: boolean) => update({ sound: v }),
    setVibration: (v: boolean) => update({ vibration: v }),
  };
}
