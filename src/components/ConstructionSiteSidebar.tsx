import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Phone, MapPin, Pencil, Search, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConstructionSiteEditDialog } from "./ConstructionSiteEditDialog";
import { TimelineMiniProgress } from "./timeline/TimelineMiniProgress";
interface ConstructionSite {
  id: string;
  customer_last_name: string;
  address: string | null;
  customer_phone: string | null;
  color: string | null;
  status: string;
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}
type SiteFilter = "active" | "future" | "archived";
interface ConstructionSiteSidebarProps {
  sites: ConstructionSite[];
  companyId: string;
  userId: string;
  currentFilter?: SiteFilter;
  onFilterChange?: (filter: SiteFilter) => void;
  hideFilterDropdown?: boolean;
  onSiteClick?: (siteId: string) => void;
  isSelectingMode?: boolean;
  // External search control
  externalSearchQuery?: string;
  onExternalSearchChange?: (query: string) => void;
  showSearch?: boolean;
}
const filterLabels: Record<SiteFilter, string> = {
  active: "Baustellen",
  future: "Ausstehend",
  archived: "Archiviert"
};
export function ConstructionSiteSidebar({
  sites,
  companyId,
  userId,
  currentFilter = "active",
  onFilterChange,
  hideFilterDropdown = false,
  onSiteClick,
  isSelectingMode = false,
  externalSearchQuery,
  onExternalSearchChange,
  showSearch = false,
}: ConstructionSiteSidebarProps) {
  const [editingSite, setEditingSite] = useState<ConstructionSite | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const isSearchActive = searchVisible || showSearch;
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = onExternalSearchChange || setInternalSearchQuery;

  // Fetch timeline progress for all sites
  const siteIds = sites.map(s => s.id);
  const { data: timelineProgress = {} } = useQuery({
    queryKey: ["sites-timeline-progress", siteIds.join(",")],
    queryFn: async () => {
      if (siteIds.length === 0) return {};

      const { data: timelines } = await supabase
        .from("construction_site_timelines")
        .select(`
          id,
          construction_site_id,
          construction_site_timeline_stages (
            id,
            is_completed
          )
        `)
        .in("construction_site_id", siteIds);

      const result: Record<string, { completed: number; total: number }> = {};
      timelines?.forEach(timeline => {
        const stages = timeline.construction_site_timeline_stages || [];
        result[timeline.construction_site_id] = {
          completed: stages.filter(s => s.is_completed).length,
          total: stages.length,
        };
      });
      return result;
    },
    enabled: siteIds.length > 0,
  });

  // Filter sites based on search query
  const filteredSites = sites.filter(site => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return site.customer_last_name.toLowerCase().includes(query) || site.address?.toLowerCase().includes(query) || site.customer_phone?.toLowerCase().includes(query);
  });
  const handleEditClick = (e: React.MouseEvent, site: ConstructionSite) => {
    e.stopPropagation();
    setEditingSite(site);
  };
  return <div className="flex flex-col h-full bg-card border-r">
      {!hideFilterDropdown && <div className="p-4 border-b">
           <div className="flex items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2 -ml-2 font-semibold text-lg hover:bg-accent">
                  <ChevronDown className="h-5 w-5" />
                  <span>{filterLabels[currentFilter]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onFilterChange?.("active")} className={currentFilter === "active" ? "bg-accent" : ""}>
                  Baustellen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFilterChange?.("future")} className={currentFilter === "future" ? "bg-accent" : ""}>
                  Ausstehend
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFilterChange?.("archived")} className={currentFilter === "archived" ? "bg-accent" : ""}>
                  Archiviert
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSearchVisible(v => !v);
                if (searchVisible) setSearchQuery("");
              }}
              className={searchVisible ? "text-primary" : ""}
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </div>}
      
      {/* Search bar - toggled via search icon */}
      {isSearchActive && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Baustelle suchen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8" autoFocus />
          </div>
        </div>
      )}

      {/* Add new site button */}
      <div className="px-2 pt-2">
        <Button size="sm" className="w-full h-7 text-xs font-semibold shadow-sm rounded-lg bg-orange-500 hover:bg-orange-600 text-black" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-3 w-3 mr-1" />
          Neue Baustelle
        </Button>
      </div>

      <ScrollArea className="flex-1 pb-16">
        <div className="p-2 space-y-0.5 divide-y divide-border/50">
          {isSelectingMode && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/30 mb-3">
              <p className="text-sm font-medium text-primary">Baustelle auswählen</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tippen Sie auf eine Baustelle, um sie dem Kalender hinzuzufügen
              </p>
            </div>
          )}
          {filteredSites.map(site => {
            // Simplified name-only view when search is active
            if (isSearchActive && searchQuery.trim()) {
              return (
                <button
                  key={site.id}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    if (onSiteClick) onSiteClick(site.id);
                  }}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{
                    backgroundColor: site.color || "hsl(var(--muted))"
                  }} />
                  <span className="text-xs font-medium truncate">{site.customer_last_name}</span>
                </button>
              );
            }

            return (
              <div
                key={site.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group relative ${
                  isSelectingMode 
                    ? "cursor-pointer hover:bg-primary/10 ring-1 ring-primary/20" 
                    : "hover:bg-accent/50"
                }`}
                onClick={() => {
                  if (isSelectingMode && onSiteClick) {
                    onSiteClick(site.id);
                  }
                }}
              >
                {/* Edit button - appears on hover (hidden in selection mode) */}
                {!isSelectingMode && (
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={e => handleEditClick(e, site)} className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90" title="Baustelle bearbeiten">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{
                  backgroundColor: site.color || "hsl(var(--muted))"
                }} />
                <span className="text-xs font-medium truncate">{site.customer_last_name}</span>
              </div>
            );
          })}
          
          {filteredSites.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">
              {searchQuery.trim() ? "Keine Baustellen gefunden" : `Keine ${filterLabels[currentFilter].toLowerCase()}`}
            </p>}
        </div>
      </ScrollArea>

      {/* Edit Dialog */}
      <ConstructionSiteEditDialog site={editingSite} open={!!editingSite} onOpenChange={open => !open && setEditingSite(null)} mode="edit" />

      {/* Create Dialog */}
      <ConstructionSiteEditDialog site={null} open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} mode="create" companyId={companyId} userId={userId} />
    </div>;
}