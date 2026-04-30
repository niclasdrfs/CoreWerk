/**
 * PageLoader – Globaler Lade-Indikator für Lazy-geladene Seiten.
 * Wird als Suspense-Fallback in App.tsx verwendet.
 */
import { Loader2 } from "lucide-react";

export const PageLoader = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
    <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
    <p className="text-sm text-muted-foreground animate-pulse">Seite wird geladen…</p>
  </div>
);
