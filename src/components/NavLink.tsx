import { forwardRef, useCallback, MouseEvent } from "react";
import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useBrowserTabsOptional } from "@/contexts/BrowserTabsContext";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, onClick, ...props }, ref) => {
    const browserTabs = useBrowserTabsOptional();
    const isMobile = useIsMobile();

    const handleClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
      // On desktop with tab system active, intercept navigation and route to active tab's MemoryRouter
      if (!isMobile && browserTabs?.isTabSystemActive && browserTabs.activeTabId) {
        const path = typeof to === "string"
          ? to
          : `${(to as any).pathname || ""}${(to as any).search || ""}${(to as any).hash || ""}` || "/";

        const inTabNamespace =
          path === browserTabs.basePath ||
          path.startsWith(`${browserTabs.basePath}/`) ||
          path.startsWith(`${browserTabs.basePath}?`);

        // Let BrowserRouter handle links outside the tab namespace
        if (!inTabNamespace) {
          onClick?.(e as any);
          return;
        }

        if (e.ctrlKey || e.metaKey || e.button === 1) {
          // Ctrl/Cmd click = open in new tab
          e.preventDefault();
          browserTabs.openTab(path);
          return;
        }

        // Normal click = navigate within active tab
        e.preventDefault();
        const basePath = browserTabs.basePath;
        const relativePath = path.startsWith(basePath)
          ? path.slice(basePath.length) || "/"
          : path;
        browserTabs.navigateInTab(browserTabs.activeTabId, relativePath);
      }

      onClick?.(e as any);
    }, [browserTabs, isMobile, to, onClick]);

    return (
      <RouterNavLink
        ref={ref}
        to={to}
        onClick={handleClick}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
