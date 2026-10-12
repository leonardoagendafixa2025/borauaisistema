import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type UserRole = { role: AppRole; restaurant_id: string | null };
const ROLE_FETCH_TIMEOUT_MS = 5000;
const ROLE_CACHE_MS = 30000;

export interface AvailableStore {
  id: string;
  name: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  roles: { role: AppRole; restaurant_id: string | null }[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; roles: { role: AppRole; restaurant_id: string | null }[] }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isMasterAdmin: boolean;
  restaurantId: string | null;
  availableStores: AvailableStore[];
  switchRestaurant: (storeId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [availableStores, setAvailableStores] = useState<AvailableStore[]>([]);
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('borauai_active_restaurant_id') || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const rolesRequestRef = useRef(0);
  const signInInProgressRef = useRef(false);
  const rolesRef = useRef<UserRole[]>([]);
  const rolesFetchedAtRef = useRef(0);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const rolesFetchRef = useRef<{ userId: string; promise: Promise<UserRole[]> } | null>(null);

  const clearRoles = useCallback(() => {
    rolesRequestRef.current += 1;
    rolesRef.current = [];
    rolesFetchedAtRef.current = 0;
    lastFetchedUserIdRef.current = null;
    rolesFetchRef.current = null;
    setRoles([]);
    setAvailableStores([]);
    try {
      localStorage.removeItem('borauai_active_restaurant_id');
    } catch {}
    setActiveRestaurantId(null);
    setRolesLoading(false);
  }, []);

  const fetchRoles = useCallback(async (userId: string, options?: { force?: boolean }) => {
    const now = Date.now();
    if (!options?.force && lastFetchedUserIdRef.current === userId && now - rolesFetchedAtRef.current < ROLE_CACHE_MS) {
      return rolesRef.current;
    }
    if (!options?.force && rolesFetchRef.current?.userId === userId) return rolesFetchRef.current.promise;

    const requestId = ++rolesRequestRef.current;
    const promise = (async (): Promise<UserRole[]> => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), ROLE_FETCH_TIMEOUT_MS);
      setRolesLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role, restaurant_id')
          .eq('user_id', userId)
          .abortSignal(controller.signal);

        if (requestId !== rolesRequestRef.current) return [];
        if (error) throw error;

        const result = (data || []) as UserRole[];
        rolesRef.current = result;
        rolesFetchedAtRef.current = Date.now();
        lastFetchedUserIdRef.current = userId;
        setRoles(result);

        // Fetch store names for multi-unit selection
        const storeIds = Array.from(new Set(result.map(r => r.restaurant_id).filter(Boolean))) as string[];
        if (storeIds.length > 0) {
          try {
            const { data: stores } = await supabase
              .from('restaurants')
              .select('id, name')
              .in('id', storeIds);
            setAvailableStores((stores || []) as AvailableStore[]);
          } catch {
            setAvailableStores(storeIds.map(id => ({ id, name: 'Restaurante' })));
          }
        } else {
          setAvailableStores([]);
        }

        return result;
      } catch (err: any) {
        const message = err?.name === 'AbortError' ? 'roles_timeout' : err?.message;
        console.warn('[useAuth] fetchRoles falhou:', message);
        if (requestId === rolesRequestRef.current) setRoles([]);
        return [];
      } finally {
        window.clearTimeout(timeout);
        if (rolesFetchRef.current?.promise === promise) rolesFetchRef.current = null;
        if (requestId === rolesRequestRef.current) setRolesLoading(false);
      }
    })();

    rolesFetchRef.current = { userId, promise };
    return promise;
  }, []);

  const syncSessionState = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      clearRoles();
      return [] as UserRole[];
    }

    return fetchRoles(nextSession.user.id);
  }, [clearRoles, fetchRoles]);

  useEffect(() => {
    let mounted = true;

    const initializeSession = async (nextSession: Session | null) => {
      if (!mounted) return;
      await syncSessionState(nextSession);
      if (mounted) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (signInInProgressRef.current) return;
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        return;
      }
      setLoading(true);
      void initializeSession(nextSession);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => initializeSession(session));

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncSessionState]);

  const signIn = async (email: string, password: string) => {
    signInInProgressRef.current = true;
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      setSession(data.session);
      setUser(data.user);
      const userRoles = await fetchRoles(data.user.id, { force: true });
      setLoading(false);
      signInInProgressRef.current = false;
      return { error: null as Error | null, roles: userRoles };
    }
    signInInProgressRef.current = false;
    return { error: error as Error | null, roles: [] as UserRole[] };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('borauai_active_restaurant_id');
    } catch {}
    setActiveRestaurantId(null);
    setAvailableStores([]);
    await supabase.auth.signOut();
  };

  const isMasterAdmin = roles.some(r => ['super_admin', 'finance', 'support', 'commercial'].includes(r.role));
  const availableStoreIds = availableStores.map(s => s.id);
  const effectiveRestaurantId = (activeRestaurantId && (availableStoreIds.includes(activeRestaurantId) || roles.some(r => r.restaurant_id === activeRestaurantId)))
    ? activeRestaurantId
    : (roles.find(r => r.restaurant_id)?.restaurant_id ?? null);

  const switchRestaurant = useCallback((storeId: string) => {
    setActiveRestaurantId(storeId);
    try {
      localStorage.setItem('borauai_active_restaurant_id', storeId);
    } catch {}
    window.location.reload();
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      roles,
      loading: loading || rolesLoading,
      signIn,
      signUp,
      resetPassword,
      signOut,
      isMasterAdmin,
      restaurantId: effectiveRestaurantId,
      availableStores,
      switchRestaurant,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
