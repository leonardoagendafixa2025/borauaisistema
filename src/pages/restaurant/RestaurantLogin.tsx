import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShoppingBag, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function RestaurantLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'signup') {
      const { error } = await signUp(email, password, fullName);
      setLoading(false);
      if (error) {
        toast({ title: 'Erro no cadastro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Conta criada!', description: 'Verifique seu e-mail para confirmar o cadastro.' });
        setMode('login');
      }
      return;
    }

    const { error, roles } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao entrar', description: 'E-mail ou senha incorretos.', variant: 'destructive' });
    } else {
      const hasRestaurant = roles.some(r => r.restaurant_id);
      if (hasRestaurant) {
        navigate('/restaurant');
      } else {
        toast({ title: 'Sem restaurante', description: 'Sua conta não está vinculada a nenhum restaurante.', variant: 'destructive' });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-reveal-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 mb-4">
            <ShoppingBag className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Painel do Restaurante</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login' ? 'Acesse o painel de gestão do seu restaurante' : 'Crie sua conta para começar'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated p-6 space-y-4" autoComplete="on">
          {mode === 'signup' && (
            <div>
              <label htmlFor="rest-fullname" className="block text-sm font-medium mb-1.5">Nome completo</label>
              <input
                id="rest-fullname"
                name="name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
              />
            </div>
          )}
          <div>
            <label htmlFor="rest-email" className="block text-sm font-medium mb-1.5">E-mail</label>
            <input
              id="rest-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@seurestaurante.com.br"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
            />
          </div>
          <div>
            <label htmlFor="rest-password" className="block text-sm font-medium mb-1.5">Senha</label>
            <div className="relative">
              <input
                id="rest-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            {mode === 'login' ? (
              <>
                Não tem conta?{' '}
                <button type="button" onClick={() => setMode('signup')} className="text-primary hover:text-primary/80 font-medium">
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button type="button" onClick={() => setMode('login')} className="text-primary hover:text-primary/80 font-medium">
                  Fazer login
                </button>
              </>
            )}
          </p>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <Link to="/" className="font-medium text-primary hover:text-primary/80">← Voltar ao site</Link>
        </p>
      </div>
    </div>
  );
}
