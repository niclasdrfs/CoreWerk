import { useLocation, useParams } from "react-router-dom";
import { useTabNavigate } from "@/hooks/useTabNavigate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSiteTimeline, useCreateSiteTimeline, useUpdateStageCompletion, useTimelineTemplates } from "@/hooks/useTimelineData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SiteCategoryDropdown } from "@/components/SiteCategoryDropdown";
import { InteractiveSiteDetailTimeline } from "@/components/timeline/InteractiveSiteDetailTimeline";
import { SiteQuotesCard } from "@/components/calculator/SiteQuotesCard";
import { SiteParametersCard } from "@/components/SiteParametersCard";
import { SiteProductsCard } from "@/components/SiteProductsCard";
import { ProjectInsightsCard } from "@/components/ProjectInsightsCard";
import { TimelineTemplateManager } from "@/components/timeline/TimelineTemplateManager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  MapPin,
  User,
  Clock,
  Euro,
  CheckCircle,
  Play,
  Trash2,
  Calendar,
  Phone,
  FileText,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { ownerAwarePath } from "@/lib/ownerRouting";

interface EmployeeHours {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  totalHours: number;
  assignmentCount: number;
  hourlyWage: number | null;
  calculatedWage: number | null;
}

const OwnerSiteDetail = () => {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useTabNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  // Timeline hooks
  const { data: siteTimeline, isLoading: timelineLoading } = useSiteTimeline(siteId);
  const createTimeline = useCreateSiteTimeline();
  const updateStage = useUpdateStageCompletion();

  const { data, isLoading, error } = useQuery({
    queryKey: ["owner-site-detail", siteId],
    queryFn: async () => {
      if (!siteId || !user) throw new Error("Invalid request");

      // Get user's company
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error("Keine Firma gefunden");
      }

      // Get construction site details
      const { data: site, error: siteError } = await supabase
        .from("construction_sites")
        .select(`
          id,
          customer_last_name,
          color,
          status,
          address,
          customer_phone,
          notes,
          start_date,
          end_date,
          created_at,
          category_id,
          construction_site_categories (
            id,
            name
          )
        `)
        .eq("id", siteId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (siteError) throw siteError;
      if (!site) throw new Error("Baustelle nicht gefunden");

      // Get all employees in company with wage info
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, hourly_wage, calculated_hourly_wage")
        .eq("company_id", profile.company_id);

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

      // Get daily assignments for this site
      const { data: assignments } = await supabase
        .from("daily_assignments")
        .select("id, start_time, end_time")
        .eq("construction_site_id", siteId);

      // Get employee assignments
      const assignmentIds = assignments?.map((a) => a.id) || [];
      const { data: empAssignments } = await supabase
        .from("employee_assignments")
        .select("employee_id, daily_assignment_id")
        .in("daily_assignment_id", assignmentIds);

      // Create assignment details map
      const assignmentDetailsMap = new Map(
        assignments?.map((a) => [
          a.id,
          { startTime: a.start_time, endTime: a.end_time },
        ]) || []
      );

      // Calculate hours per employee
      const employeeHoursMap = new Map<string, { hours: number; count: number }>();

      empAssignments?.forEach((ea) => {
        const details = assignmentDetailsMap.get(ea.daily_assignment_id);
        if (!details) return;

        const startParts = details.startTime?.split(":").map(Number) || [8, 0];
        const endParts = details.endTime?.split(":").map(Number) || [17, 0];
        const hours = endParts[0] - startParts[0] + (endParts[1] - startParts[1]) / 60;

        if (!employeeHoursMap.has(ea.employee_id)) {
          employeeHoursMap.set(ea.employee_id, { hours: 0, count: 0 });
        }

        const empData = employeeHoursMap.get(ea.employee_id)!;
        empData.hours += hours;
        empData.count += 1;
      });

      // Build employee list
      const employees: EmployeeHours[] = [];
      let totalHours = 0;

      employeeHoursMap.forEach((data, empId) => {
        const empInfo = employeesMap.get(empId);
        if (empInfo) {
          employees.push({
            employeeId: empId,
            employeeName: empInfo.name || "Unbekannt",
            employeeEmail: empInfo.email,
            totalHours: data.hours,
            assignmentCount: data.count,
            hourlyWage: empInfo.hourlyWage,
            calculatedWage: empInfo.calculatedWage,
          });
          totalHours += data.hours;
        }
      });

      employees.sort((a, b) => b.totalHours - a.totalHours);

      const category = site.construction_site_categories as { id: string; name: string } | null;

      return {
        site: {
          id: site.id,
          name: site.customer_last_name,
          color: site.color,
          status: site.status,
          address: site.address,
          phone: site.customer_phone,
          notes: site.notes,
          startDate: site.start_date,
          endDate: site.end_date,
          createdAt: site.created_at,
          categoryId: site.category_id,
          categoryName: category?.name || null,
        },
        employees,
        totalHours,
      };
    },
    enabled: !!siteId && !!user,
  });

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("de-DE");
  };

  const calculateEmployeeCost = (employee: EmployeeHours) => {
    const wage = employee.calculatedWage || employee.hourlyWage;
    if (!wage) return null;
    return employee.totalHours * wage;
  };

  const totalLaborCost = (data?.employees || []).reduce((sum, emp) => {
    const cost = calculateEmployeeCost(emp);
    return sum + (cost || 0);
  }, 0);

  const hasWageData = (data?.employees || []).some(
    (emp) => emp.hourlyWage !== null || emp.calculatedWage !== null
  );

  const handleArchive = async () => {
    if (!siteId) return;
    try {
      const { error } = await supabase
        .from("construction_sites")
        .update({ status: "archived" })
        .eq("id", siteId);

      if (error) throw error;

      toast.success("Baustelle wurde abgeschlossen und archiviert");
      queryClient.invalidateQueries({ queryKey: ["owner-sites-hours"] });
      queryClient.invalidateQueries({ queryKey: ["owner-site-detail", siteId] });
      navigate(ownerAwarePath(location.pathname, "/?view=sites"));
    } catch (err) {
      console.error("Error archiving site:", err);
      toast.error("Fehler beim Archivieren der Baustelle");
    }
  };

  const handleActivate = async () => {
    if (!siteId) return;
    try {
      const { error } = await supabase
        .from("construction_sites")
        .update({ status: "active" })
        .eq("id", siteId);

      if (error) throw error;

      toast.success("Baustelle wurde aktiviert");
      queryClient.invalidateQueries({ queryKey: ["owner-pending-sites"] });
      queryClient.invalidateQueries({ queryKey: ["owner-site-detail", siteId] });
    } catch (err) {
      console.error("Error activating site:", err);
      toast.error("Fehler beim Aktivieren der Baustelle");
    }
  };

  const handleDelete = async () => {
    if (!siteId) return;
    try {
      const { data: assignments } = await supabase
        .from("daily_assignments")
        .select("id")
        .eq("construction_site_id", siteId);

      if (assignments && assignments.length > 0) {
        const assignmentIds = assignments.map((a) => a.id);
        await supabase.from("employee_assignments").delete().in("daily_assignment_id", assignmentIds);
        await supabase.from("assignment_materials").delete().in("daily_assignment_id", assignmentIds);
        await supabase.from("assignment_packing_list").delete().in("daily_assignment_id", assignmentIds);
        await supabase.from("employee_material_todos").delete().in("daily_assignment_id", assignmentIds);
        await supabase.from("employee_custom_todos").delete().in("daily_assignment_id", assignmentIds);
        await supabase.from("daily_assignments").delete().eq("construction_site_id", siteId);
      }

      const { error } = await supabase.from("construction_sites").delete().eq("id", siteId);

      if (error) throw error;

      toast.success("Baustelle wurde gelöscht");
      queryClient.invalidateQueries({ queryKey: ["owner-sites-hours"] });
      queryClient.invalidateQueries({ queryKey: ["owner-pending-sites"] });
      navigate(ownerAwarePath(location.pathname, "/?view=sites"));
    } catch (err) {
      console.error("Error deleting site:", err);
      toast.error("Fehler beim Löschen der Baustelle");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 min-h-screen bg-background">
        <header className="border-b border-border bg-card safe-top">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <Skeleton className="h-6 w-48" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 min-h-screen bg-background">
        <header className="border-b border-border bg-card safe-top">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <Button variant="ghost" size="sm" onClick={() => navigate(ownerAwarePath(location.pathname, "/?view=sites"))}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="p-6">
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Baustelle nicht gefunden"}
            </p>
          </Card>
        </main>
      </div>
    );
  }

  const { site, employees, totalHours } = data;
  const isPending = site.status === "future";
  const isArchived = site.status === "archived";
  const isActive = site.status === "active";

  return (
    <div className="flex-1 min-h-screen bg-background">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <Button variant="ghost" size="sm" onClick={() => navigate(ownerAwarePath(location.pathname, "/?view=sites"))}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
            <div className="flex-1" />
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: data.site.color ? `${data.site.color}20` : "hsl(var(--accent) / 0.1)",
              }}
            >
              <MapPin
                className="w-5 h-5"
                style={{ color: data.site.color || "hsl(var(--accent))" }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{site.name}</h1>
                <SiteCategoryDropdown
                  siteId={site.id}
                  currentCategoryId={site.categoryId}
                  currentCategoryName={site.categoryName}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isPending && "Ausstehend"}
                {isActive && "Aktiv"}
                {isArchived && "Archiviert"}
              </p>
            </div>

            {/* Action Buttons */}
            {!isArchived && (
              <div className="flex gap-2">
                {isPending && (
                  <Button onClick={handleActivate} size="sm" className="gap-2">
                    <Play className="w-4 h-4" />
                    Aktivieren
                  </Button>
                )}
                {isActive && (
                  <Button variant="outline" size="sm" onClick={handleArchive} className="gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Abschließen
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Baustelle löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Diese Aktion kann nicht rückgängig gemacht werden. Die Baustelle "{site.name}" 
                        und alle zugehörigen Zuweisungen werden dauerhaft gelöscht.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Endgültig löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {/* Stat Cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-tight">{formatHours(totalHours)}</p>
                <p className="text-xs text-muted-foreground">Stunden</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
              <User className="w-4 h-4 text-accent shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-tight">{employees.length}</p>
                <p className="text-xs text-muted-foreground">Mitarbeiter</p>
              </div>
            </div>

            {hasWageData && totalLaborCost > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                <Euro className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-lg font-bold text-foreground leading-tight">{formatCurrency(totalLaborCost)}</p>
                  <p className="text-xs text-muted-foreground">Lohnkosten</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">
                  {formatDate(site.createdAt) || "-"}
                </p>
                <p className="text-xs text-muted-foreground">Erstellt</p>
              </div>
            </div>
          </div>

          {/* Site Details */}
          {(site.address || site.phone || site.notes) && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Details</h2>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {site.address && (
                  <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Adresse</p>
                      <p className="text-sm text-foreground">{site.address}</p>
                    </div>
                  </div>
                )}
                {site.phone && (
                  <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Telefon</p>
                      <a href={`tel:${site.phone}`} className="text-sm text-foreground hover:text-primary transition-colors">{site.phone}</a>
                    </div>
                  </div>
                )}
                {site.notes && (
                  <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30 md:col-span-2">
                    <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Notizen</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{site.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Site Parameters / Dimensions */}
          <SiteParametersCard siteId={site.id} categoryId={site.categoryId} />

          {/* Products & Material */}
          <SiteProductsCard siteId={site.id} />

          {/* Project Insights */}
          <ProjectInsightsCard
            siteId={site.id}
            totalHours={totalHours}
            totalLaborCost={totalLaborCost}
            employeeCount={employees.length}
          />

          {/* Site Quotes/Calculations */}
          <SiteQuotesCard siteId={site.id} />

          {/* Project Timeline */}
          <Card className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Projekt-Zeitstrahl</h2>
              <div className="flex items-center gap-2">
                {!siteTimeline && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => setShowTemplateManager(!showTemplateManager)}
                  >
                    <Layers className="w-4 h-4" />
                    Erstellen
                  </Button>
                )}
                <Layers className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {showTemplateManager && !siteTimeline && (
              <TimelineTemplateManager
                categoryId={site.categoryId}
                onSelectTemplate={(template) => {
                  if (siteId) {
                    createTimeline.mutate({
                      siteId,
                      templateId: template.id,
                    });
                    setShowTemplateManager(false);
                  }
                }}
              />
            )}

            {siteTimeline ? (
              <InteractiveSiteDetailTimeline
                stages={siteTimeline.stages}
                currentStageIndex={siteTimeline.currentStageIndex}
                siteId={site.id}
                onToggleComplete={(stageId, isCompleted) => {
                  updateStage.mutate({ stageId, isCompleted, siteId: site.id });
                }}
                isUpdating={updateStage.isPending}
              />
            ) : (
              <div className="py-6 text-center">
                <Layers className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Noch kein Zeitstrahl konfiguriert
                </p>
              </div>
            )}
          </Card>

          {/* Employee Hours */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Mitarbeiter & Stunden</h2>
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            {employees.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Keine Mitarbeiter-Zuweisungen gefunden
              </p>
            ) : (
              <div className="space-y-1.5">
                {employees.map((employee) => {
                  const employeeCost = calculateEmployeeCost(employee);
                  const wage = employee.calculatedWage || employee.hourlyWage;

                  return (
                    <div
                      key={employee.employeeId}
                      className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{employee.employeeName}</p>
                          {wage && (
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(wage)}/h
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{employee.assignmentCount} Einsätze</span>
                          <span className="font-semibold text-sm text-foreground">
                            {formatHours(employee.totalHours)}
                          </span>
                        </div>
                        {employeeCost !== null && (
                          <span className="text-xs font-medium text-primary">
                            {formatCurrency(employeeCost)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default OwnerSiteDetail;
