import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type PushPermissionState = "prompt" | "granted" | "denied" | "unsupported";

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permissionState, setPermissionState] = useState<PushPermissionState>("prompt");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  // Check if push notifications are supported
  const isSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  // URL-safe base64 to Uint8Array conversion
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Fetch VAPID public key from backend
  useEffect(() => {
    const fetchVapidKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-vapid-key");
        if (error) {
          console.error("Error fetching VAPID key:", error);
          return;
        }
        if (data?.publicKey) {
          setVapidPublicKey(data.publicKey);
        }
      } catch (error) {
        console.error("Failed to fetch VAPID key:", error);
      }
    };

    if (isSupported) {
      fetchVapidKey();
    }
  }, [isSupported]);

  // Check current permission state
  const checkPermission = useCallback(async () => {
    if (!isSupported) {
      setPermissionState("unsupported");
      return;
    }

    const permission = Notification.permission;
    setPermissionState(permission as PushPermissionState);

    // Check if user has an existing subscription in the database
    if (user && permission === "granted") {
      try {
        const registration = await navigator.serviceWorker.ready;
        // @ts-ignore - pushManager exists on ServiceWorkerRegistration in Push API
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          // Verify subscription exists in database
          const { data } = await supabase
            .from("push_subscriptions")
            .select("id")
            .eq("user_id", user.id)
            .eq("endpoint", subscription.endpoint)
            .single();
          
          setIsSubscribed(!!data);
        } else {
          setIsSubscribed(false);
        }
      } catch (error) {
        console.error("Error checking subscription:", error);
        setIsSubscribed(false);
      }
    }
  }, [isSupported, user]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Subscribe to push notifications
  const subscribe = async (): Promise<boolean> => {
    if (!isSupported || !user) {
      toast.error("Push-Benachrichtigungen werden nicht unterstützt");
      return false;
    }

    if (!vapidPublicKey) {
      console.error("VAPID public key not available");
      toast.error("Push-Konfiguration fehlt");
      return false;
    }

    setIsLoading(true);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermissionState(permission as PushPermissionState);

      if (permission !== "granted") {
        toast.error("Benachrichtigungen wurden abgelehnt");
        setIsLoading(false);
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      console.log("Service worker ready");

      // Check for existing subscription
      // @ts-ignore - pushManager exists on ServiceWorkerRegistration in Push API
      let subscription = await registration.pushManager.getSubscription();

      // If no subscription exists, create one
      if (!subscription) {
        console.log("Creating new push subscription...");
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        // @ts-ignore - pushManager exists on ServiceWorkerRegistration in Push API
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });
        console.log("Push subscription created");
      }

      // Extract keys
      const p256dhKey = subscription.getKey("p256dh");
      const authKey = subscription.getKey("auth");

      if (!p256dhKey || !authKey) {
        throw new Error("Failed to get subscription keys");
      }

      // Convert to base64
      const p256dh = btoa(String.fromCharCode(...Array.from(new Uint8Array(p256dhKey))));
      const auth = btoa(String.fromCharCode(...Array.from(new Uint8Array(authKey))));

      // Save subscription to database (upsert)
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,endpoint",
          }
        );

      if (error) {
        throw error;
      }

      setIsSubscribed(true);
      toast.success("Push-Benachrichtigungen aktiviert!");
      console.log("Push subscription saved to database");
      return true;
    } catch (error: any) {
      console.error("Error subscribing to push:", error);
      toast.error("Fehler beim Aktivieren der Benachrichtigungen");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Unsubscribe from push notifications
  const unsubscribe = async (): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      // @ts-ignore - pushManager exists on ServiceWorkerRegistration in Push API
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      // Remove all subscriptions for this user (in case of stale entries)
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id);

      setIsSubscribed(false);
      toast.success("Push-Benachrichtigungen deaktiviert");
      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Fehler beim Deaktivieren");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    permissionState,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    checkPermission,
  };
};
