import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, UtensilsCrossed, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function GarcomLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error, roles } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao entrar', description: 'E-mail ou senha incorretos.', variant: 'destructive' });
      return;
    }
    const hasRestaurant = roles.some((r) => r.restaurant_id);
    if (!hasRestaurant) {
      toast({
        title: 'Sem acesso',
        description: 'Sua conta não está vinculada a nenhum restaurante. Peça ao gerente para te cadastrar.',
        variant: 'destructive',
      });
      return;
    }
    navigate('/garcom');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background px-4 py-8">
      <div className="w-full max-w-sm animate-reveal-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary text-primary-foreground shadow-lg mb-4">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
          <h1 className="font-heading text-2xl font-bold">App do Garçom</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Entre com sua conta para abrir comandas e enviar pedidos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated p-6 space-y-4" autoComplete="on">
          <div>
            <label htmlFor="garcom-email" className="block text-sm font-medium mb-1.5">E-mail</label>
            <input
              id="garcom-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="garcom@restaurante.com.br"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
            />
          </div>
          <div>
            <label htmlFor="garcom-password" className="block text-sm font-medium mb-1.5">Senha</label>
            <div className="relative">
              <input
                id="garcom-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar no App
          </button>
          <p className="text-center text-xs text-muted-foreground">
            As contas de garçom são criadas pelo gerente no painel do restaurante.
          </p>
        </form>

        <div className="mt-4 text-center">
          <a
            href="/borauai.apk"
            download="borauai.apk"
            className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-3.5 py-2 rounded-xl transition-all"
          >
            <Download className="h-4 w-4" /> Baixar aplicativo Android (.apk)
          </a>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4 space-x-3">
          <Link to="/restaurant/login" className="font-medium text-primary hover:text-primary/80">Sou gerente</Link>
          <span>·</span>
          <Link to="/" className="font-medium hover:text-foreground">← Voltar</Link>
        </p>
      </div>
    </div>
  );
}
