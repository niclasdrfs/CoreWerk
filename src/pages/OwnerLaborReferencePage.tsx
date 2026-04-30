import { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useTabNavigate } from "@/hooks/useTabNavigate";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ArrowLeft,
  Building2,
  Clock,
  Euro,
  Home,
  Search,
  Tag,
  Users,
  X,
  ChevronRight,
  Check,
} from "lucide-react";
import { ownerAwarePath } from "@/lib/ownerRouting";

interface ArchivedSite {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  totalHours: number;
  laborCost: number;
  employeeCount: number;
  avgRate: number;
}

interface CategoryGroup {
  id: string;
  name: string;
  siteCount: number;
  totalHours: number;
  totalCost: number;
}

const formatHours = (h: number) => {
  if (h === 0) return "0h";
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
};

const fmt = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OwnerLaborReferencePage() {
  const { user } = useAuth();
  const navigate = useTabNavigate();
  const location = useLocation();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["archived-sites-labor-page", user?.id],
    queryFn: async (): Promise<ArchivedSite[]> => {
      if (!user) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.company_id) return [];

      const { data: archivedSites } = await supabase
        .from("construction_sites")
        .select(`
          id, customer_last_name, category_id,
          construction_site_categories ( id, name )
        `)
        .eq("company_id", profile.company_id)
        .eq("status", "archived")
        .order("customer_last_name");

      if (!archivedSites?.length) return [];

      const siteIds = archivedSites.map((s) => s.id);

      const { data: assignments } = await supabase
        .from("daily_assignments")
        .select("id, construction_site_id, start_time, end_time")
        .in("construction_site_id", siteIds);

      const assignmentIds = assignments?.map((a) => a.id) || [];

      const { data: empAssignments } = await supabase
        .from("employee_assignments")
        .select("employee_id, daily_assignment_id")
        .in("daily_assignment_id", assignmentIds.length > 0 ? assignmentIds : ["__none__"]);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, hourly_wage, calculated_hourly_wage")
        .eq("company_id", profile.company_id);

      const wageMap = new Map(
        profiles?.map((p) => [p.id, p.calculated_hourly_wage || p.hourly_wage || 0]) || []
      );

      const siteHours = new Map<string, number>();
      const siteCost = new Map<string, number>();
      const siteEmployees = new Map<string, Set<string>>();

      empAssignments?.forEach((ea) => {
        const assignment = assignments?.find((a) => a.id === ea.daily_assignment_id);
        if (!assignment) return;
        const start = assignment.start_time?.split(":").map(Number) || [8, 0];
        const end = assignment.end_time?.split(":").map(Number) || [17, 0];
        const hours = end[0] - start[0] + (end[1] - start[1]) / 60;
        const sid = assignment.construction_site_id;

        siteHours.set(sid, (siteHours.get(sid) || 0) + hours);
        const wage = wageMap.get(ea.employee_id) || 0;
        siteCost.set(sid, (siteCost.get(sid) || 0) + hours * wage);

        if (!siteEmployees.has(sid)) siteEmployees.set(sid, new Set());
        siteEmployees.get(sid)!.add(ea.employee_id);
      });

      return archivedSites.map((site) => {
        const cat = site.construction_site_categories as { id: string; name: string } | null;
        const totalHours = siteHours.get(site.id) || 0;
        const laborCost = siteCost.get(site.id) || 0;
        return {
          id: site.id,
          name: site.customer_last_name,
          categoryId: site.category_id,
          categoryName: cat?.name || null,
          totalHours,
          laborCost,
          employeeCount: siteEmployees.get(site.id)?.size || 0,
          avgRate: totalHours > 0 ? laborCost / totalHours : 0,
        };
      });
    },
    enabled: !!user,
  });

  // Build category groups
  const categoryGroups = useMemo((): CategoryGroup[] => {
    const map = new Map<string, CategoryGroup>();
    sites.forEach((site) => {
      const key = site.categoryId || "__none__";
      const name = site.categoryName || "Ohne Kategorie";
      if (!map.has(key)) {
        map.set(key, { id: key, name, siteCount: 0, totalHours: 0, totalCost: 0 });
      }
      const group = map.get(key)!;
      group.siteCount++;
      group.totalHours += site.totalHours;
      group.totalCost += site.laborCost;
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.id === "__none__") return 1;
      if (b.id === "__none__") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [sites]);

  // Current category sites
  const selectedCategory = categoryGroups.find((c) => c.id === selectedCategoryId);
  const categorySites = useMemo(() => {
    if (!selectedCategoryId) return [];
    let filtered = sites.filter((s) =>
      selectedCategoryId === "__none__"
        ? !s.categoryId
        : s.categoryId === selectedCategoryId
    );
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [sites, selectedCategoryId, searchQuery]);

  const handleSelectSite = (site: ArchivedSite) => {
    // Navigate back to rechner with query params
    const params = new URLSearchParams({
      lohnStunden: String(Math.round(site.totalHours * 10) / 10),
      lohnRate: String(Math.round(site.avgRate * 100) / 100),
      lohnRef: site.name,
    });
    navigate(ownerAwarePath(location.pathname, `/rechner?${params.toString()}`));
  };

  const handleBack = () => {
    if (selectedCategoryId) {
      setSelectedCategoryId(null);
      setSearchQuery("");
    } else {
      navigate(ownerAwarePath(location.pathname, "/rechner"));
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header with breadcrumb */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer flex items-center gap-1"
                onClick={() => navigate(ownerAwarePath(location.pathname, "/rechner"))}
              >
                <Home className="h-3.5 w-3.5" />
                Rechner
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {!selectedCategoryId ? (
              <BreadcrumbItem>
                <BreadcrumbPage>Lohnreferenz</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedCategoryId(null);
                      setSearchQuery("");
                    }}
                  >
                    Lohnreferenz
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{selectedCategory?.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          {selectedCategoryId ? selectedCategory?.name : "Lohnreferenz – Abgeschlossene Baustellen"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedCategoryId
            ? "Wähle eine Baustelle um Lohnwerte in den Rechner zu übernehmen"
            : "Abgeschlossene Baustellen nach Kategorie – tippe auf eine Kategorie"}
        </p>
      </div>

      {/* CATEGORY VIEW */}
      {!selectedCategoryId && (
        <>
          {categoryGroups.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Keine abgeschlossenen Baustellen vorhanden</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryGroups.map((group) => (
                <Card
                  key={group.id}
                  className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                  onClick={() => setSelectedCategoryId(group.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Tag className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{group.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {group.siteCount} Baustelle{group.siteCount !== 1 ? "n" : ""}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <Separator className="mb-3" />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatHours(group.totalHours)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Euro className="w-3.5 h-3.5" />
                        <span>{fmt(group.totalCost)} €</span>
                      </div>
                    </div>
                    {group.totalHours > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Ø {fmt(group.totalCost / group.totalHours)} €/h
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* SITE LIST VIEW */}
      {selectedCategoryId && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Baustelle suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* Summary bar */}
          {selectedCategory && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2.5">
              <span className="font-medium text-foreground">{selectedCategory.name}</span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {categorySites.length} Baustellen
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatHours(selectedCategory.totalHours)}
              </span>
              <span className="flex items-center gap-1">
                <Euro className="w-3 h-3" />
                {fmt(selectedCategory.totalCost)} €
              </span>
            </div>
          )}

          {/* Sites list */}
          {categorySites.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Keine Baustellen gefunden</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categorySites.map((site) => (
                <Card
                  key={site.id}
                  className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group"
                  onClick={() => handleSelectSite(site)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">{site.name}</h3>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            {site.totalHours > 0 ? (
                              <>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatHours(site.totalHours)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Euro className="w-3 h-3" />
                                  {fmt(site.laborCost)} €
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {site.employeeCount} MA
                                </span>
                              </>
                            ) : (
                              <span>Keine Stundeneinträge</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {site.totalHours > 0 && (
                          <Badge variant="outline" className="font-mono text-xs hidden sm:flex">
                            Ø {fmt(site.avgRate)} €/h
                          </Badge>
                        )}
                        <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center group-hover:border-primary group-hover:bg-primary/10 transition-colors">
                          <Check className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
