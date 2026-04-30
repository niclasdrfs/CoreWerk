import { RefreshCw } from "lucide-react";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UpdateBanner() {
  const { needRefresh, updateApp } = useAppUpdate();

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 py-2 px-4 text-sm font-medium safe-top",
        "bg-primary text-primary-foreground"
      )}
    >
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span>Neue Version verfügbar</span>
      <Button
        size="sm"
        variant="secondary"
        onClick={updateApp}
        className="h-7 px-3 text-xs"
      >
        Jetzt aktualisieren
      </Button>
    </div>
  );
}
