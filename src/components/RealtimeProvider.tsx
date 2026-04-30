import { useRealtimeSubscriptions } from "@/hooks/useRealtimeSubscriptions";

interface RealtimeProviderProps {
  children: React.ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  // Aktiviert Realtime-Subscriptions für alle wichtigen Tabellen
  useRealtimeSubscriptions();

  return <>{children}</>;
}
