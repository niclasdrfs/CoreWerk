import { useNavigate, useLocation, NavigateOptions, To } from "react-router-dom";
import { useCallback } from "react";
import { useBrowserTabsOptional } from "@/contexts/BrowserTabsContext";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Drop-in replacement for useNavigate that is aware of the tab system.
 * Inside a MemoryRouter tab, absolute paths like "/owner/calculator/foo"
 * are automatically stripped to "/calculator/foo" so the MemoryRouter
 * can resolve them.
 */
export function useTabNavigate() {
  const navigate = useNavigate();
  const browserTabs = useBrowserTabsOptional();
  const isMobile = useIsMobile();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      // Numeric (go back/forward) – pass through
      if (typeof to === "number") {
        navigate(to);
        return;
      }

      // On mobile or no tab system – pass through unchanged
      if (isMobile || !browserTabs?.isTabSystemActive) {
        navigate(to, options);
        return;
      }

      const basePath = browserTabs.basePath; // e.g. "/owner"

      // Strip basePath prefix for MemoryRouter
      if (typeof to === "string") {
        let stripped = to;
        if (to === basePath) {
          stripped = "/";
        } else if (to.startsWith(`${basePath}/`)) {
          stripped = to.slice(basePath.length); // "/owner/calculator" → "/calculator"
        } else if (to.startsWith(`${basePath}?`)) {
          stripped = `/${to.slice(basePath.length)}`; // "/owner?view=x" → "/?view=x"
        }
        navigate(stripped, options);
      } else {
        // To object – strip pathname
        const pathname = (to as any).pathname || "";
        let strippedPathname = pathname;
        if (pathname === basePath) {
          strippedPathname = "/";
        } else if (pathname.startsWith(`${basePath}/`)) {
          strippedPathname = pathname.slice(basePath.length);
        }
        navigate({ ...to, pathname: strippedPathname }, options);
      }
    },
    [navigate, browserTabs, isMobile],
  );
}
