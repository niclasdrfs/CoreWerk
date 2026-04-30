/**
 * Supabase Client – Singleton-Instanz
 *
 * Sicherheit & Performance:
 * - Env-Variablen werden zur Build-Zeit validiert.
 * - Auth-Tokens werden im sessionStorage gespeichert (kein dauerhafter XSS-Zugriff aus localStorage).
 * - autoRefreshToken verlängert die Session transparent.
 * - Realtime-Reconnect mit exponentiellem Backoff (max. 30 s).
 *
 * Import:
 *   import { supabase } from "@/integrations/supabase/client";
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// ── Umgebungsvariablen validieren ─────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "[Supabase] VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY müssen gesetzt sein."
  );
}

// ── Client ────────────────────────────────────────────────────────────────────
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    /**
     * SICHERHEIT: sessionStorage statt localStorage.
     * Tokens sind nach Tab-Schließen weg → reduziert XSS-Angriffsfläche deutlich.
     */
    storage: sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    // Heartbeat alle 30 s, Reconnect mit exponentiellem Backoff (max. 30 s)
    heartbeatIntervalMs: 30_000,
    reconnectAfterMs: (tries) => Math.min(1_000 * 2 ** tries, 30_000),
  },
});