import { WifiOff, Wifi } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();

  // Show nothing if always online
  if (isOnline && !wasOffline) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium transition-all duration-300",
        isOnline
          ? "bg-emerald-500 text-white"
          : "bg-destructive text-destructive-foreground"
      )}
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          <span>Verbindung wiederhergestellt</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Offline – Gespeicherte Daten werden angezeigt. Änderungen werden automatisch synchronisiert.</span>
        </>
      )}
    </div>
  );
}
