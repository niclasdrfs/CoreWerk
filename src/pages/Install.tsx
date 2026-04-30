import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Check, ArrowLeft, Share } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for successful install
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="self-start mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Zurück
      </Button>

      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Werkey installieren</CardTitle>
            <CardDescription>
              Installiere Werkey auf deinem Gerät für schnellen Zugriff
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {isInstalled ? (
              <div className="text-center space-y-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-muted-foreground">
                  Werkey ist bereits auf deinem Gerät installiert!
                </p>
                <Button onClick={() => navigate("/")} className="w-full">
                  Zur App
                </Button>
              </div>
            ) : isIOS ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Auf iOS, folge diesen Schritten:
                </p>
                <ol className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      1
                    </span>
                    <span>
                      Tippe auf das <Share className="inline h-4 w-4 mx-1" /> Teilen-Symbol in der Safari-Leiste
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      2
                    </span>
                    <span>Scrolle nach unten und tippe auf "Zum Home-Bildschirm"</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      3
                    </span>
                    <span>Tippe auf "Hinzufügen"</span>
                  </li>
                </ol>
              </div>
            ) : deferredPrompt ? (
              <div className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Schneller Zugriff vom Startbildschirm
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Funktioniert auch offline
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Automatische Updates
                  </li>
                </ul>
                <Button onClick={handleInstallClick} className="w-full" size="lg">
                  <Download className="h-5 w-5 mr-2" />
                  Jetzt installieren
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Um die App zu installieren:
                </p>
                <ol className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      1
                    </span>
                    <span>Öffne das Browser-Menü (drei Punkte)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      2
                    </span>
                    <span>Wähle "App installieren" oder "Zum Startbildschirm hinzufügen"</span>
                  </li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Install;
