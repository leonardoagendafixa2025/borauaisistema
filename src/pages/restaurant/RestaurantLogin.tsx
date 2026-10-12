import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Store, Loader2, ArrowLeft, Mail, KeyRound, Sparkles, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import logoImg from '@/assets/logo.png';

export default function RestaurantLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [forgotSent, setForgotSent] = useState(false);
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error, roles } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    const hasRestaurant = roles.some((r) => r.restaurant_id);
    if (hasRestaurant) {
      // Check if user is attendant (waiter) or kitchen
      const userRole = roles.find((r) => r.restaurant_id)?.role;
      if (userRole === 'attendant') {
        navigate('/garcom');
      } else if (userRole === 'kitchen') {
        navigate('/restaurant/kitchen');
      } else {
        navigate('/restaurant');
      }
    } else {
      toast({
        title: 'Sem restaurante vinculado',
        description: 'Sua conta não possui um restaurante ativo. Conclua o cadastro da sua loja.',
        variant: 'destructive',
      });
      navigate('/cadastro');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);

    if (error) {
      toast({
        title: 'Erro na recuperação',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setForgotSent(true);
      toast({
        title: 'E-mail enviado!',
        description: 'Enviamos o link de redefinição para o seu e-mail. Verifique a caixa de entrada e o spam.',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm animate-reveal-up">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <img src={logoImg} alt="Bora Uai" className="h-14 w-14 rounded-2xl object-contain shadow-md shadow-black/15 mx-auto" />
          </Link>
          <h1 className="font-heading text-2xl font-bold">
            {mode === 'login' ? 'Painel do Restaurante' : 'Recuperar Acesso'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login'
              ? 'Acesse a gestão do seu estabelecimento'
              : 'Informe seu e-mail cadastrado para redefinir a senha'}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="card-elevated p-6 space-y-4" autoComplete="on">
            <div>
              <label htmlFor="rest-email" className="block text-sm font-medium mb-1.5">
                E-mail
              </label>
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
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="rest-password" className="block text-sm font-medium">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setForgotSent(false);
                  }}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <input
                  id="rest-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar no Painel
            </button>

            <div className="pt-2 border-t border-border/60 text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Ainda não tem o Bora Uai no seu estabelecimento?
              </p>
              <Link
                to="/cadastro"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary px-3 py-2 text-xs font-semibold transition-all"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Cadastrar restaurante (14 dias grátis)
              </Link>
            </div>
          </form>
        ) : (
          <div className="card-elevated p-6 space-y-4">
            {forgotSent ? (
              <div className="text-center space-y-3 py-2">
                <div className="h-12 w-12 rounded-2xl bg-success/10 text-success flex items-center justify-center mx-auto">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h2 className="font-heading font-bold text-base">Verifique seu e-mail</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enviamos as instruções para <strong>{email}</strong>. Clique no link recebido para criar uma nova senha.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotSent(false);
                  }}
                  className="w-full rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all mt-2"
                >
                  Voltar para o login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium mb-1.5">
                    E-mail da sua conta
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@seurestaurante.com.br"
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar link de recuperação
                </button>

                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao formulário de login
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mt-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            É garçom ou atendente?{' '}
            <Link to="/garcom/login" className="font-medium text-primary hover:underline">
              Acesse o App do Garçom
            </Link>
          </p>
          <p>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Voltar ao site
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
