import { useCallback, useRef, useState } from 'react';

/**
 * Web Serial API hook for connecting to electronic scales (Toledo, Filizola, Urano).
 * Supports the most common ASCII protocol: weight in kg with terminator (CR/LF).
 * Browser support: Chrome, Edge, Opera (HTTPS or localhost only).
 */
export function useScale() {
  const [connected, setConnected] = useState(false);
  const [weight, setWeight] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const stopRef = useRef(false);

  const isSupported = typeof navigator !== 'undefined' && 'serial' in navigator;

  const parseWeight = (chunk: string): number | null => {
    // Common patterns: "001.234kg", "1.234", "ST,GS,+001.234kg"
    const m = chunk.replace(',', '.').match(/([+-]?\d+\.\d+)/);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return isNaN(v) ? null : v;
  };

  const connect = useCallback(async (baudRate = 9600) => {
    setError(null);
    if (!isSupported) {
      setError('Navegador não suporta Web Serial API. Use Chrome/Edge/Opera.');
      return false;
    }
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none' });
      portRef.current = port;
      setConnected(true);
      stopRef.current = false;

      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable).catch(() => {});
      const reader = decoder.readable.getReader();
      readerRef.current = reader;

      let buffer = '';
      (async () => {
        while (!stopRef.current) {
          try {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split(/[\r\n]+/);
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              const w = parseWeight(line);
              if (w !== null) setWeight(w);
            }
          } catch (err) {
            console.warn('Scale read error:', err);
            break;
          }
        }
      })();

      return true;
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao conectar com a balança');
      return false;
    }
  }, [isSupported]);

  const disconnect = useCallback(async () => {
    stopRef.current = true;
    try { await readerRef.current?.cancel(); } catch {}
    try { await portRef.current?.close(); } catch {}
    portRef.current = null;
    readerRef.current = null;
    setConnected(false);
    setWeight(null);
  }, []);

  return { isSupported, connected, weight, error, connect, disconnect };
}
