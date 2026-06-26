import { useState, useEffect, createContext, useContext, useCallback } from "react";
import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isRecovery: boolean;
  clearRecovery: () => void;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  const clearRecovery = useCallback(() => setIsRecovery(false), []);

  useEffect(() => {
    if (user) {
      Sentry.setUser({ id: user.id, email: user.email ?? undefined });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  useEffect(() => {
    // Check if current URL indicates recovery ONLY on the reset page
    const hash = window.location.hash;
    const isResetPage = window.location.pathname.includes("/auth/reset");
    if (isResetPage && hash && hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Normal login or token refresh — clear recovery state
        setIsRecovery(false);
      } else if (event === "SIGNED_OUT") {
        setIsRecovery(false);
      }
      setSession(prev => {
        if (prev?.access_token === session?.access_token) return prev;
        return session;
      });
      setUser(prev => {
        const next = session?.user ?? null;
        if (prev?.id === next?.id) return prev;
        return next;
      });
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(prev => {
        if (prev?.access_token === session?.access_token) return prev;
        return session;
      });
      setUser(prev => {
        const next = session?.user ?? null;
        if (prev?.id === next?.id) return prev;
        return next;
      });
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setIsRecovery(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isRecovery, clearRecovery, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
