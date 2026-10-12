import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import logoImg from '@/assets/logo.png';

export default function MasterLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [forgotSent, setForgotSent] = useState(false);
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error, roles } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message,
        variant: 'destructive',
      });
    } else {
      const isMaster = roles.some((r) =>
        ['super_admin', 'finance', 'support', 'commercial'].includes(r.role)
      );
      if (isMaster) {
        navigate('/master');
      } else {
        toast({
          title: 'Acesso negado',
          description: 'Sua conta não possui permissão de administrador da plataforma.',
          variant: 'destructive',
        });
      }
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
        description: 'Enviamos o link de redefinição para o e-mail administrativo informado.',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-reveal-up">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <img src={logoImg} alt="Bora Uai" className="h-14 w-14 rounded-2xl object-contain shadow-md shadow-black/15 mx-auto" />
          </Link>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Controle Central
          </div>
          <h1 className="font-heading text-2xl font-bold">Painel Master</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login'
              ? 'Acesse a administração central da plataforma'
              : 'Recupere sua senha de acesso administrativo'}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleSubmit} className="card-elevated p-6 space-y-4" autoComplete="on">
            <div>
              <label htmlFor="master-email" className="block text-sm font-medium mb-1.5">
                E-mail
              </label>
              <input
                id="master-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@borauai.com.br"
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="master-password" className="block text-sm font-medium">
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
                  id="master-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
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
              Entrar
            </button>
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
                  Enviamos o link de recuperação para <strong>{email}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotSent(false);
                  }}
                  className="w-full rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all mt-2"
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label htmlFor="master-forgot-email" className="block text-sm font-medium mb-1.5">
                    E-mail administrativo
                  </label>
                  <input
                    id="master-forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@borauai.com.br"
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
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-4">
          É dono de restaurante?{' '}
          <Link to="/restaurant/login" className="font-medium text-primary hover:text-primary/80">
            Acesse aqui
          </Link>
        </p>
      </div>
    </div>
  );
}
