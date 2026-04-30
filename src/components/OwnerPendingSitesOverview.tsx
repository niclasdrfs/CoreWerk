import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSiteTimelines } from "@/hooks/useTimelineData";
import { ConstructionSiteHoursCard } from "./ConstructionSiteHoursCard";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock, Tag } from "lucide-react";
import { toast } from "sonner";
import type { SortOption } from "./SitesFilterToolbar";

interface SiteData {
  id: string;
  name: string;
  color: string | null;
  categoryId: string | null;
  categoryName: string | null;
  createdAt: string;
  address: string | null;
  phone: string | null;
  notes: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

interface OwnerPendingSitesOverviewProps {
  categoryFilter: string | null;
  sortOption: SortOption;
  searchQuery: string;
}

export const OwnerPendingSitesOverview = ({
  categoryFilter,
  sortOption,
  searchQuery,
}: OwnerPendingSitesOverviewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: sites = [], isLoading, error } = useQuery({
    queryKey: ["owner-pending-sites", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Get user's company
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error("Keine Firma gefunden");
      }

      // Get all pending (future) construction sites
      const { data: constructionSites, error: sitesError } = await supabase
        .from("construction_sites")
        .select(`
          id, 
          customer_last_name, 
          color, 
          category_id,
          created_at,
          address,
          customer_phone,
          notes,
          start_date,
          end_date,
          status,
          construction_site_categories (
            id,
            name
          )
        `)
        .eq("company_id", profile.company_id)
        .eq("status", "future")
        .order("customer_last_name");

      if (sitesError) throw sitesError;

      return (constructionSites || []).map((site) => {
        const category = site.construction_site_categories as { id: string; name: string } | null;
        return {
          id: site.id,
          name: site.customer_last_name,
          color: site.color,
          categoryId: site.category_id,
          categoryName: category?.name || null,
          createdAt: site.created_at,
          address: site.address,
          phone: site.customer_phone,
          notes: site.notes,
          startDate: site.start_date,
          endDate: site.end_date,
          status: site.status,
        };
      }) as SiteData[];
    },
    enabled: !!user,
  });

  // Apply filtering and sorting
  const filteredAndSortedSites = useMemo(() => {
    let result = [...sites];

    // Filter by category
    if (categoryFilter === "uncategorized") {
      result = result.filter((s) => !s.categoryId);
    } else if (categoryFilter) {
      result = result.filter((s) => s.categoryId === categoryFilter);
    }

    // Filter by search query
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(query));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "created-asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "created-desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [sites, categoryFilter, searchQuery, sortOption]);

  // Batch fetch timeline data for all visible sites
  const siteIds = useMemo(
    () => filteredAndSortedSites.map((s) => s.id),
    [filteredAndSortedSites]
  );
  const { data: timelinesMap } = useSiteTimelines(siteIds);

  const handleActivateSite = async (siteId: string) => {
    try {
      const { error } = await supabase
        .from("construction_sites")
        .update({ status: "active" })
        .eq("id", siteId);

      if (error) throw error;

      toast.success("Baustelle wurde aktiviert");
      queryClient.invalidateQueries({ queryKey: ["owner-pending-sites"] });
      queryClient.invalidateQueries({ queryKey: ["owner-sites-hours"] });
    } catch (err) {
      console.error("Error activating site:", err);
      toast.error("Fehler beim Aktivieren der Baustelle");
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    try {
      // First delete related daily_assignments and their dependencies
      const { data: assignments } = await supabase
        .from("daily_assignments")
        .select("id")
        .eq("construction_site_id", siteId);

      if (assignments && assignments.length > 0) {
        const assignmentIds = assignments.map(a => a.id);
        
        await supabase.from("employee_assignments").delete().in("daily_assignment_id", assignmentIds);
        await supabase.from("assignment_materials").delete().in("daily_assignment_id", assignmentIds);
        await supabase.from("assignment_packing_list").delete().in("daily_assignment_id", assignmentIds);
        await supabase.from("employee_material_todos").delete().in("daily_assignment_id", assignmentIds);
        await supabase.from("employee_custom_todos").delete().in("daily_assignment_id", assignmentIds);
        await supabase.from("daily_assignments").delete().eq("construction_site_id", siteId);
      }

      const { error } = await supabase
        .from("construction_sites")
        .delete()
        .eq("id", siteId);

      if (error) throw error;

      toast.success("Baustelle wurde gelöscht");
      queryClient.invalidateQueries({ queryKey: ["owner-pending-sites"] });
    } catch (err) {
      console.error("Error deleting site:", err);
      toast.error("Fehler beim Löschen der Baustelle");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
        <AlertCircle className="w-5 h-5" />
        <span>{error instanceof Error ? error.message : "Fehler beim Laden der Daten"}</span>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          Keine ausstehenden Baustellen gefunden
        </p>
      </div>
    );
  }

  if (filteredAndSortedSites.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          Keine Baustellen entsprechen den Filterkriterien
        </p>
      </div>
    );
  }

  // Group sites by category for display (only if no specific filter/sort applied)
  const useGrouping = !categoryFilter && !searchQuery.trim() && sortOption === "name-asc";
  
  const groupedSites = useGrouping
    ? filteredAndSortedSites.reduce((acc, site) => {
        const categoryKey = site.categoryName || "Ohne Kategorie";
        if (!acc[categoryKey]) {
          acc[categoryKey] = [];
        }
        acc[categoryKey].push(site);
        return acc;
      }, {} as Record<string, SiteData[]>)
    : {};

  // Sort category keys alphabetically, with "Ohne Kategorie" last
  const sortedCategories = Object.keys(groupedSites).sort((a, b) => {
    if (a === "Ohne Kategorie") return 1;
    if (b === "Ohne Kategorie") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      {useGrouping ? (
        sortedCategories.map((categoryName) => (
          <div key={categoryName} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="w-4 h-4" />
              {categoryName}
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                {groupedSites[categoryName].length}
              </span>
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {groupedSites[categoryName].map((site) => (
                <ConstructionSiteHoursCard
                  key={site.id}
                  siteId={site.id}
                  siteName={site.name}
                  siteColor={site.color}
                  employees={[]}
                  totalHours={0}
                  onActivate={handleActivateSite}
                  onDelete={handleDeleteSite}
                  categoryId={site.categoryId}
                  categoryName={site.categoryName}
                  address={site.address}
                  phone={site.phone}
                  notes={site.notes}
                  startDate={site.startDate}
                  endDate={site.endDate}
                  status={site.status}
                  isPending
                  timelineData={timelinesMap?.get(site.id)}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredAndSortedSites.map((site) => (
            <ConstructionSiteHoursCard
              key={site.id}
              siteId={site.id}
              siteName={site.name}
              siteColor={site.color}
              employees={[]}
              totalHours={0}
              onActivate={handleActivateSite}
              onDelete={handleDeleteSite}
              categoryId={site.categoryId}
              categoryName={site.categoryName}
              address={site.address}
              phone={site.phone}
              notes={site.notes}
              startDate={site.startDate}
              endDate={site.endDate}
              status={site.status}
              isPending
              timelineData={timelinesMap?.get(site.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
