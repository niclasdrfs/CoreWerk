import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export interface BrowserTab {
  id: string;
  path: string;
  title: string;
}

interface NavigationRequests {
  [tabId: string]: string | undefined;
}

interface BrowserTabsContextType {
  tabs: BrowserTab[];
  activeTabId: string | null;
  splitTabId: string | null;
  openTab: (path: string, title?: string) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  updateTabPath: (id: string, relativePath: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  navigateInTab: (tabId: string, path: string) => void;
  getNavigationRequest: (tabId: string) => string | undefined;
  clearNavigationRequest: (tabId: string) => void;
  splitTab: (id: string) => void;
  unsplit: () => void;
  isTabSystemActive: boolean;
  basePath: string;
}

const BrowserTabsContext = createContext<BrowserTabsContextType | null>(null);

const STORAGE_KEY = "browser-tabs";

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function resolveTitle(path: string): string {
  const clean = path.split("?")[0];
  const map: Record<string, string> = {
    "/": "Dashboard",
    "/owner": "Dashboard",
    "/owner/calculator": "Kalkulator › Angebotsrechner",
    "/owner/calculator/quotes": "Kalkulator › Angebote",
    "/owner/calculator/parameters": "Kalkulator › Artikel hinzufügen",
    "/owner/calculator/products": "Kalkulator › Produkte",
    "/owner/quote-configurator": "Kalkulator › PDF-Angebote",
    "/owner/product-builder": "Kalkulator › Produkte anlegen",
    "/owner/rechner": "Kalkulator › Rechner",
    "/owner/rechner/lohn": "Kalkulator › Lohnreferenz",
    "/owner/deckungsbeitrag": "Kalkulator › Deckungsbeitrag",
    "/owner/settings": "Einstellungen",
    "/owner/timeline-templates": "Baustellen › Zeitstrahlübersicht",
    "/owner/customers/new": "Kunden › Neuer Kunde",
    "/ober-montageleiter": "Start",
    "/ober-montageleiter/baustellen": "Baustellen",
    "/ober-montageleiter/meine-buchungen": "Meine Buchungen",
  };

  // Try full path with basePath
  if (map[clean]) return map[clean];

  // Try relative paths for MemoryRouter (prefixed with /)
  const relativeMap: Record<string, string> = {
    "/": "Dashboard",
    "/calculator": "Kalkulator › Angebotsrechner",
    "/calculator/quotes": "Kalkulator › Angebote",
    "/calculator/parameters": "Kalkulator › Artikel hinzufügen",
    "/calculator/products": "Kalkulator › Produkte",
    "/quote-configurator": "Kalkulator › PDF-Angebote",
    "/product-builder": "Kalkulator › Produkte anlegen",
    "/rechner": "Kalkulator › Rechner",
    "/rechner/lohn": "Kalkulator › Lohnreferenz",
    "/deckungsbeitrag": "Kalkulator › Deckungsbeitrag",
    "/settings": "Einstellungen",
    "/timeline-templates": "Baustellen › Zeitstrahlübersicht",
    "/customers/new": "Kunden › Neuer Kunde",
    "/baustellen": "Baustellen",
    "/meine-buchungen": "Meine Buchungen",
  };

  if (relativeMap[clean]) return relativeMap[clean];

  if (path.includes("view=customers")) return "Kunden";
  if (path.includes("view=employees")) return "Angestellte";
  if (path.includes("view=sites")) return "Baustellen › Übersicht";

  if (clean.match(/\/stage\/[^/]+\/employees$/)) return "Bauphase › Mitarbeiter";
  if (clean.match(/\/stage\/[^/]+\/documentation$/)) return "Bauphase › Dokumentation";
  if (clean.match(/\/site\/[^/]+\/kundeninfo$/)) return "Baustelle › Kundeninfo";
  if (clean.match(/\/site\/[^/]+\/plaene$/)) return "Baustelle › Pläne";
  if (clean.match(/\/site\/[^/]+\/schriftverkehr$/)) return "Baustelle › Schriftverkehr";
  if (clean.match(/\/site\/[^/]+\/kontakt$/)) return "Baustelle › Kontakt";
  if (clean.match(/\/site\/[^/]+$/) || clean.match(/\/baustellen\/[^/]+$/)) return "Baustelle";
  if (clean.match(/\/einsatz\/[^/]+$/)) return "Einsatz";
  if (clean.match(/\/page\/[^/]+$/)) {
    const slug = clean.split("/").pop() || "";
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }
  if (clean.match(/\/calculator\/[^/]+$/)) return "Kalkulator › Kategorie";

  const last = clean.split("/").filter(Boolean).pop() || "Seite";
  return last.charAt(0).toUpperCase() + last.slice(1);
}

interface TabState {
  tabs: BrowserTab[];
  activeTabId: string;
  splitTabId: string | null;
}

function loadTabs(basePath: string): TabState {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY}-${basePath}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.tabs?.length) return { ...parsed, splitTabId: parsed.splitTabId ?? null };
    }
  } catch {}
  const id = generateId();
  return { tabs: [{ id, path: basePath, title: resolveTitle(basePath) }], activeTabId: id, splitTabId: null };
}

function saveTabs(basePath: string, state: TabState) {
  try {
    sessionStorage.setItem(`${STORAGE_KEY}-${basePath}`, JSON.stringify(state));
  } catch {}
}

export function BrowserTabsProvider({ children, basePath }: { children: ReactNode; basePath: string }) {
  const isMobile = useIsMobile();
  const [state, setState] = useState(() => loadTabs(basePath));
  const navRequestsRef = useRef<NavigationRequests>({});

  // Persist on change
  useEffect(() => {
    saveTabs(basePath, state);
  }, [state, basePath]);

  // Sync browser URL bar with active tab
  useEffect(() => {
    if (isMobile) return;
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    if (activeTab) {
      const fullPath = activeTab.path.startsWith(basePath)
        ? activeTab.path
        : basePath + (activeTab.path === "/" ? "" : activeTab.path);
      if (window.location.pathname + window.location.search !== fullPath) {
        window.history.replaceState(null, "", fullPath);
      }
    }
  }, [state.activeTabId, state.tabs, basePath, isMobile]);

  const openTab = useCallback((path: string, title?: string) => {
    const id = generateId();
    const newTab: BrowserTab = { id, path, title: title || resolveTitle(path) };
    setState(prev => ({ ...prev, tabs: [...prev.tabs, newTab], activeTabId: id }));
  }, []);

  const closeTab = useCallback((id: string) => {
    setState(prev => {
      if (prev.tabs.length <= 1) return prev;
      const idx = prev.tabs.findIndex(t => t.id === id);
      const newTabs = prev.tabs.filter(t => t.id !== id);
      let newActive = prev.activeTabId;
      let newSplit = prev.splitTabId;

      if (prev.splitTabId === id) {
        newSplit = null;
      }
      if (prev.activeTabId === id) {
        const replacement = newTabs[Math.min(idx, newTabs.length - 1)];
        newActive = replacement.id;
      }
      return { tabs: newTabs, activeTabId: newActive, splitTabId: newSplit };
    });
  }, []);

  const switchTab = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeTabId: id }));
  }, []);

  const updateTabPath = useCallback((id: string, relativePath: string) => {
    setState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t =>
        t.id === id ? { ...t, path: relativePath, title: resolveTitle(relativePath) } : t
      ),
    }));
  }, []);

  const updateTabTitle = useCallback((id: string, title: string) => {
    setState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => (t.id === id ? { ...t, title } : t)),
    }));
  }, []);

  const navigateInTab = useCallback((tabId: string, path: string) => {
    navRequestsRef.current = { ...navRequestsRef.current, [tabId]: path };
    // Force re-render so the listener picks it up
    setState(prev => ({ ...prev }));
  }, []);

  const getNavigationRequest = useCallback((tabId: string) => {
    return navRequestsRef.current[tabId];
  }, []);

  const clearNavigationRequest = useCallback((tabId: string) => {
    const { [tabId]: _, ...rest } = navRequestsRef.current;
    navRequestsRef.current = rest;
  }, []);

  const splitTab = useCallback((id: string) => {
    setState(prev => {
      if (id === prev.activeTabId) return prev;
      return { ...prev, splitTabId: id };
    });
  }, []);

  const unsplit = useCallback(() => {
    setState(prev => ({ ...prev, splitTabId: null }));
  }, []);

  return (
    <BrowserTabsContext.Provider
      value={{
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        splitTabId: state.splitTabId,
        openTab,
        closeTab,
        switchTab,
        updateTabPath,
        updateTabTitle,
        navigateInTab,
        getNavigationRequest,
        clearNavigationRequest,
        splitTab,
        unsplit,
        isTabSystemActive: !isMobile,
        basePath,
      }}
    >
      {children}
    </BrowserTabsContext.Provider>
  );
}

export function useBrowserTabs() {
  const ctx = useContext(BrowserTabsContext);
  if (!ctx) throw new Error("useBrowserTabs must be used within BrowserTabsProvider");
  return ctx;
}

export function useBrowserTabsOptional() {
  return useContext(BrowserTabsContext);
}

/** Hook for pages to set a dynamic tab title (e.g. with a customer name) */
export function useTabTitle(title: string | undefined) {
  const ctx = useContext(BrowserTabsContext);
  const prevTitle = useRef<string>();
  useEffect(() => {
    if (!ctx || !title || !ctx.activeTabId) return;
    if (prevTitle.current === title) return;
    prevTitle.current = title;
    ctx.updateTabTitle(ctx.activeTabId, title);
  }, [title, ctx]);
}
