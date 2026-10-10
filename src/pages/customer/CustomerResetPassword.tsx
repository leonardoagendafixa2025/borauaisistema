import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function CustomerResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    if (password !== confirm) { toast.error('As senhas não coincidem'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Senha atualizada com sucesso!');
      navigate('/cliente');
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Link inválido ou expirado.</p>
          <Link to="/cliente/login" className="text-primary hover:underline text-sm">Voltar para login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Link to="/cliente/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
        <div className="card-elevated p-6 rounded-2xl">
          <h1 className="font-heading font-bold text-xl text-center mb-6">Nova senha</h1>
          <form onSubmit={handleReset} className="space-y-3">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type={showPassword ? 'text' : 'password'} placeholder="Nova senha" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="w-full rounded-xl border border-border bg-background pl-10 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type={showPassword ? 'text' : 'password'} placeholder="Confirmar senha" value={confirm} onChange={e => setConfirm(e.target.value)} required
                className="w-full rounded-xl border border-border bg-background pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-ring/20 focus:border-primary outline-none transition-all" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
