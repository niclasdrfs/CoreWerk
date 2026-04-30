import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSiteTimelines } from "@/hooks/useTimelineData";
import { ConstructionSiteHoursCard } from "./ConstructionSiteHoursCard";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Tag } from "lucide-react";
import { toast } from "sonner";
import type { SortOption } from "./SitesFilterToolbar";

interface EmployeeHours {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  totalHours: number;
  assignmentCount: number;
  hourlyWage: number | null;
  calculatedWage: number | null;
}

interface SiteData {
  id: string;
  name: string;
  color: string | null;
  employees: EmployeeHours[];
  totalHours: number;
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

interface TotalsSummary {
  totalHours: number;
  totalSites: number;
  totalEmployees: number;
  totalAssignments: number;
}

interface OwnerEmployeeHoursOverviewProps {
  categoryFilter: string | null;
  sortOption: SortOption;
  searchQuery: string;
}

export const OwnerEmployeeHoursOverview = ({
  categoryFilter,
  sortOption,
  searchQuery,
}: OwnerEmployeeHoursOverviewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["owner-sites-hours", user?.id],
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

      // Get all employees in company with wage info
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, hourly_wage, calculated_hourly_wage")
        .eq("company_id", profile.company_id);

      if (profilesError) throw profilesError;

      const employeesMap = new Map(
        profiles?.map((p) => [
          p.id,
          { 
            name: p.full_name, 
            email: p.email,
            hourlyWage: p.hourly_wage,
            calculatedWage: p.calculated_hourly_wage,
          },
        ]) || []
      );

      // Get all ACTIVE construction sites (not archived) with category
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
        .eq("status", "active");

      if (sitesError) throw sitesError;

      // Get all daily assignments with their times
      const { data: assignments, error: assignmentsError } = await supabase
        .from("daily_assignments")
        .select("id, construction_site_id, start_time, end_time")
        .eq("company_id", profile.company_id);

      if (assignmentsError) throw assignmentsError;

      // Get all employee assignments
      const { data: empAssignments, error: empAssignmentsError } =
        await supabase
          .from("employee_assignments")
          .select("employee_id, daily_assignment_id");

      if (empAssignmentsError) throw empAssignmentsError;

      // Create a map of daily_assignment_id -> assignment details
      const assignmentDetailsMap = new Map(
        assignments?.map((a) => [
          a.id,
          {
            siteId: a.construction_site_id,
            startTime: a.start_time,
            endTime: a.end_time,
          },
        ]) || []
      );

      // Calculate hours per site per employee
      const siteDataMap = new Map<
        string,
        Map<string, { hours: number; count: number }>
      >();

      let totalAssignmentCount = 0;

      empAssignments?.forEach((ea) => {
        const details = assignmentDetailsMap.get(ea.daily_assignment_id);
        if (!details) return;

        // Calculate hours for this assignment
        const startParts = details.startTime?.split(":").map(Number) || [
          8, 0,
        ];
        const endParts = details.endTime?.split(":").map(Number) || [17, 0];
        const hours =
          endParts[0] - startParts[0] + (endParts[1] - startParts[1]) / 60;

        if (!siteDataMap.has(details.siteId)) {
          siteDataMap.set(details.siteId, new Map());
        }

        const employeeMap = siteDataMap.get(details.siteId)!;
        if (!employeeMap.has(ea.employee_id)) {
          employeeMap.set(ea.employee_id, { hours: 0, count: 0 });
        }

        const empData = employeeMap.get(ea.employee_id)!;
        empData.hours += hours;
        empData.count += 1;
        totalAssignmentCount += 1;
      });

      // Build final site data
      const uniqueEmployees = new Set<string>();
      let grandTotalHours = 0;

      const siteData: SiteData[] = (constructionSites || [])
        .map((site) => {
          const employeeHoursMap = siteDataMap.get(site.id);
          const employees: EmployeeHours[] = [];
          let siteTotalHours = 0;

          if (employeeHoursMap) {
            employeeHoursMap.forEach((data, empId) => {
              const empInfo = employeesMap.get(empId);
              if (empInfo) {
                uniqueEmployees.add(empId);
                employees.push({
                  employeeId: empId,
                  employeeName: empInfo.name || "",
                  employeeEmail: empInfo.email,
                  totalHours: data.hours,
                  assignmentCount: data.count,
                  hourlyWage: empInfo.hourlyWage,
                  calculatedWage: empInfo.calculatedWage,
                });
                siteTotalHours += data.hours;
              }
            });
          }

          // Sort by hours descending
          employees.sort((a, b) => b.totalHours - a.totalHours);
          grandTotalHours += siteTotalHours;

          const category = site.construction_site_categories as { id: string; name: string } | null;
          
          return {
            id: site.id,
            name: site.customer_last_name,
            color: site.color,
            employees,
            totalHours: siteTotalHours,
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
        });

      const totals: TotalsSummary = {
        totalHours: grandTotalHours,
        totalSites: siteData.length,
        totalEmployees: uniqueEmployees.size,
        totalAssignments: totalAssignmentCount,
      };

      return { sites: siteData, totals };
    },
    enabled: !!user,
  });

  // Apply filtering and sorting
  const filteredAndSortedSites = useMemo(() => {
    let result = [...(data?.sites || [])];

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
        case "hours-desc":
          return b.totalHours - a.totalHours;
        case "hours-asc":
          return a.totalHours - b.totalHours;
        default:
          return 0;
      }
    });

    return result;
  }, [data?.sites, categoryFilter, searchQuery, sortOption]);

  // Batch fetch timeline data for all visible sites
  const siteIds = useMemo(
    () => filteredAndSortedSites.map((s) => s.id),
    [filteredAndSortedSites]
  );
  const { data: timelinesMap } = useSiteTimelines(siteIds);

  const handleArchiveSite = async (siteId: string) => {
    try {
      const { error } = await supabase
        .from("construction_sites")
        .update({ status: "archived" })
        .eq("id", siteId);

      if (error) throw error;

      toast.success("Baustelle wurde abgeschlossen und archiviert");
      queryClient.invalidateQueries({ queryKey: ["owner-sites-hours"] });
    } catch (err) {
      console.error("Error archiving site:", err);
      toast.error("Fehler beim Archivieren der Baustelle");
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
        
        // Delete employee_assignments
        await supabase
          .from("employee_assignments")
          .delete()
          .in("daily_assignment_id", assignmentIds);
        
        // Delete assignment_materials
        await supabase
          .from("assignment_materials")
          .delete()
          .in("daily_assignment_id", assignmentIds);
        
        // Delete assignment_packing_list
        await supabase
          .from("assignment_packing_list")
          .delete()
          .in("daily_assignment_id", assignmentIds);
        
        // Delete employee_material_todos
        await supabase
          .from("employee_material_todos")
          .delete()
          .in("daily_assignment_id", assignmentIds);
        
        // Delete employee_custom_todos
        await supabase
          .from("employee_custom_todos")
          .delete()
          .in("daily_assignment_id", assignmentIds);
        
        // Delete daily_assignments
        await supabase
          .from("daily_assignments")
          .delete()
          .eq("construction_site_id", siteId);
      }

      // Finally delete the construction site
      const { error } = await supabase
        .from("construction_sites")
        .delete()
        .eq("id", siteId);

      if (error) throw error;

      toast.success("Baustelle wurde gelöscht");
      queryClient.invalidateQueries({ queryKey: ["owner-sites-hours"] });
      queryClient.invalidateQueries({ queryKey: ["construction-sites"] });
    } catch (err) {
      console.error("Error deleting site:", err);
      toast.error("Fehler beim Löschen der Baustelle");
    }
  };

  // Group sites by category for display (only if no specific filter/sort applied)
  const useGrouping = !categoryFilter && !searchQuery.trim() && sortOption === "name-asc";
  
  const groupedSites = useMemo(() => {
    if (!useGrouping) return {};
    return filteredAndSortedSites.reduce((acc, site) => {
      const categoryKey = site.categoryName || "Ohne Kategorie";
      if (!acc[categoryKey]) {
        acc[categoryKey] = [];
      }
      acc[categoryKey].push(site);
      return acc;
    }, {} as Record<string, SiteData[]>);
  }, [filteredAndSortedSites, useGrouping]);

  // Sort category keys alphabetically, with "Ohne Kategorie" last
  const sortedCategories = useMemo(() => {
    return Object.keys(groupedSites).sort((a, b) => {
      if (a === "Ohne Kategorie") return 1;
      if (b === "Ohne Kategorie") return -1;
      return a.localeCompare(b);
    });
  }, [groupedSites]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
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

  const totals = data?.totals || {
    totalHours: 0,
    totalSites: 0,
    totalEmployees: 0,
    totalAssignments: 0,
  };

  if ((data?.sites || []).length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Keine aktiven Baustellen gefunden
      </p>
    );
  }

  if (filteredAndSortedSites.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Keine Baustellen entsprechen den Filterkriterien
      </p>
    );
  }

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
                  employees={site.employees}
                  totalHours={site.totalHours}
                  onArchive={handleArchiveSite}
                  onDelete={handleDeleteSite}
                  categoryId={site.categoryId}
                  categoryName={site.categoryName}
                  address={site.address}
                  phone={site.phone}
                  notes={site.notes}
                  startDate={site.startDate}
                  endDate={site.endDate}
                  status={site.status}
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
              employees={site.employees}
              totalHours={site.totalHours}
              onArchive={handleArchiveSite}
              onDelete={handleDeleteSite}
              categoryId={site.categoryId}
              categoryName={site.categoryName}
              address={site.address}
              phone={site.phone}
              notes={site.notes}
              startDate={site.startDate}
              endDate={site.endDate}
              status={site.status}
              timelineData={timelinesMap?.get(site.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
