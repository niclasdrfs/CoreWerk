# Werkey – Technische Architektur & Entwicklerdokumentation

> **Zuletzt aktualisiert:** April 2026  
> **Zielgruppe:** Entwickler, die am Projekt arbeiten  
> **Stack:** React 18 · TypeScript · Vite · Supabase · TanStack Query · Tailwind CSS · PWA

---

## Inhaltsverzeichnis

1. [Systemüberblick](#1-systemüberblick)
2. [Projektstruktur](#2-projektstruktur)
3. [Architektur-Entscheidungen](#3-architektur-entscheidungen)
4. [Datenschutz & Sicherheit](#4-datenschutz--sicherheit)
5. [Performance & Skalierbarkeit](#5-performance--skalierbarkeit)
6. [Authentifizierung & Rollen](#6-authentifizierung--rollen)
7. [Datenbankschema (Überblick)](#7-datenbankschema-überblick)
8. [State Management](#8-state-management)
9. [Realtime-Synchronisation](#9-realtime-synchronisation)
10. [Offline-Fähigkeit (PWA)](#10-offline-fähigkeit-pwa)
11. [Deployment & CI](#11-deployment--ci)
12. [Häufige Aufgaben](#12-häufige-aufgaben)

---

## 1. Systemüberblick

Werkey ist ein **Multi-Tenant Baustellenmanagement-System** für Handwerksbetriebe.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / PWA                        │
│                                                             │
│  React 18 + TypeScript  →  TanStack Query (Cache/Offline)  │
│         ↓                         ↓                        │
│   Supabase JS Client  ←──────────────────────────────┐    │
│         ↓                                            │    │
└─────────────────────────────────────────────────────────────┘
           ↓ HTTPS / WSS
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (selbst-gehostet möglich)       │
│                                                             │
│  Auth (JWT)  │  PostgREST API  │  Realtime (WebSocket)     │
│                    ↓                                        │
│              PostgreSQL + RLS                               │
│              Edge Functions (Deno)                          │
└─────────────────────────────────────────────────────────────┘
```

### Tenant-Modell

Jede Firma (`companies`) hat eine eigene `company_id`. Alle sensiblen Tabellen haben eine `company_id`-Spalte, auf die **Row Level Security (RLS)** angewendet wird. Nutzer sehen nur Daten ihrer eigenen Firma.

---

## 2. Projektstruktur

```
src/
├── App.tsx                   # Routing-Baum (alle Routen an einem Ort)
├── main.tsx                  # Einstiegspunkt, QueryClient, Provider
├── index.css                 # Design-System (CSS-Variablen, Tailwind)
│
├── components/               # Wiederverwendbare UI-Bausteine
│   ├── ui/                   # shadcn/ui Basis-Komponenten (nicht bearbeiten)
│   ├── accounting/           # Buchhaltungs-spezifische Komponenten
│   ├── calculator/           # Kalkulations-Komponenten
│   ├── icons/                # Eigene Icon-Komponenten
│   │
│   ├── ErrorBoundary.tsx     # Fängt unerwartete Render-Fehler ab
│   ├── OfflineBanner.tsx     # Zeigt Offline/Online-Status an
│   ├── UpdateBanner.tsx      # PWA-Update-Benachrichtigung
│   ├── PageLoader.tsx        # Suspense-Fallback (Lazy Loading)
│   ├── ProtectedRoute.tsx    # Rollenbasierter Zugriffsschutz (UI)
│   ├── RealtimeProvider.tsx  # Aktiviert Realtime-Subscriptions
│   └── VoiceAssistantButton.tsx
│
├── pages/                    # Eine Datei = eine Route
│   ├── Index.tsx             # Login-Seite (immer eager-loaded)
│   ├── Owner.tsx
│   ├── Employee.tsx
│   └── ...
│
├── layouts/                  # Seiten-Layouts mit Sidebar/Tabs
│   ├── OwnerLayout.tsx
│   └── OberMontageleiterLayout.tsx
│
├── hooks/                    # Wiederverwendbare React Hooks
│   ├── useAuth.tsx           # ⚠️ Kernstück – Auth-Kontext
│   ├── useRealtimeSubscriptions.ts  # Supabase Realtime → Query Invalidierung
│   ├── useNetworkStatus.ts   # Online/Offline-Erkennung
│   ├── useAppUpdate.ts       # PWA-Update (re-export aus Context)
│   └── ...
│
├── contexts/                 # React Contexts
│   ├── AppUpdateContext.tsx  # PWA Service Worker Update
│   └── BrowserTabsContext.tsx
│
├── lib/                      # Reine Hilfsfunktionen (keine React)
│   ├── utils.ts              # cn() – Tailwind-Klassen zusammenführen
│   ├── queryPersister.ts     # IndexedDB-Adapter für TanStack Query
│   ├── colorUtils.ts
│   └── ...
│
├── integrations/
│   └── supabase/
│       ├── client.ts         # ⚠️ Supabase-Client (Singleton)
│       └── types.ts          # Auto-generierte DB-Typen (nicht bearbeiten)
│
└── config/                   # Konfigurationsdateien
```

> **Regel:** Pages importieren Components. Components importieren Hooks. Hooks importieren lib/. Niemals umgekehrt.

---

## 3. Architektur-Entscheidungen

### Warum TanStack Query statt Zustand/Redux?

- Server-State und Client-State klar trennen
- Automatisches Caching, Stale-While-Revalidate
- Offline-Persistenz via IndexedDB mit einem Adapter
- Kein manuelles Invalidieren nach Realtime-Events nötig (nur `invalidateQueries`)

### Warum Supabase?

- PostgreSQL mit RLS = Datenschutz auf DB-Ebene, nicht nur App-Ebene
- Realtime ohne eigenen WebSocket-Server
- Auth, Storage, Edge Functions aus einer Hand
- DSGVO-konform (EU-Hosting möglich)

### Lazy Loading (Code Splitting)

Alle Seiten außer `Index.tsx` werden lazy geladen. Das bedeutet:
- Initiales Bundle < 200 KB → schnelle erste Anzeige
- Navigation lädt den Code der neuen Seite on-demand

---

## 4. Datenschutz & Sicherheit

### DSGVO / Deutsches Datenschutzrecht

| Maßnahme | Implementierung |
|----------|----------------|
| Datensparsamkeit | Nur notwendige Felder in der DB |
| Zugriffskontrolle | Supabase RLS – Nutzer sieht nur eigene Firmendaten |
| Session-Sicherheit | Auth-Token in `sessionStorage` (nicht `localStorage`) |
| HTTPS erzwingen | Supabase erzwingt TLS; Deployment mit HTTPS-Redirect |
| Keine Drittanbieter-Tracker | Keine Analytics, kein Facebook Pixel |
| Datenminimierung | `profiles_limited` View für eingeschränkte Profil-Abfragen |

### Warum `sessionStorage` statt `localStorage`?

`localStorage` überlebt Tabs und Browser-Neustarts → Angriffsfläche für XSS.  
`sessionStorage` wird beim Tab-Schließen gelöscht. Das Offline-Caching erfolgt über IndexedDB (TanStack Query), nicht über Auth-Token.

### Row Level Security (RLS) – Prinzip

```sql
-- Beispiel: Nutzer sehen nur ihre Firmendaten
CREATE POLICY "company_isolation" ON construction_sites
  USING (company_id = (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));
```

Alle schreibenden Edge Functions prüfen zusätzlich die Rolle via `auth.jwt()`.

### Content Security Policy (CSP)

Zu konfigurieren im Hosting (z.B. Netlify/Vercel `headers`):

```
Content-Security-Policy:
  default-src 'self';
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: https://*.supabase.co;
```

---

## 5. Performance & Skalierbarkeit

### 1.000 gleichzeitige Nutzer – wie funktioniert das?

**Die App ist statisch** – alle Nutzer laden denselben Vite-Build (JS/CSS) von einem CDN.  
Die Last trifft ausschließlich **Supabase**:

| Ressource | Verhalten bei 1.000 Nutzern |
|-----------|----------------------------|
| REST API (PostgREST) | Nutzt Connection Pooling (PgBouncer) |
| Realtime (WebSocket) | 1 Channel pro Nutzer → 1.000 offene WS-Verbindungen (Supabase Pro hält das aus) |
| Queries | TanStack Query cached aggressiv → deutlich weniger API-Calls |
| Realtime-Debouncing | Burst-Updates einer Tabelle werden zu 1 Refetch gebündelt (16 ms) |

### Query-Caching-Strategie

```
staleTime: 5 min    → Daten gelten 5 min als frisch, kein Refetch nötig
gcTime: 7 Tage      → Offline-Cache bleibt 7 Tage in IndexedDB
refetchOnWindowFocus: false  → Kein Refetch bei Tab-Wechsel
networkMode: offlineFirst    → Cache-first, dann Netzwerk
```

### Bundle-Größen (Ziele)

| Bundle | Zielgröße |
|--------|-----------|
| Initial JS (gzipped) | < 200 KB |
| Pro Seite (Lazy Chunk) | < 50 KB |
| Total CSS | < 30 KB |

Prüfen mit: `npx vite build --mode production && npx vite-bundle-analyzer`

---

## 6. Authentifizierung & Rollen

### Rollen-Hierarchie

```
super_admin          → Zugriff auf alle Firmen (nur Anthropic/intern)
  └── accounting     → Nutzerverw., alle Zeiteinträge einsehen
  └── owner          → Firmendaten, Kalkulator, Mitarbeiterverwaltung
        └── ober_montageleiter  → Baustellen, Einsatzplanung + eigene Zeit
              └── installation_manager  → Baustellen + eigene Zeit
                    └── employee        → Nur eigene Zeit + zugewiesene Aufgaben
```

### Rollenprüfung – zwei Ebenen

1. **Client (UI):** `ProtectedRoute` + `useAuth().hasRole()` → verhindert falsches Routing, zeigt korrektes Menü
2. **Server (DB):** Supabase RLS Policies → **die eigentliche Sicherheitsschranke**

⚠️ Niemals nur auf Client-Prüfungen verlassen!

### Flow: Login → Dashboard

```
User gibt E-Mail + Passwort ein
  ↓
supabase.auth.signInWithPassword()
  ↓
JWT wird in sessionStorage gespeichert
  ↓
onAuthStateChange feuert → Rollen werden aus user_roles geladen
  ↓
Index.tsx leitet zur rollenspezifischen Route weiter
```

---

## 7. Datenbankschema (Überblick)

Vollständige Dokumentation: `DATABASE_README.md`

```
companies ──────────────────────────────────────────────────────
  id, name, subdomain

profiles ────────────────────────────────────────────────────── 
  id (= auth.users.id), company_id, full_name, email, ...

user_roles ──────────────────────────────────────────────────── 
  user_id, company_id, role (app_role enum)

construction_sites ──────────────────────────────────────────── 
  id, company_id, customer_last_name, status, address, ...
  ├── construction_site_timelines
  │     └── construction_site_timeline_stages
  ├── daily_assignments
  │     └── employee_assignments
  └── time_entries

customers ────────────────────────────────────────────────────── 
  id, company_id, name, ...
```

---

## 8. State Management

Werkey verwendet **kein globales State-Management-Framework** (kein Redux, kein Zustand).

| State-Typ | Lösung |
|-----------|--------|
| Server-State (API-Daten) | TanStack Query |
| Auth-State | React Context (`AuthContext`) |
| UI-State (lokale Komponente) | `useState` |
| PWA-Update | React Context (`AppUpdateContext`) |
| Browser-Tabs (Desktop) | React Context (`BrowserTabsContext`) |

### Datenfluss

```
Supabase DB
  ↓  (Realtime WebSocket)
useRealtimeSubscriptions
  ↓  (queryClient.invalidateQueries)
TanStack Query Cache
  ↓  (useQuery Hook)
React Component
```

---

## 9. Realtime-Synchronisation

`useRealtimeSubscriptions` öffnet **einen einzigen Supabase-Channel** und lauscht auf alle relevanten Tabellen. Bei einer DB-Änderung wird der zugehörige Query-Key invalidiert → TanStack Query fetcht neu.

**Debouncing (16 ms):** Schnelle aufeinanderfolgende Änderungen (z.B. Bulk-Insert) werden zu einem einzigen Refetch zusammengefasst. Das ist wichtig für die Skalierung: Bei 1.000 Nutzern kann eine einzelne DB-Operation viele Realtime-Events auslösen.

```typescript
// Prinzip
const timer = setTimeout(() => {
  queryClient.invalidateQueries({ queryKey: [key], refetchType: "active" });
}, 16); // Nur aktive Queries werden neu geladen
```

---

## 10. Offline-Fähigkeit (PWA)

### Service Worker (Vite PWA Plugin)

| Ressource | Strategie |
|-----------|-----------|
| JS/CSS/HTML/Icons | `CacheFirst` (aus App-Shell-Cache) |
| Supabase Public Storage (Bilder) | `CacheFirst`, 7 Tage, max. 50 Einträge |
| Supabase API/Auth | **Nicht gecacht** – verhindert veraltete Daten |

### Offline-Datenverfügbarkeit

- TanStack Query persistiert den Cache in **IndexedDB** (7 Tage)
- Bei Offline: App zeigt gecachte Daten an
- `OfflineBanner` informiert den Nutzer
- Bei Reconnect: `refetchOnReconnect: true` → automatische Synchronisation

---

## 11. Deployment & CI

### Umgebungsvariablen

```env
# .env.local (nie ins Repository!)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

### Build

```bash
npm run build          # Produktion-Build
npm run preview        # Build lokal vorschauen
npm run lint           # ESLint prüfen
```

### Supabase Migrations

```bash
supabase db push       # Migrations auf Prod anwenden
supabase functions deploy send-push-notification  # Edge Function deployen
```

---

## 12. Häufige Aufgaben

### Neue Seite hinzufügen

1. `src/pages/MeinePage.tsx` erstellen
2. In `src/App.tsx` lazy importieren:
   ```typescript
   const MeinePage = lazy(() => import("./pages/MeinePage"));
   ```
3. Route hinzufügen (mit passendem `guard()`-Wrapper)

### Neue Query hinzufügen

```typescript
const { data } = useQuery({
  queryKey: ["meine-daten", userId],          // Eindeutiger Key
  queryFn: async () => {
    const { data, error } = await supabase
      .from("meine_tabelle")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;
    return data;
  },
  enabled: !!userId,                           // Nur wenn userId vorhanden
});
```

### Realtime für neue Tabelle aktivieren

In `src/hooks/useRealtimeSubscriptions.ts` den `TABLE_QUERY_MAP` erweitern:

```typescript
meine_tabelle: ["meine-daten"],
```

### Neue Rolle hinzufügen

1. Supabase Migration: `ALTER TYPE app_role ADD VALUE 'neue_rolle';`
2. `AppRole` Type in `useAuth.tsx` erweitern
3. `ProtectedRoute`-Prüfung ggf. anpassen
4. RLS-Policy für neue Rolle in DB anlegen

---

## Kontakt & Weiterentwicklung

Bei Fragen zur Architektur: Alle Kern-Entscheidungen sind in diesem Dokument und in den Inline-Kommentaren der jeweiligen Dateien dokumentiert.

**Wichtigste Dateien zum Lesen:**
1. `src/main.tsx` – Einstiegspunkt & Provider-Baum
2. `src/App.tsx` – Vollständiger Routing-Baum
3. `src/hooks/useAuth.tsx` – Authentifizierung
4. `src/hooks/useRealtimeSubscriptions.ts` – Realtime-Synchronisation
5. `src/integrations/supabase/client.ts` – DB-Verbindung
