import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface CustomerProfile {
  id: string;
  customerId: string | null;
  name: string;
  email: string;
  phone: string | null;
}

export function useCustomerAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (u: User) => {
    // Get customer record linked to this user
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('user_id', u.id)
      .maybeSingle();

    setProfile({
      id: u.id,
      customerId: customer?.id || null,
      name: customer?.name || u.user_metadata?.full_name || '',
      email: u.email || '',
      phone: customer?.phone || u.user_metadata?.phone || null,
    });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => fetchProfile(s.user), 0);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/cliente/reset-password`,
    });
    return { error };
  };

  return { session, user, profile, loading, signIn, signUp, signOut, resetPassword, refetchProfile: () => user && fetchProfile(user) };
}
