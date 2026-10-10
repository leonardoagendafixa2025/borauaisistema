import { MessageCircle } from 'lucide-react';

/**
 * Floating support button — discreet, bottom-right, opens WhatsApp.
 */
export default function SupportFAB() {
  return (
    <a
      href="https://wa.me/5531991988796?text=Ol%C3%A1!%20Preciso%20de%20suporte%20no%20Bora%20Uai"
      target="_blank"
      rel="noopener"
      title="Suporte via WhatsApp"
      className="fixed bottom-4 right-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full bg-card/80 backdrop-blur ring-1 ring-border text-muted-foreground hover:text-primary hover:ring-primary/40 hover:bg-card transition-all shadow-sm hover:shadow-md print:hidden"
      aria-label="Suporte"
    >
      <MessageCircle className="h-4 w-4" />
    </a>
  );
}
