/**
 * Einstiegspunkt der Werkey-App
 *
 * Stack:
 * - React 18 mit StrictMode (erkennt Side-Effect-Bugs früh)
 * - TanStack Query mit IndexedDB-Persistenz (Offline-First)
 * - next-themes für System-Dark-Mode
 *
 * Performance für 1.000 gleichzeitige Nutzer:
 * - staleTime: 5 min  → Queries werden nicht bei jedem Focus neu geladen
 * - gcTime: 7 Tage    → Offline-Daten bleiben im Speicher
 * - retry: 2          → Kurzzeitige Netzwerkfehler werden automatisch wiederholt
 * - refetchOnWindowFocus: false → Kein unnötiges Laden beim Tab-Wechsel
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { onlineManager } from "@tanstack/react-query";
import { createIDBPersister } from "./lib/queryPersister";
import App from "./App.tsx";
import "./index.css";

// ── Online-Status an TanStack Query weitergeben ───────────────────────────────
onlineManager.setEventListener((setOnline) => {
  const onOnline = () => setOnline(true);
  const onOffline = () => setOnline(false);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
});

// ── QueryClient ───────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1_000 * 60 * 5,           // 5 Minuten
      gcTime: 1_000 * 60 * 60 * 24 * 7,   // 7 Tage (für Offline-Persistenz)
      refetchOnWindowFocus: false,          // Kein unnötiges Refetch beim Tab-Wechsel
      refetchOnReconnect: true,             // Daten nach Reconnect auffrischen
      retry: 2,                             // 2 Wiederholungsversuche bei Fehler
      networkMode: "offlineFirst",          // Cache-first → schnelle UI, kein Ladeflimmern
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: 3,                             // Mutationen häufiger wiederholen (wichtiger)
    },
  },
});

// ── IndexedDB-Persistenz ──────────────────────────────────────────────────────
const persister = createIDBPersister();

// ── Render ────────────────────────────────────────────────────────────────────
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("[App] Root-Element #root nicht gefunden.");

createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1_000 * 60 * 60 * 24 * 7, // 7 Tage
          buster: "",                          // Ändern, um Cache zu invalidieren
        }}
      >
        <App />
      </PersistQueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);
