import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConstructionSiteHoursCard } from "./ConstructionSiteHoursCard";
import { useSiteTimelines } from "@/hooks/useTimelineData";
import { Clock, Building2, Users, Calendar, AlertCircle, Tag } from "lucide-react";
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
  siteId: string;
  siteName: string;
  siteColor: string | null;
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

interface OwnerArchivedSitesOverviewProps {
  categoryFilter: string | null;
  sortOption: SortOption;
  searchQuery: string;
}

export const OwnerArchivedSitesOverview = ({
  categoryFilter,
  sortOption,
  searchQuery,
}: OwnerArchivedSitesOverviewProps) => {
  const [sites, setSites] = useState<SiteData[]>([]);
  const [totals, setTotals] = useState<TotalsSummary>({
    totalHours: 0,
    totalSites: 0,
    totalEmployees: 0,
    totalAssignments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("Benutzer nicht gefunden");
      }

      // Get user's company_id from profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userData.user.id)
        .single();

      if (profileError || !profile?.company_id) {
        throw new Error("Firmenprofil nicht gefunden");
      }

      // Get all employees in the company with wage info
      const { data: employees, error: employeesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, hourly_wage, calculated_hourly_wage")
        .eq("company_id", profile.company_id);

      if (employeesError) {
        throw new Error("Mitarbeiter konnten nicht geladen werden");
      }

      // Get all ARCHIVED construction sites for the company with category info
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
          construction_site_categories(name)
        `)
        .eq("company_id", profile.company_id)
        .eq("status", "archived");

      if (sitesError) {
        throw new Error("Baustellen konnten nicht geladen werden");
      }

      if (!constructionSites || constructionSites.length === 0) {
        setSites([]);
        setTotals({
          totalHours: 0,
          totalSites: 0,
          totalEmployees: 0,
          totalAssignments: 0,
        });
        setLoading(false);
        return;
      }

      // Get all daily assignments for the archived sites
      const siteIds = constructionSites.map((site) => site.id);
      const { data: assignments, error: assignmentsError } = await supabase
        .from("daily_assignments")
        .select("id, construction_site_id, start_time, end_time")
        .in("construction_site_id", siteIds);

      if (assignmentsError) {
        throw new Error("Zuweisungen konnten nicht geladen werden");
      }

      // Get all employee assignments
      const assignmentIds = assignments?.map((a) => a.id) || [];
      const { data: empAssignments, error: empAssignmentsError } = await supabase
        .from("employee_assignments")
        .select("employee_id, daily_assignment_id")
        .in("daily_assignment_id", assignmentIds);

      if (empAssignmentsError) {
        throw new Error("Mitarbeiter-Zuweisungen konnten nicht geladen werden");
      }

      // Create employee lookup map
      const employeeMap = new Map(
        employees?.map((emp) => [
          emp.id,
          {
            name: emp.full_name || "Unbekannt",
            email: emp.email || "",
            hourlyWage: emp.hourly_wage,
            calculatedWage: emp.calculated_hourly_wage,
          },
        ]) || []
      );

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
      const siteDataMap = new Map<string, Map<string, { hours: number; count: number }>>();
      const uniqueEmployees = new Set<string>();
      let totalAssignments = 0;

      empAssignments?.forEach((ea) => {
        const details = assignmentDetailsMap.get(ea.daily_assignment_id);
        if (!details) return;

        // Calculate hours for this assignment
        const startParts = details.startTime?.split(":").map(Number) || [8, 0];
        const endParts = details.endTime?.split(":").map(Number) || [17, 0];
        const hours = endParts[0] - startParts[0] + (endParts[1] - startParts[1]) / 60;

        if (!siteDataMap.has(details.siteId)) {
          siteDataMap.set(details.siteId, new Map());
        }

        const employeeHoursMap = siteDataMap.get(details.siteId)!;
        if (!employeeHoursMap.has(ea.employee_id)) {
          employeeHoursMap.set(ea.employee_id, { hours: 0, count: 0 });
        }

        const empData = employeeHoursMap.get(ea.employee_id)!;
        empData.hours += hours;
        empData.count += 1;
        
        uniqueEmployees.add(ea.employee_id);
        totalAssignments += 1;
      });

      // Build final site data
      let overallTotalHours = 0;

      const sitesArray: SiteData[] = constructionSites.map((site) => {
        const employeeHoursMap = siteDataMap.get(site.id);
        const employeesList: EmployeeHours[] = [];
        let siteTotalHours = 0;

        if (employeeHoursMap) {
          employeeHoursMap.forEach((data, empId) => {
            const empInfo = employeeMap.get(empId);
            if (empInfo) {
              employeesList.push({
                employeeId: empId,
                employeeName: empInfo.name,
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

        // Sort employees by hours (descending)
        employeesList.sort((a, b) => b.totalHours - a.totalHours);
        overallTotalHours += siteTotalHours;

        const categoryData = site.construction_site_categories as { name: string } | null;
        
        return {
          siteId: site.id,
          siteName: site.customer_last_name,
          siteColor: site.color,
          employees: employeesList,
          totalHours: siteTotalHours,
          categoryId: site.category_id,
          categoryName: categoryData?.name || null,
          createdAt: site.created_at,
          address: site.address,
          phone: site.customer_phone,
          notes: site.notes,
          startDate: site.start_date,
          endDate: site.end_date,
          status: site.status,
        };
      });

      // Sort sites by category (nulls last), then by total hours within each category
      sitesArray.sort((a, b) => {
        // First sort by category name (nulls/uncategorized last)
        if (a.categoryName === null && b.categoryName !== null) return 1;
        if (a.categoryName !== null && b.categoryName === null) return -1;
        if (a.categoryName !== b.categoryName) {
          return (a.categoryName || '').localeCompare(b.categoryName || '');
        }
        // Within same category, sort by hours (descending)
        return b.totalHours - a.totalHours;
      });

      setSites(sitesArray);
      setTotals({
        totalHours: overallTotalHours,
        totalSites: constructionSites.length,
        totalEmployees: uniqueEmployees.size,
        totalAssignments,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  };

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
      result = result.filter((s) => s.siteName.toLowerCase().includes(query));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case "name-asc":
          return a.siteName.localeCompare(b.siteName);
        case "name-desc":
          return b.siteName.localeCompare(a.siteName);
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
  }, [sites, categoryFilter, searchQuery, sortOption]);

  // Batch fetch timeline data for all visible sites
  const siteIds = useMemo(
    () => filteredAndSortedSites.map((s) => s.siteId),
    [filteredAndSortedSites]
  );
  const { data: timelinesMap } = useSiteTimelines(siteIds);

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
        <AlertCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Keine archivierten Baustellen gefunden.</p>
      </Card>
    );
  }

  if (filteredAndSortedSites.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Keine Baustellen entsprechen den Filterkriterien.</p>
      </Card>
    );
  }

  // Group filtered sites by category for display (only if no specific filter/sort applied)
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
      {/* Sites grouped by category (default) or flat list (when filtered/sorted) */}
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
                  key={site.siteId}
                  siteId={site.siteId}
                  siteName={site.siteName}
                  siteColor={site.siteColor}
                  employees={site.employees}
                  totalHours={site.totalHours}
                  categoryId={site.categoryId}
                  categoryName={site.categoryName}
                  address={site.address}
                  phone={site.phone}
                  notes={site.notes}
                  startDate={site.startDate}
                  endDate={site.endDate}
                  status={site.status}
                  isArchived={true}
                  timelineData={timelinesMap?.get(site.siteId)}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredAndSortedSites.map((site) => (
            <ConstructionSiteHoursCard
              key={site.siteId}
              siteId={site.siteId}
              siteName={site.siteName}
              siteColor={site.siteColor}
              employees={site.employees}
              totalHours={site.totalHours}
              categoryId={site.categoryId}
              categoryName={site.categoryName}
              address={site.address}
              phone={site.phone}
              notes={site.notes}
              startDate={site.startDate}
              endDate={site.endDate}
              status={site.status}
              isArchived={true}
              timelineData={timelinesMap?.get(site.siteId)}
            />
          ))}
        </div>
      )}

      {/* Summary card */}
      <Card className="p-6 bg-accent/5 border-accent/20">
        <h3 className="font-semibold text-foreground mb-4">Archiv Zusammenfassung</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatHours(totals.totalHours)}</p>
              <p className="text-xs text-muted-foreground">Gesamtstunden</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totals.totalSites}</p>
              <p className="text-xs text-muted-foreground">Archivierte Baustellen</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totals.totalEmployees}</p>
              <p className="text-xs text-muted-foreground">Mitarbeiter</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totals.totalAssignments}</p>
              <p className="text-xs text-muted-foreground">Einsätze</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
