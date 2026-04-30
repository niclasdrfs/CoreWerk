import { useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrefetch } from "@/hooks/usePrefetch";
import { useBrowserTabsOptional } from "@/contexts/BrowserTabsContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Crown,
  Users,
  Users2,
  Building2,
  Settings,
  FileText,
  ChevronDown,
  Layers,
  Calculator,
  Package,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

interface CustomPage {
  id: string;
  name: string;
  slug: string;
}

export function OwnerSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { prefetchConstructionSites, prefetchCustomers, prefetchEmployees } = usePrefetch();
  const browserTabs = useBrowserTabsOptional();

  // Tab-aware navigation: route through MemoryRouter on desktop
  const handleNavClick = useCallback((e: React.MouseEvent, url: string) => {
    if (!browserTabs?.isTabSystemActive) return; // let NavLink handle normally on mobile
    e.preventDefault();
    // Ctrl/Cmd click or middle click = open in new tab
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      browserTabs.openTab(url);
    } else if (browserTabs.activeTabId) {
      // Strip basePath for MemoryRouter navigation
      let relativePath = url;
      if (url.startsWith("/owner?")) {
        relativePath = "/?" + url.split("?")[1];
      } else if (url.startsWith("/owner")) {
        relativePath = url.slice("/owner".length) || "/";
      }
      browserTabs.navigateInTab(browserTabs.activeTabId, relativePath);
    }
  }, [browserTabs]);

  // Get user's company ID
  const { data: profile } = useQuery({
    queryKey: ["owner-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch custom pages
  const { data: customPages = [] } = useQuery({
    queryKey: ["owner-custom-pages", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("owner_custom_pages")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as CustomPage[];
    },
    enabled: !!profile?.company_id,
  });

  // Prefetch handlers
  const handlePrefetchSites = useCallback(() => {
    if (profile?.company_id) {
      prefetchConstructionSites(profile.company_id);
    }
  }, [profile?.company_id, prefetchConstructionSites]);

  const handlePrefetchCustomers = useCallback(() => {
    if (profile?.company_id) {
      prefetchCustomers(profile.company_id);
    }
  }, [profile?.company_id, prefetchCustomers]);

  const handlePrefetchEmployees = useCallback(() => {
    if (profile?.company_id) {
      prefetchEmployees(profile.company_id);
    }
  }, [profile?.company_id, prefetchEmployees]);

  const staticItemsTop = [
    { title: "Dashboard", url: "/owner", icon: Crown },
  ];

  const kundenItem = { title: "Kunden", url: "/owner?view=customers", icon: Users2, onPrefetch: handlePrefetchCustomers };
  const angestellteItem = { title: "Angestellte", url: "/owner?view=employees", icon: Users, onPrefetch: handlePrefetchEmployees };

  const isActive = (url: string) => {
    if (url === "/owner") {
      return location.pathname === "/owner" && !location.search;
    }
    return location.pathname + location.search === url;
  };

  const isBaustellenActive = 
    location.pathname + location.search === "/owner?view=sites" ||
    location.pathname === "/owner/timeline-templates";

  const isKalkulatorActive = 
    location.pathname.startsWith("/owner/calculator") ||
    location.pathname === "/owner/page/kalkulator" ||
    location.pathname === "/owner/quote-configurator" ||
    location.pathname === "/owner/calculator/products" ||
    location.pathname === "/owner/product-builder" ||
    location.pathname === "/owner/rechner" ||
    location.pathname === "/owner/deckungsbeitrag";

  const [baustellenOpen, setBaustellenOpen] = useState(isBaustellenActive);
  const [kalkulatorOpen, setKalkulatorOpen] = useState(isKalkulatorActive);

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dashboard */}
              {staticItemsTop.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} onClick={(e) => handleNavClick(e, item.url)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Kunden */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(kundenItem.url)}
                  tooltip={kundenItem.title}
                >
                  <NavLink to={kundenItem.url} onMouseEnter={kundenItem.onPrefetch} onClick={(e) => handleNavClick(e, kundenItem.url)}>
                    <kundenItem.icon className="h-4 w-4" />
                    <span>{kundenItem.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Kalkulator Dropdown */}
              <Collapsible open={kalkulatorOpen} onOpenChange={setKalkulatorOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Kalkulator"
                      className={isKalkulatorActive ? "bg-accent" : ""}
                    >
                      <Calculator className="h-4 w-4" />
                      <span className="flex-1">Kalkulator</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          kalkulatorOpen ? "rotate-180" : ""
                        }`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                  <div className="ml-6 border-l border-border pl-2 space-y-1 mt-1">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/owner/calculator"}
                        tooltip="Angebotsrechner"
                        className={location.pathname === "/owner/calculator" ? "!bg-primary/15 !text-primary dark:!text-primary" : ""}
                      >
                        <NavLink to="/owner/calculator" onClick={(e) => handleNavClick(e, "/owner/calculator")}>
                          <Calculator className="h-4 w-4" />
                          <span>Angebotsrechner</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/owner/calculator/quotes"}
                        tooltip="Angebote"
                        className={location.pathname === "/owner/calculator/quotes" ? "!bg-emerald-500/15 !text-emerald-700 dark:!text-emerald-300" : ""}
                      >
                        <NavLink to="/owner/calculator/quotes" onClick={(e) => handleNavClick(e, "/owner/calculator/quotes")}>
                          <FileText className="h-4 w-4" />
                          <span>Angebote</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/owner/calculator/parameters"}
                        tooltip="Artikel hinzufügen"
                        className={location.pathname === "/owner/calculator/parameters" ? "!bg-amber-500/15 !text-amber-700 dark:!text-amber-300" : ""}
                      >
                        <NavLink to="/owner/calculator/parameters" onClick={(e) => handleNavClick(e, "/owner/calculator/parameters")}>
                          <Package className="h-4 w-4" />
                          <span>Artikel hinzufügen</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/owner/calculator/products"}
                        tooltip="Produkte"
                        className={location.pathname === "/owner/calculator/products" ? "!bg-teal-500/15 !text-teal-700 dark:!text-teal-300" : ""}
                      >
                        <NavLink to="/owner/calculator/products" onClick={(e) => handleNavClick(e, "/owner/calculator/products")}>
                          <Package className="h-4 w-4" />
                          <span>Produkte</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/owner/quote-configurator"}
                        tooltip="Angebotskonfigurator"
                        className={location.pathname === "/owner/quote-configurator" ? "!bg-violet-500/15 !text-violet-700 dark:!text-violet-300" : ""}
                      >
                        <NavLink to="/owner/quote-configurator" onClick={(e) => handleNavClick(e, "/owner/quote-configurator")}>
                          <FileText className="h-4 w-4" />
                          <span>PDF-Angebote</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/owner/product-builder"}
                        tooltip="Produkte anlegen"
                        className={location.pathname === "/owner/product-builder" ? "!bg-orange-500/15 !text-orange-700 dark:!text-orange-300" : ""}
                      >
                        <NavLink to="/owner/product-builder" onClick={(e) => handleNavClick(e, "/owner/product-builder")}>
                          <ShoppingCart className="h-4 w-4" />
                          <span>Produkte anlegen</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/owner/rechner"}
                        tooltip="Rechner"
                        className={location.pathname === "/owner/rechner" ? "!bg-yellow-500/15 !text-yellow-700 dark:!text-yellow-300" : ""}
                      >
                        <NavLink to="/owner/rechner" onClick={(e) => handleNavClick(e, "/owner/rechner")}>
                          <Calculator className="h-4 w-4" />
                          <span>Rechner</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/owner/deckungsbeitrag"}
                        tooltip="Deckungsbeitrag"
                        className={location.pathname === "/owner/deckungsbeitrag" ? "!bg-cyan-500/15 !text-cyan-700 dark:!text-cyan-300" : ""}
                      >
                        <NavLink to="/owner/deckungsbeitrag" onClick={(e) => handleNavClick(e, "/owner/deckungsbeitrag")}>
                          <TrendingUp className="h-4 w-4" />
                          <span>Deckungsbeitrag</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Baustellen Dropdown */}
              <Collapsible open={baustellenOpen} onOpenChange={setBaustellenOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Baustellen"
                      className={isBaustellenActive ? "bg-accent" : ""}
                      onMouseEnter={handlePrefetchSites}
                    >
                      <Building2 className="h-4 w-4" />
                      <span className="flex-1">Baustellen</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          baustellenOpen ? "rotate-180" : ""
                        }`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                  <div className="ml-6 border-l border-border pl-2 space-y-1 mt-1">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/owner?view=sites")}
                        tooltip="Baustellenübersicht"
                        className={isActive("/owner?view=sites") ? "!bg-sky-500/15 !text-sky-700 dark:!text-sky-300" : ""}
                      >
                        <NavLink to="/owner?view=sites" onClick={(e) => handleNavClick(e, "/owner?view=sites")}>
                          <Building2 className="h-4 w-4" />
                          <span>Baustellenübersicht</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/owner/timeline-templates"}
                        tooltip="Zeitstrahlübersicht"
                        className={location.pathname === "/owner/timeline-templates" ? "!bg-indigo-500/15 !text-indigo-700 dark:!text-indigo-300" : ""}
                      >
                        <NavLink to="/owner/timeline-templates" onClick={(e) => handleNavClick(e, "/owner/timeline-templates")}>
                          <Layers className="h-4 w-4" />
                          <span>Zeitstrahlübersicht</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Angestellte (nach Baustellen) */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(angestellteItem.url)}
                  tooltip={angestellteItem.title}
                >
                  <NavLink to={angestellteItem.url} onMouseEnter={angestellteItem.onPrefetch} onClick={(e) => handleNavClick(e, angestellteItem.url)}>
                    <angestellteItem.icon className="h-4 w-4" />
                    <span>{angestellteItem.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Other custom pages (excluding kalkulator) */}
              {customPages
                .filter((page) => page.slug !== "kalkulator")
                .map((page) => (
                  <SidebarMenuItem key={page.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === `/owner/page/${page.slug}`}
                      tooltip={page.name}
                    >
                      <NavLink to={`/owner/page/${page.slug}`} onClick={(e) => handleNavClick(e, `/owner/page/${page.slug}`)}>
                        <FileText className="h-4 w-4" />
                        <span className="truncate">{page.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings at bottom */}
        <SidebarGroup className="mt-auto pb-4">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === "/owner/settings" || location.pathname === "/settings"}
                  tooltip="Einstellungen"
                >
                  <NavLink to="/owner/settings" onClick={(e) => handleNavClick(e, "/owner/settings")}>
                    <Settings className="h-4 w-4" />
                    <span>Einstellungen</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
