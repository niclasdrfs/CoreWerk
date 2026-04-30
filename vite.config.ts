/**
 * Vite Build-Konfiguration
 *
 * Optimierungen:
 * - Manual Chunks: Vendor-Libraries werden in getrennte Chunks aufgeteilt.
 *   Browser cached diese unabhängig vom App-Code → schnellere Updates.
 * - lovable-tagger nur im Dev-Modus aktiv (kein Overhead in Produktion).
 * - Realtime/Supabase werden separat gebündelt (ändern sich selten).
 *
 * PWA:
 * - Supabase API/Auth wird NICHT gecacht (würde zu veralteten Daten führen).
 * - Public Storage (Bilder) wird mit CacheFirst gecacht (7 Tage).
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },

  // ── Plugins ──────────────────────────────────────────────────────────────
  plugins: [
    react(),
    // componentTagger nur in Entwicklung (erzeugt keine Prod-Artefakte)
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Werkey – Handwerksprojekte",
        short_name: "Werkey",
        description: "Professionelles Projektmanagement für Handwerksbetriebe",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [
          {
            // Nur öffentliche Storage-Dateien (Bilder etc.) cachen
            // NICHT Auth/REST API → verhindert veraltete Daten
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-public-storage",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        importScripts: ["/sw-push.js"],
      },
    }),
  ].filter(Boolean),

  // ── Modul-Auflösung ────────────────────────────────────────────────────
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    // Verhindert doppelte React-Instanzen (wichtig für Monorepos / Symlinks)
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },

  // ── Dependency Pre-Bundling ────────────────────────────────────────────
  optimizeDeps: {
    include: [
      "@tanstack/react-query",
      "@tanstack/react-query-persist-client",
      "@supabase/supabase-js",
    ],
  },

  // ── Build-Optimierungen ────────────────────────────────────────────────
  build: {
    rollupOptions: {
      output: {
        /**
         * Manual Chunks: Trennt stabile Libraries vom App-Code.
         * Browser cached Library-Chunks unabhängig → bei App-Updates
         * müssen Nutzer nur den App-Chunk neu laden, nicht React/Supabase.
         */
        manualChunks: {
          // React-Kern (ändert sich sehr selten)
          "vendor-react": ["react", "react-dom", "react/jsx-runtime"],
          // Routing
          "vendor-router": ["react-router-dom"],
          // Supabase (separater Chunk – groß, aber stabil)
          "vendor-supabase": ["@supabase/supabase-js"],
          // TanStack Query
          "vendor-query": [
            "@tanstack/react-query",
            "@tanstack/react-query-persist-client",
          ],
          // UI-Basis (Radix UI, shadcn)
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
          ],
          // Datum-Utilities
          "vendor-date": ["date-fns"],
        },
      },
    },
    // Warnung ab 600 KB (Standard 500 KB ist zu streng für shadcn-Apps)
    chunkSizeWarningLimit: 600,
  },
}));
