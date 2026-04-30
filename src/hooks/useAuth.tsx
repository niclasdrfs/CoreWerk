/**
 * useAuth – Authentifizierungskontext
 *
 * Aufgaben:
 * - Verwaltet Session, User und Rollen über Supabase Auth.
 * - Rollen werden einmalig nach Login geladen und gecacht (kein Doppel-Fetch).
 * - signOut setzt State sofort zurück (keine Race Conditions).
 *
 * Sicherheit:
 * - Rollen werden server-seitig per RLS durchgesetzt – dieser Client-State
 *   dient nur der UI-Steuerung, nie der eigentlichen Zugriffskontrolle.
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

// ── Typen ─────────────────────────────────────────────────────────────────────
export type AppRole =
  | "super_admin"
  | "accounting"
  | "owner"
  | "installation_manager"
  | "ober_montageleiter"
  | "employee";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Hilfsfunktion ─────────────────────────────────────────────────────────────
async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("[Auth] Rollen konnten nicht geladen werden:", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.role as AppRole);
}

// ── Provider ──────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Verhindert doppelten Rollen-Fetch nach onAuthStateChange + getSession
  const rolesFetchedFor = useRef<string | null>(null);

  const loadRoles = (userId: string) => {
    if (rolesFetchedFor.current === userId) return; // bereits geladen
    rolesFetchedFor.current = userId;
    fetchUserRoles(userId).then(setRoles);
  };

  useEffect(() => {
    // 1. Auth-State-Listener registrieren
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setRoles([]);
        rolesFetchedFor.current = null;
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Defer mit setTimeout vermeidet Deadlocks mit Supabase-internalem State
        setTimeout(() => loadRoles(session.user.id), 0);
      } else {
        setRoles([]);
        rolesFetchedFor.current = null;
      }
      setLoading(false);
    });

    // 2. Bestehende Session prüfen
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session.user);
      setTimeout(() => loadRoles(session.user.id), 0);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Aktionen ───────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    return { error: error ?? null };
  };

  const signOut = async () => {
    // State sofort zurücksetzen – verhindert kurzes Aufblitzen von geschützten Inhalten
    setUser(null);
    setSession(null);
    setRoles([]);
    rolesFetchedFor.current = null;
    await supabase.auth.signOut();
    navigate("/");
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, signIn, signUp, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden.");
  return context;
};
