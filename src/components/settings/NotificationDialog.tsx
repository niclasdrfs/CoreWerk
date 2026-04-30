import { Bell, BellOff, Loader2, AlertTriangle, CheckCircle2, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotificationDialog = ({ open, onOpenChange }: NotificationDialogProps) => {
  const {
    isSupported,
    permissionState,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  // Check if running as installed PWA
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || 
    (window.navigator as any).standalone === true;

  const renderContent = () => {
    // Not supported
    if (!isSupported) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-xl border border-destructive/20">
            <AlertTriangle className="w-6 h-6 text-destructive shrink-0" />
            <div>
              <p className="font-medium text-foreground">Nicht unterstützt</p>
              <p className="text-sm text-muted-foreground">
                Ihr Browser unterstützt keine Push-Benachrichtigungen.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // iOS not installed as PWA
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !isStandalone) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-accent/10 rounded-xl border border-accent/20">
            <Smartphone className="w-6 h-6 text-accent shrink-0" />
            <div>
              <p className="font-medium text-foreground">App installieren</p>
              <p className="text-sm text-muted-foreground">
                Für Push-Benachrichtigungen auf iOS muss die App zum Home-Bildschirm hinzugefügt werden.
              </p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-1">
              <li>Tippen Sie auf das Teilen-Symbol</li>
              <li>Wählen Sie "Zum Home-Bildschirm"</li>
              <li>Öffnen Sie die App vom Home-Bildschirm</li>
            </ol>
          </div>
        </div>
      );
    }

    // Permission denied
    if (permissionState === "denied") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-xl border border-destructive/20">
            <BellOff className="w-6 h-6 text-destructive shrink-0" />
            <div>
              <p className="font-medium text-foreground">Benachrichtigungen blockiert</p>
              <p className="text-sm text-muted-foreground">
                Sie haben Benachrichtigungen für diese Seite blockiert.
              </p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p>Um dies zu ändern:</p>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Öffnen Sie die Browser-Einstellungen</li>
              <li>Gehen Sie zu Website-Einstellungen</li>
              <li>Erlauben Sie Benachrichtigungen für diese Seite</li>
            </ol>
          </div>
        </div>
      );
    }

    // Subscribed state
    if (isSubscribed) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl border border-primary/20">
            <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
            <div>
              <p className="font-medium text-foreground">Benachrichtigungen aktiv</p>
              <p className="text-sm text-muted-foreground">
                Sie erhalten Push-Benachrichtigungen auf diesem Gerät.
              </p>
            </div>
          </div>
          <Button
            onClick={handleToggle}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <BellOff className="w-4 h-4 mr-2" />
            )}
            Benachrichtigungen deaktivieren
          </Button>
        </div>
      );
    }

    // Ready to subscribe
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border">
          <Bell className="w-6 h-6 text-primary shrink-0" />
          <div>
            <p className="font-medium text-foreground">Benachrichtigungen aktivieren</p>
            <p className="text-sm text-muted-foreground">
              Erhalten Sie Benachrichtigungen wenn Sie einer Baustelle zugeteilt werden.
            </p>
          </div>
        </div>
        <Button
          onClick={handleToggle}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Bell className="w-4 h-4 mr-2" />
          )}
          Push-Benachrichtigungen aktivieren
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Benachrichtigungen
          </DialogTitle>
          <DialogDescription>
            Verwalten Sie Ihre Push-Benachrichtigungen für dieses Gerät.
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};
