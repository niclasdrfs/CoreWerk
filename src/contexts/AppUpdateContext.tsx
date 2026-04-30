import { createContext, useContext, ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

interface AppUpdateContextType {
  needRefresh: boolean;
  updateApp: () => Promise<void>;
}

const AppUpdateContext = createContext<AppUpdateContextType>({
  needRefresh: false,
  updateApp: async () => {},
});

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update();
          }
        });
      }
    },
  });

  const updateApp = async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => window.location.reload(),
        { once: true }
      );
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  };

  return (
    <AppUpdateContext.Provider value={{ needRefresh, updateApp }}>
      {children}
    </AppUpdateContext.Provider>
  );
}

export function useAppUpdate() {
  return useContext(AppUpdateContext);
}
