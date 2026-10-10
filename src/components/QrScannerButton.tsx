import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Lightweight QR scanner using the native BarcodeDetector API (Chrome/Edge/Android).
 * Falls back to a friendly toast when unsupported (Safari/iOS) — user types the code.
 */
export default function QrScannerButton({
  onDetected,
  className = '',
}: {
  onDetected: (code: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setSupported('BarcodeDetector' in window);
  }, []);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOpen(false);
  };

  const start = async () => {
    if (!('BarcodeDetector' in window)) {
      toast.info('Scanner indisponível neste navegador. Digite o código manualmente.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setOpen(true);
      // Wait for video element after open
      requestAnimationFrame(async () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // @ts-ignore – BarcodeDetector is not in the lib yet
        const detector = new window.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
        });

        const tick = async () => {
          if (!videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length > 0) {
              const raw = String(codes[0].rawValue || '').trim();
              if (raw) {
                onDetected(raw.toUpperCase());
                stop();
                return;
              }
            }
          } catch {}
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      });
    } catch (err: any) {
      toast.error('Não consegui abrir a câmera. Verifique a permissão.');
    }
  };

  useEffect(() => () => stop(), []);

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={
          className ||
          'rounded-lg border border-border bg-background p-2 text-foreground hover:bg-muted'
        }
        title="Escanear QR"
      >
        <Camera className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <div className="flex items-center justify-between p-3 text-white">
            <p className="text-sm font-medium">Aponte para o QR da pulseira</p>
            <button onClick={stop} className="p-2 rounded-lg bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-4 border-primary rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
