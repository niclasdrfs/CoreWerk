/**
 * ProtectedRoute – Zugriffsschutz für Routen
 *
 * Verhalten:
 * - Nicht eingeloggt → Weiterleitung zur Login-Seite (/)
 * - Eingeloggt, aber falsche Rolle → Fehlermeldung mit Zurück-Button
 * - Während Auth lädt → zentrierter Ladeindikator
 *
 * Sicherheitshinweis:
 * Die Rollprüfung hier ist eine UI-Maßnahme für bessere UX.
 * Die eigentliche Zugriffskontrolle erfolgt serverseitig über Supabase RLS.
 */
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldX, ArrowLeft } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, loading, hasRole } = useAuth();

  // Auth wird noch geprüft
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Anmeldung wird geprüft…</p>
        </div>
      </div>
    );
  }

  // Nicht eingeloggt → zur Login-Seite
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Falsche Rolle → Zugriff verweigert
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-7 h-7 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">Zugriff verweigert</h1>
            <p className="text-sm text-muted-foreground">
              Sie haben keine Berechtigung für diesen Bereich.
            </p>
          </div>
          <Button variant="outline" onClick={() => history.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
