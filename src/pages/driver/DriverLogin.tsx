import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function DriverLogin() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    const stored = localStorage.getItem('driver_session');
    if (stored) navigate('/entregador/app', { replace: true });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || pin.length !== 6) {
      toast.error('Informe o código do restaurante e o PIN de 6 dígitos');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('driver_login', {
      _restaurant_slug: slug.trim().toLowerCase(),
      _pin: pin,
    });
    setLoading(false);
    if (error || !data || data.length === 0) {
      toast.error('Código ou PIN inválido');
      return;
    }
    const session = { ...data[0], pin };
    localStorage.setItem('driver_session', JSON.stringify(session));
    toast.success(`Olá, ${session.driver_name}!`);
    navigate('/entregador/app', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg">
            <Truck className="h-8 w-8" />
          </div>
          <h1 className="font-heading text-3xl font-bold">App do Entregador</h1>
          <p className="text-sm text-muted-foreground mt-1">Entre com o PIN fornecido pelo seu restaurante</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <Label htmlFor="slug">Código do restaurante</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ex: boteco-do-ze"
              autoCapitalize="off"
              autoCorrect="off"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pin" className="flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5" /> PIN (6 dígitos)
            </Label>
            <Input
              id="pin"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="mt-1 text-center text-2xl tracking-[0.5em] font-mono"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Entrar
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Não tem PIN? Peça ao gerente do restaurante.
        </p>
      </div>
    </div>
  );
}
