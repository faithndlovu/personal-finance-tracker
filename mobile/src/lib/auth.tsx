import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, initApi, setToken, setUnauthorizedHandler } from './api';
import type { User } from './types';

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, currency: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { void signOut(); });
    (async () => {
      const { token } = await initApi();
      if (token) {
        try { setUser((await api.me()).user); } catch (e: any) { if (e?.status === 401) await setToken(null); }
      }
      setLoading(false);
    })();
  }, [signOut]);

  const value = useMemo<AuthState>(() => ({
    user, loading, setUser, signOut,
    async signIn(email, password) {
      const r = await api.login({ email: email.trim(), password });
      await setToken(r.token);
      setUser(r.user);
    },
    async signUp(name, email, password, currency) {
      const r = await api.register({ name: name.trim(), email: email.trim(), password, currency });
      await setToken(r.token);
      setUser(r.user);
    },
  }), [user, loading, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
