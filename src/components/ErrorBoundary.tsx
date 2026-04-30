/**
 * ErrorBoundary – Globaler Fehler-Fallback
 *
 * Fängt unerwartete Render-Fehler ab und zeigt eine benutzerfreundliche
 * Fehlerseite statt einer leeren/weißen Seite.
 *
 * Sicherheit: In Produktion wird keine technische Fehlermeldung angezeigt
 * (kein Stack Trace für Angreifer sichtbar).
 */
import React, { Component, type ErrorInfo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      // Fehlermeldung nur im Entwicklungsmodus anzeigen
      errorMessage: import.meta.env.DEV ? error.message : null,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In Produktion: nur in Konsole loggen, nicht im UI anzeigen
    console.error("[ErrorBoundary] Unerwarteter Fehler:", error, info);
  }

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full rounded-xl border bg-card p-8 shadow-lg text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" aria-hidden />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Etwas ist schiefgelaufen
            </h2>
            <p className="text-sm text-muted-foreground">
              Ein unerwarteter Fehler ist aufgetreten. Bitte laden Sie die Seite neu.
            </p>
          </div>
          {/* Technische Details nur im Dev-Modus */}
          {this.state.errorMessage && (
            <pre className="text-xs text-left bg-muted rounded-lg p-3 overflow-auto max-h-32 text-muted-foreground">
              {this.state.errorMessage}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="w-4 h-4" aria-hidden />
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }
}
