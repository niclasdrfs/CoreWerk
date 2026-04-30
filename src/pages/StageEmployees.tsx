import { useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useTabNavigate } from "@/hooks/useTabNavigate";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ArrowLeft, User, Calendar, CalendarDays } from "lucide-react";

interface Assignment {
  id: string;
  assignedAt: string;
  assignmentDate: string | null;
  notes: string | null;
  employeeName: string;
  employeeEmail: string;
  assignerName: string;
  dailyAssignmentId: string | null;
}

const StageEmployees = () => {
  const { siteId, stageId } = useParams<{ siteId: string; stageId: string }>();
  const navigate = useTabNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isOwnerRoute = location.pathname.startsWith("/owner");
  const goBack = () => isOwnerRoute ? navigate(`/owner/site/${siteId}`) : navigate(-1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["stage-employees", stageId],
    queryFn: async () => {
      if (!stageId || !user) throw new Error("Invalid request");

      // Get stage info
      const { data: stage, error: stageError } = await supabase
        .from("construction_site_timeline_stages")
        .select(`
          id,
          name,
          construction_site_timelines (
            construction_sites (
              id,
              customer_last_name
            )
          )
        `)
        .eq("id", stageId)
        .maybeSingle();

      if (stageError) throw stageError;
      if (!stage) throw new Error("Stufe nicht gefunden");

      // Get employee assignments for this stage
      const { data: assignments, error: assignmentsError } = await supabase
        .from("stage_employee_assignments")
        .select(`
          id,
          assigned_at,
          assignment_date,
          daily_assignment_id,
          notes,
          employee:profiles!stage_employee_assignments_employee_id_fkey (
            id,
            full_name,
            email
          ),
          assigner:profiles!stage_employee_assignments_assigned_by_fkey (
            id,
            full_name
          )
        `)
        .eq("stage_id", stageId)
        .order("assignment_date", { ascending: false, nullsFirst: false })
        .order("assigned_at", { ascending: false });

      if (assignmentsError) throw assignmentsError;

      const timeline = stage.construction_site_timelines as {
        construction_sites: { id: string; customer_last_name: string } | null;
      } | null;

      return {
        stageName: stage.name,
        siteName: timeline?.construction_sites?.customer_last_name || "Unbekannt",
        assignments: (assignments || []).map(a => ({
          id: a.id,
          assignedAt: a.assigned_at,
          assignmentDate: a.assignment_date,
          dailyAssignmentId: a.daily_assignment_id,
          notes: a.notes,
          employeeName: (a.employee as { full_name: string | null })?.full_name || "Unbekannt",
          employeeEmail: (a.employee as { email: string })?.email || "",
          assignerName: (a.assigner as { full_name: string | null })?.full_name || "System",
        })) as Assignment[],
      };
    },
    enabled: !!stageId && !!user,
  });

  // Group assignments by date
  const groupedAssignments = useMemo(() => {
    if (!data?.assignments) return new Map<string, Assignment[]>();
    
    const grouped = new Map<string, Assignment[]>();
    data.assignments.forEach(a => {
      const date = a.assignmentDate || a.assignedAt.split('T')[0];
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date)!.push(a);
    });
    return grouped;
  }, [data?.assignments]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
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
              <Button variant="ghost" size="sm" onClick={goBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="p-6">
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Stufe nicht gefunden"}
            </p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-background">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück zur Baustelle
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Header */}
          <div>
            <p className="text-sm text-muted-foreground mb-1">{data.siteName}</p>
            <h1 className="text-3xl font-bold text-foreground">
              Mitarbeiter-Zuweisungen
            </h1>
            <p className="text-lg text-muted-foreground mt-1">
              Stufe: {data.stageName}
            </p>
          </div>

          {/* Assignments List - Grouped by Date */}
          <Card className="p-6 space-y-6">
            <h2 className="font-semibold text-lg text-foreground">
              Zuweisungs-Verlauf
            </h2>

            {data.assignments.length === 0 ? (
              <div className="py-8 text-center">
                <User className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">
                  Noch keine Mitarbeiter dieser Stufe zugewiesen
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(groupedAssignments.entries()).map(([date, assignments]) => (
                  <div key={date} className="space-y-3">
                    {/* Date Header */}
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">
                        {formatDate(date)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({assignments.length} {assignments.length === 1 ? 'Mitarbeiter' : 'Mitarbeiter'})
                      </span>
                    </div>

                    {/* Employee cards for this date */}
                    <div className="space-y-2 pl-6">
                      {assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{assignment.employeeName}</p>
                              <p className="text-sm text-muted-foreground">
                                Erfasst von {assignment.assignerName}
                              </p>
                              {assignment.notes && (
                                <p className="text-sm text-muted-foreground mt-1 italic">
                                  "{assignment.notes}"
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {formatTime(assignment.assignedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StageEmployees;
