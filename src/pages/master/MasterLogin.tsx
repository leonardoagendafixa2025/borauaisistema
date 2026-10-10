import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function MasterLogin() {
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
    } else {
      const isMaster = roles.some(r => ['super_admin', 'finance', 'support', 'commercial'].includes(r.role));
      if (isMaster) {
        navigate('/master');
      } else {
        toast({ title: 'Acesso negado', description: 'Você não tem permissão de administrador.', variant: 'destructive' });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-reveal-up">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-heading font-bold">MF</span>
            </div>
          </Link>
          <h1 className="font-heading text-2xl font-bold">Painel Master</h1>
          <p className="text-sm text-muted-foreground mt-1">Acesse o painel administrativo da plataforma</p>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated p-6 space-y-4" autoComplete="on">
          <div>
            <label htmlFor="master-email" className="block text-sm font-medium mb-1.5">E-mail</label>
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
            <label htmlFor="master-password" className="block text-sm font-medium mb-1.5">Senha</label>
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
            Entrar
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          É dono de restaurante?{' '}
          <Link to="/restaurant/login" className="font-medium text-primary hover:text-primary/80">Acesse aqui</Link>
        </p>
      </div>
    </div>
  );
}
