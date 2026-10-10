import { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { toast } from 'sonner';

interface InstallPWAButtonProps {
  variant?: 'cliente' | 'garcom';
  manifestHref?: string;
  label?: string;
  className?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Botão persistente para instalar o PWA. Útil no rodapé/menu, para dar
 * uma segunda chance ao usuário que fechou o banner de instalação.
 * - Android/Chrome: dispara o prompt nativo.
 * - iOS: abre um diálogo com instruções (Compartilhar → Adicionar à Tela).
 * - Já instalado: não renderiza nada.
 */
export default function InstallPWAButton({
  variant = 'cliente',
  manifestHref,
  label = 'Baixar App (.apk)',
  className,
  buttonVariant = 'outline',
  size = 'sm',
}: InstallPWAButtonProps) {
  const { isStandalone, isIOS } = usePWAInstall(manifestHref);
  const [iosOpen, setIosOpen] = useState(false);

  if (isStandalone) return null;

  const handleClick = async () => {
    if (isIOS) {
      setIosOpen(true);
      return;
    }
    const a = document.createElement('a');
    a.href = '/borauai.apk';
    a.download = 'borauai.apk';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Iniciando download do aplicativo Android (.apk)...');
  };

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={size}
        onClick={handleClick}
        className={className}
      >
        <Download className="w-4 h-4 mr-2" />
        {label}
      </Button>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Instalar no iPhone / iPad
            </DialogTitle>
            <DialogDescription>
              Para instalar o app na tela de início:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm text-foreground mt-2">
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
              <span>Toque no botão <strong>Compartilhar</strong> na barra do Safari (ícone de seta para cima).</span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
              <span>Role e toque em <strong>Adicionar à Tela de Início</strong>.</span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
              <span>Confirme em <strong>Adicionar</strong> no canto superior direito.</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
