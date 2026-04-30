import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, Building2, Plus, Clock, Archive } from "lucide-react";
import { OwnerEmployeeHoursOverview } from "@/components/OwnerEmployeeHoursOverview";
import { OwnerArchivedSitesOverview } from "@/components/OwnerArchivedSitesOverview";
import { OwnerEmployeeManagement } from "@/components/OwnerEmployeeManagement";
import { OwnerPendingSitesOverview } from "@/components/OwnerPendingSitesOverview";
import { OwnerCustomersOverview } from "@/components/OwnerCustomersOverview";
import { ConstructionSiteEditDialog } from "@/components/ConstructionSiteEditDialog";
import { SitesFilterToolbar, SortOption } from "@/components/SitesFilterToolbar";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePrefetch } from "@/hooks/usePrefetch";

type ViewType = "employees" | "sites" | "customers";
type SitesSubView = "active" | "pending" | "archived";

const Owner = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [sitesSubView, setSitesSubView] = useState<SitesSubView>("active");
  const { prefetchAllData } = usePrefetch();
  
  // Filter & sort state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("name-asc");
  const [searchQuery, setSearchQuery] = useState("");

  // Get view from URL params
  const viewParam = searchParams.get("view") as ViewType | null;
  const activeView: ViewType = 
    viewParam === "employees" ? "employees" : 
    viewParam === "customers" ? "customers" : 
    "sites";

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

  // Fetch categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ["construction-site-categories", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("construction_site_categories")
        .select("id, name")
        .eq("company_id", profile.company_id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Prefetch ALL data immediately when profile is available
  useEffect(() => {
    if (profile?.company_id) {
      prefetchAllData(profile.company_id);
    }
  }, [profile?.company_id, prefetchAllData]);

  const getViewTitle = () => {
    if (activeView === "employees") {
      return "Mitarbeiter verwalten";
    }
    if (activeView === "customers") {
      return "Kunden verwalten";
    }
    switch (sitesSubView) {
      case "pending":
        return "Ausstehende Baustellen";
      case "archived":
        return "Abgeschlossene Baustellen";
      default:
        return "Aktive Baustellen";
    }
  };

  const getViewIcon = () => {
    if (activeView === "employees") return Users;
    if (activeView === "customers") return Users;
    switch (sitesSubView) {
      case "pending":
        return Clock;
      case "archived":
        return Archive;
      default:
        return Building2;
    }
  };

  const ViewIcon = getViewIcon();

  // Reset filters when changing sub-view
  const handleSubViewChange = (view: SitesSubView) => {
    setSitesSubView(view);
    setSelectedCategoryId(null);
    setSearchQuery("");
  };

  // Customers view has its own layout
  if (activeView === "customers") {
    return (
      <div className="flex-1 min-h-screen bg-background overflow-x-hidden">
        <header className="border-b border-border bg-card safe-top">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-semibold flex-1">Chef-Übersicht</h1>
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-accent" />
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <OwnerCustomersOverview />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-background overflow-x-hidden">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold flex-1">Chef-Übersicht</h1>
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <ViewIcon className="w-5 h-5 text-accent" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {activeView === "employees" ? "Angestellte" : "Baustellen"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {getViewTitle()}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {activeView === "sites" && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="gap-2"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Neue Baustelle</span>
                </Button>
              )}
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <ViewIcon className="w-5 h-5 md:w-6 md:h-6 text-accent" />
              </div>
            </div>
          </div>

          {/* Sites sub-navigation */}
          {activeView === "sites" && (
            <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
              <button
                onClick={() => handleSubViewChange("active")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  sitesSubView === "active" 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="w-4 h-4" />
                Aktiv
              </button>
              <button
                onClick={() => handleSubViewChange("pending")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  sitesSubView === "pending" 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="w-4 h-4" />
                Ausstehend
              </button>
              <button
                onClick={() => handleSubViewChange("archived")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  sitesSubView === "archived" 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Archive className="w-4 h-4" />
                Archiv
              </button>
            </div>
          )}

          {/* Filter Toolbar for sites */}
          {activeView === "sites" && (
            <SitesFilterToolbar
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onCategoryChange={setSelectedCategoryId}
              sortOption={sortOption}
              onSortChange={setSortOption}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              showHoursSort={sitesSubView !== "pending"}
            />
          )}

          {/* Content based on active view */}
          {activeView === "employees" ? (
            <OwnerEmployeeManagement />
          ) : sitesSubView === "archived" ? (
            <OwnerArchivedSitesOverview
              categoryFilter={selectedCategoryId}
              sortOption={sortOption}
              searchQuery={searchQuery}
            />
          ) : sitesSubView === "pending" ? (
            <OwnerPendingSitesOverview
              categoryFilter={selectedCategoryId}
              sortOption={sortOption}
              searchQuery={searchQuery}
            />
          ) : (
            <OwnerEmployeeHoursOverview
              categoryFilter={selectedCategoryId}
              sortOption={sortOption}
              searchQuery={searchQuery}
            />
          )}
        </div>
      </main>

      {/* Create Construction Site Dialog */}
      <ConstructionSiteEditDialog
        site={null}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        mode="create"
        companyId={profile?.company_id || undefined}
        userId={user?.id}
      />
    </div>
  );
};

export default Owner;
