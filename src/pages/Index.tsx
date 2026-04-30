import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
const loginSchema = z.object({
  email: z.string().trim().email({ message: "Ungültige E-Mail-Adresse" }),
  password: z.string().min(6, { message: "Passwort muss mindestens 6 Zeichen haben" }),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, { message: "Name muss mindestens 2 Zeichen haben" }).max(100, { message: "Name darf maximal 100 Zeichen haben" }),
});

const passwordSchema = z.object({
  password: z.string().min(6, { message: "Passwort muss mindestens 6 Zeichen haben" }),
  confirmPassword: z.string().min(6, { message: "Passwort muss mindestens 6 Zeichen haben" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirmPassword"],
});

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isPasswordReset = searchParams.get("reset") === "true";
  
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, roles } = useAuth();
  const navigate = useNavigate();

  // Redirect based on user role when logged in (but not during password reset)
  useEffect(() => {
    if (user && roles.length > 0 && !isPasswordReset) {
      if (roles.includes("super_admin")) {
        navigate("/accounting");
      } else if (roles.includes("accounting")) {
        navigate("/accounting");
      } else if (roles.includes("owner")) {
        navigate("/owner");
      } else if (roles.includes("ober_montageleiter")) {
        navigate("/ober-montageleiter");
      } else if (roles.includes("installation_manager")) {
        navigate("/installation-manager");
      } else if (roles.includes("employee")) {
        navigate("/employee");
      }
    }
  }, [user, roles, navigate, isPasswordReset]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = passwordSchema.safeParse({ password, confirmPassword });
      if (!validation.success) {
        toast.error("Validierungsfehler", {
          description: validation.error.errors[0].message,
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast.error("Fehler", {
          description: error.message,
        });
      } else {
        toast.success("Passwort geändert", {
          description: "Ihr Passwort wurde erfolgreich geändert.",
        });
        // Remove reset param and redirect
        setSearchParams({});
        setPassword("");
        setConfirmPassword("");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = z.string().email({ message: "Ungültige E-Mail-Adresse" }).safeParse(email.trim());
      if (!validation.success) {
        toast.error("Validierungsfehler", {
          description: validation.error.errors[0].message,
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/?reset=true`,
      });

      if (error) {
        toast.error("Fehler", {
          description: error.message,
        });
      } else {
        toast.success("E-Mail gesendet", {
          description: "Falls ein Konto mit dieser E-Mail existiert, erhalten Sie einen Link zum Zurücksetzen des Passworts.",
        });
        setIsForgotPassword(false);
        setEmail("");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          toast.error("Validierungsfehler", {
            description: validation.error.errors[0].message,
          });
          setLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          toast.error("Login fehlgeschlagen", {
            description: error.message,
          });
        }
      } else {
        const validation = signupSchema.safeParse({ email, password, fullName });
        if (!validation.success) {
          toast.error("Validierungsfehler", {
            description: validation.error.errors[0].message,
          });
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("Konto existiert bereits", {
              description: "Diese E-Mail ist bereits registriert. Bitte melden Sie sich an.",
            });
          } else {
            toast.error("Registrierung fehlgeschlagen", {
              description: error.message,
            });
          }
        } else {
          toast.success("Konto erstellt", {
            description: "Ihr Konto wurde erfolgreich erstellt. Bitte melden Sie sich an.",
          });
          setIsLogin(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary/90 p-4 safe-top safe-bottom">
      {/* Logo and Title */}
      <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <img 
          src="/pwa-192x192.png" 
          alt="Werkey Logo" 
          className="w-20 h-20 mx-auto rounded-2xl shadow-lg mb-4"
        />
        <h1 className="text-4xl font-bold text-primary-foreground tracking-tight">
          Werkey
        </h1>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-150">
        <CardHeader>
          <CardTitle>
            {isPasswordReset
              ? "Neues Passwort festlegen"
              : isForgotPassword 
                ? "Passwort zurücksetzen" 
                : isLogin 
                  ? "Anmelden" 
                  : "Registrieren"}
          </CardTitle>
          <CardDescription>
            {isPasswordReset
              ? "Geben Sie Ihr neues Passwort ein"
              : isForgotPassword
                ? "Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen zu erhalten"
                : isLogin
                  ? "Geben Sie Ihre Anmeldedaten ein"
                  : "Füllen Sie Ihre Daten aus, um ein neues Konto zu erstellen"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPasswordReset ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Neues Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Bitte warten..." : "Passwort ändern"}
              </Button>
            </form>
          ) : isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sie@beispiel.de"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Bitte warten..." : "Link senden"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setEmail("");
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Zurück zur Anmeldung
                </button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Vollständiger Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Max Mustermann"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sie@beispiel.de"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Bitte warten..." : isLogin ? "Anmelden" : "Registrieren"}
                </Button>
              </form>
              
              {isLogin && (
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-sm text-muted-foreground hover:text-primary hover:underline"
                  >
                    Passwort vergessen?
                  </button>
                </div>
              )}
              
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-primary hover:underline"
                >
                  {isLogin
                    ? "Noch kein Konto? Registrieren"
                    : "Bereits ein Konto? Anmelden"}
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-center text-sm text-primary-foreground/60 mt-8">
        © 2025 Werkey. Professionelles Projektmanagement für Handwerksbetriebe.
      </p>
    </div>
  );
};

export default Index;
