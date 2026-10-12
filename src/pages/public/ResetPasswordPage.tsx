import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logoImg from '@/assets/logo.png';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      try {
        // 1. Check if there's a code in search params (PKCE flow)
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            console.warn('[ResetPassword] Erro ao trocar code PKCE:', exchangeErr.message);
          }
        }

        // 2. Check if there's an active session or recovery session
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session?.user) {
            setSessionReady(true);
          } else {
            // Check hash fragment
            const hash = window.location.hash;
            if (hash.includes('type=recovery') || hash.includes('access_token')) {
              setSessionReady(true);
            } else {
              setErrorMessage('O link de recuperação é inválido, expirou ou já foi utilizado.');
            }
          }
          setVerifying(false);
        }
      } catch (err: any) {
        if (mounted) {
          setErrorMessage(err?.message || 'Falha ao validar link de recuperação.');
          setVerifying(false);
        }
      }
    };

    // Listen to auth events (e.g. PASSWORD_RECOVERY)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (session?.user && event === 'SIGNED_IN')) {
        setSessionReady(true);
        setErrorMessage(null);
        setVerifying(false);
      }
    });

    void checkRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success('Senha atualizada com sucesso!');

      // Redirect based on user roles
      const userId = data.user?.id;
      if (userId) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role, restaurant_id')
          .eq('user_id', userId);

        const isMaster = (roles || []).some((r: any) =>
          ['super_admin', 'finance', 'support', 'commercial'].includes(r.role)
        );
        const hasRestaurant = (roles || []).some((r: any) => !!r.restaurant_id);

        if (isMaster) {
          navigate('/master', { replace: true });
          return;
        }
        if (hasRestaurant) {
          navigate('/restaurant', { replace: true });
          return;
        }
      }

      // Default fallback
      navigate('/restaurant/login', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao redefinir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Validando link de recuperação...</p>
        </div>
      </div>
    );
  }

  if (errorMessage && !sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm card-elevated p-6 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="font-heading text-lg font-bold">Link Expirado ou Inválido</h1>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <div className="pt-2 space-y-2">
            <Link
              to="/restaurant/login"
              className="w-full inline-flex justify-center items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
            >
              Solicitar nova recuperação
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-reveal-up">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <img src={logoImg} alt="Bora Uai" className="h-10 w-auto" />
          </Link>
          <h1 className="font-heading text-2xl font-bold">Criar Nova Senha</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina sua nova credencial de acesso segura
          </p>
        </div>

        <form onSubmit={handleReset} className="card-elevated p-6 space-y-4" autoComplete="off">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium mb-1.5">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
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

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium mb-1.5">
              Confirmar nova senha
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite novamente a nova senha"
              required
              minLength={6}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Salvar e acessar plataforma
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <Link to="/restaurant/login" className="font-medium text-primary hover:text-primary/80">
            ← Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
