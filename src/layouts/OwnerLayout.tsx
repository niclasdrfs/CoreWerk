import { useEffect, useRef } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { OwnerSidebar } from "@/components/OwnerSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { preloadOwnerRoutes } from "@/utils/routePreload";
import { BrowserTabsProvider, useBrowserTabs } from "@/contexts/BrowserTabsContext";
import { BrowserTabBar } from "@/components/BrowserTabBar";
import { TabRenderer } from "@/components/TabRenderer";
import { useIsMobile } from "@/hooks/use-mobile";
import { ownerRoutes } from "@/config/ownerRoutes";

function OwnerTabLocationSync() {
  const location = useLocation();
  const { activeTabId, navigateInTab, isTabSystemActive, basePath } = useBrowserTabs();
  const lastSyncedPathRef = useRef<string>("");

  useEffect(() => {
    if (!isTabSystemActive || !activeTabId) return;

    const fullPath = location.pathname + location.search;
    if (!fullPath.startsWith(basePath) || lastSyncedPathRef.current === fullPath) return;

    lastSyncedPathRef.current = fullPath;

    const relativePath = fullPath.startsWith(`${basePath}?`)
      ? `/?${fullPath.split("?")[1]}`
      : fullPath.slice(basePath.length) || "/";

    navigateInTab(activeTabId, relativePath);
  }, [location.pathname, location.search, activeTabId, navigateInTab, isTabSystemActive, basePath]);

  return null;
}

export function OwnerLayout() {
  const isMobile = useIsMobile();

  useEffect(() => {
    preloadOwnerRoutes();
  }, []);

  return (
    <BrowserTabsProvider basePath="/owner">
      <OwnerTabLocationSync />
      <SidebarProvider style={{ "--sidebar-width": "12rem" } as React.CSSProperties}>
        <div className="min-h-screen flex w-full overflow-x-hidden">
          <OwnerSidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden relative">
            <BrowserTabBar basePath="/owner" />
            {isMobile ? <Outlet /> : <TabRenderer routes={ownerRoutes} basePath="/owner" />}
          </div>
        </div>
      </SidebarProvider>
    </BrowserTabsProvider>
  );
}

