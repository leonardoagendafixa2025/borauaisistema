import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/cliente';
  const initialMode = (searchParams.get('mode') as 'login' | 'register' | 'forgot') || 'login';
  const { signIn, signUp, resetPassword, user } = useCustomerAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(
    ['login', 'register', 'forgot'].includes(initialMode) ? initialMode : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect (back to checkout if a returnTo was provided)
  if (user) {
    navigate(returnTo, { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message);
    } else {
      toast.success('Login realizado!');
      navigate(returnTo);
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !name.trim()) return;
    if (password.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }
    setLoading(true);
    const { error } = await signUp(email, password, name);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Conta criada! Verifique seu email para confirmar.');
      setMode('login');
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Link de redefinição enviado para seu email');
      setMode('login');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>

        <div className="card-elevated p-6 rounded-2xl">
          <div className="text-center mb-6">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <User className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-heading font-bold text-xl">
              {mode === 'login' ? 'Entrar na sua conta' : mode === 'register' ? 'Criar conta' : 'Recuperar senha'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === 'login' ? 'Acesse seu histórico e endereços' : mode === 'register' ? 'Crie uma conta para salvar seus dados' : 'Enviaremos um link para seu email'}
            </p>
          </div>

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type={showPassword ? 'text' : 'password'} placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button type="button" onClick={() => setMode('forgot')} className="text-xs text-primary hover:underline">Esqueci minha senha</button>
              <button type="submit" disabled={loading}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50">
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} required
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type={showPassword ? 'text' : 'password'} placeholder="Senha (mín. 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50">
                {loading ? 'Criando...' : 'Criar conta'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="email" placeholder="Seu email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50">
                {loading ? 'Enviando...' : 'Enviar link'}
              </button>
            </form>
          )}

          <div className="mt-4 text-center text-sm">
            {mode === 'login' ? (
              <p className="text-muted-foreground">Não tem conta? <button onClick={() => setMode('register')} className="text-primary font-medium hover:underline">Criar conta</button></p>
            ) : (
              <p className="text-muted-foreground">Já tem conta? <button onClick={() => setMode('login')} className="text-primary font-medium hover:underline">Entrar</button></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
