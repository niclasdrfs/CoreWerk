import { Suspense, useEffect, useCallback } from "react";
import { MemoryRouter, Routes, Route, useLocation, useNavigate, UNSAFE_LocationContext, UNSAFE_NavigationContext } from "react-router-dom";
import { useBrowserTabs } from "@/contexts/BrowserTabsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageLoader } from "@/components/PageLoader";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { RouteConfig } from "@/config/ownerRoutes";

/** Syncs MemoryRouter location changes back to the tab context */
function TabNavigationSync({ tabId }: { tabId: string }) {
  const location = useLocation();
  const { updateTabPath } = useBrowserTabs();

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    updateTabPath(tabId, fullPath);
  }, [location.pathname, location.search, tabId, updateTabPath]);

  return null;
}

/** Listens for navigation requests from the context and navigates within the MemoryRouter */
function TabNavigationListener({ tabId }: { tabId: string }) {
  const navigate = useNavigate();
  const { getNavigationRequest, clearNavigationRequest } = useBrowserTabs();

  useEffect(() => {
    const request = getNavigationRequest(tabId);
    if (request) {
      navigate(request);
      clearNavigationRequest(tabId);
    }
  });

  return null;
}

/** Renders a single tab's content inside a MemoryRouter */
function TabPanel({
  tabId,
  initialPath,
  basePath,
  routes,
  isVisible,
}: {
  tabId: string;
  initialPath: string;
  basePath: string;
  routes: RouteConfig[];
  isVisible: boolean;
}) {
  // Strip basePath prefix for MemoryRouter (it uses relative paths)
  const relativePath = initialPath.startsWith(basePath)
    ? initialPath.slice(basePath.length) || "/"
    : initialPath;

  return (
    <div
      style={{ display: isVisible ? "flex" : "none" }}
      className="flex-1 flex flex-col min-h-0 overflow-auto"
    >
      {/* Reset parent BrowserRouter context so MemoryRouter can render */}
      <UNSAFE_LocationContext.Provider value={null as any}>
        <UNSAFE_NavigationContext.Provider value={null as any}>
          <MemoryRouter initialEntries={[relativePath]}>
            <TabNavigationSync tabId={tabId} />
            <TabNavigationListener tabId={tabId} />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {routes.map((r, i) => (
                  <Route
                    key={r.path || `index-${i}`}
                    path={r.index ? "/" : `/${r.path}`}
                    element={r.element}
                  />
                  ))}
                <Route path="*" element={<div className="p-8 text-muted-foreground">Seite nicht gefunden</div>} />
              </Routes>
            </Suspense>
          </MemoryRouter>
        </UNSAFE_NavigationContext.Provider>
      </UNSAFE_LocationContext.Provider>
    </div>
  );
}

export function TabRenderer({
  routes,
  basePath,
}: {
  routes: RouteConfig[];
  basePath: string;
}) {
  const isMobile = useIsMobile();
  const { tabs, activeTabId, splitTabId } = useBrowserTabs();

  // On mobile, don't use multi-tab rendering at all — this shouldn't be reached
  // but acts as a safety net
  if (isMobile) {
    return null;
  }

  const hasSplit = splitTabId !== null;
  const activeTab = tabs.find(t => t.id === activeTabId);
  const splitTab = splitTabId ? tabs.find(t => t.id === splitTabId) : null;

  if (hasSplit && activeTab && splitTab) {
    return (
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={50} minSize={25}>
          <div className="flex flex-col h-full overflow-hidden">
            {tabs.map(tab => (
              <TabPanel
                key={`${tab.id}:${tab.path}`}
                tabId={tab.id}
                initialPath={tab.path}
                basePath={basePath}
                routes={routes}
                isVisible={tab.id === activeTabId}
              />
            ))}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={25}>
          <div className="flex flex-col h-full overflow-hidden">
            <TabPanel
              key={`split-${splitTab.id}:${splitTab.path}`}
              tabId={splitTab.id}
              initialPath={splitTab.path}
              basePath={basePath}
              routes={routes}
              isVisible={true}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  // Normal mode: render all tabs, show only active
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {tabs.map(tab => (
        <TabPanel
          key={`${tab.id}:${tab.path}`}
          tabId={tab.id}
          initialPath={tab.path}
          basePath={basePath}
          routes={routes}
          isVisible={tab.id === activeTabId}
        />
      ))}
    </div>
  );
}
