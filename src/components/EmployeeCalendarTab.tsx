import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowLeft, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, addWeeks, addDays, isThisWeek, eachDayOfInterval, endOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarWeekView } from "@/components/CalendarWeekView";
import { ConstructionSiteSidebar } from "@/components/ConstructionSiteSidebar";
import { EmployeeSidebar } from "@/components/EmployeeSidebar";
import { AssignmentPickerDialog } from "@/components/AssignmentPickerDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ExcavatorIcon } from "@/components/icons/ExcavatorIcon";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

export const EmployeeCalendarTab = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [weekOffset, setWeekOffset] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedEmployeeDay, setSelectedEmployeeDay] = useState<number | null>(null);
  const [siteFilter, setSiteFilter] = useState<"active" | "future" | "archived">("active");
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAssignments, setPickerAssignments] = useState<any[]>([]);
  const [pickerEmployeeId, setPickerEmployeeId] = useState<string | null>(null);

  // Click-based assignment creation state
  const [pendingAssignment, setPendingAssignment] = useState<{
    date: Date;
    startTime: string;
  } | null>(null);
  const isSelectingMode = pendingAssignment !== null;

  const currentMonday = useMemo(() => {
    const now = new Date();
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    return addWeeks(monday, weekOffset);
  }, [weekOffset]);

  const weekDays = useMemo(
    () => eachDayOfInterval({
      start: startOfWeek(currentMonday, { weekStartsOn: 1 }),
      end: endOfWeek(currentMonday, { weekStartsOn: 1 }),
    }),
    [currentMonday]
  );

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(currentMonday, "yyyy-MM-dd");
  const weekEnd = format(addDays(currentMonday, 6), "yyyy-MM-dd");
  const isCurrentWeek = isThisWeek(currentMonday, { weekStartsOn: 1 });

  // Fetch profile for company_id
  const { data: profile } = useQuery({
    queryKey: ["employee-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch construction sites for sidebar
  const { data: constructionSites = [] } = useQuery({
    queryKey: ["construction-sites", profile?.company_id, siteFilter],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("construction_sites")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("status", siteFilter)
        .order("customer_last_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Fetch calendar data: daily_assignments created by this employee (as manager)
  const { data: calendarData } = useQuery({
    queryKey: ["employee-calendar-data", user?.id, weekStart, weekEnd],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("daily_assignments")
        .select(`
          id,
          assignment_date,
          start_time,
          end_time,
          construction_site_id,
          construction_sites (
            customer_last_name,
            color
          ),
          employee_assignments (
            id,
            employee_id,
            profiles:employee_id (
              full_name,
              email
            )
          )
        `)
        .eq("installation_manager_id", user.id)
        .gte("assignment_date", weekStart)
        .lte("assignment_date", weekEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Also fetch assignments where this employee is assigned (by other managers)
  const { data: assignedToMe } = useQuery({
    queryKey: ["employee-assigned-to-me", user?.id, weekStart, weekEnd],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("employee_assignments")
        .select(`
          daily_assignment_id,
          daily_assignments!inner (
            id,
            assignment_date,
            start_time,
            end_time,
            installation_manager_id,
            construction_site_id,
            construction_sites (
              customer_last_name,
              color
            )
          )
        `)
        .eq("employee_id", user.id);
      if (error) throw error;

      // Filter to current week and exclude own assignments (already in calendarData)
      const filtered = (data as any[])?.filter((ea) => {
        const d = ea.daily_assignments?.assignment_date;
        const isOwnAssignment = ea.daily_assignments?.installation_manager_id === user.id;
        return d && d >= weekStart && d <= weekEnd && !isOwnAssignment;
      });
      return filtered || [];
    },
    enabled: !!user?.id,
  });

  // Combine: own calendar data + assignments by other managers
  const assignments = useMemo(() => {
    const own = (calendarData || []).map(a => ({
      id: a.id,
      assignment_date: a.assignment_date,
      start_time: a.start_time || "07:00",
      end_time: a.end_time || "16:00",
      construction_site_id: a.construction_site_id,
      construction_sites: a.construction_sites,
    }));

    const fromOthers = (assignedToMe || []).map((ea: any) => ({
      id: ea.daily_assignments.id,
      assignment_date: ea.daily_assignments.assignment_date,
      start_time: ea.daily_assignments.start_time || "07:00",
      end_time: ea.daily_assignments.end_time || "16:00",
      construction_site_id: ea.daily_assignments.construction_site_id,
      construction_sites: ea.daily_assignments.construction_sites,
    }));

    // Deduplicate by id
    const seen = new Set<string>();
    const combined: typeof own = [];
    for (const a of [...own, ...fromOthers]) {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        combined.push(a);
      }
    }
    return combined;
  }, [calendarData, assignedToMe]);

  // Employee assignments for helmet row
  const employeeAssignments = useMemo(() => {
    return (calendarData || []).flatMap(assignment =>
      (assignment.employee_assignments || []).map((ea: any) => ({
        ...ea,
        daily_assignment_id: assignment.id,
        daily_assignments: {
          assignment_date: assignment.assignment_date,
        }
      }))
    );
  }, [calendarData]);

  // Handle click on empty calendar field
  const handleEmptyFieldClick = (date: Date, startTime: string) => {
    setPendingAssignment({ date, startTime });
    if (isMobile) {
      setIsSidebarOpen(true);
    }
  };

  // Handle site selection for pending assignment
  const handleSiteSelectionForAssignment = async (siteId: string) => {
    if (!pendingAssignment || !user?.id || !profile?.company_id) return;

    const [startHours, startMins] = pendingAssignment.startTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMins;
    const endTotalMinutes = Math.min(startTotalMinutes + 60, 20 * 60);
    const endHour = Math.floor(endTotalMinutes / 60);
    const endMins = endTotalMinutes % 60;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    const { data: newAssignment, error } = await supabase
      .from("daily_assignments")
      .insert({
        assignment_date: format(pendingAssignment.date, "yyyy-MM-dd"),
        construction_site_id: siteId,
        installation_manager_id: user.id,
        company_id: profile.company_id,
        start_time: pendingAssignment.startTime,
        end_time: endTime,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Fehler beim Erstellen der Zuweisung");
      setPendingAssignment(null);
      return;
    }

    if (newAssignment) {
      navigate(`/employee/einsatz/${newAssignment.id}`);
    }

    setPendingAssignment(null);
    setIsSidebarOpen(false);
    queryClient.invalidateQueries({ queryKey: ["employee-calendar-data"] });
  };

  const handleCancelSelection = () => {
    setPendingAssignment(null);
    setIsSidebarOpen(false);
  };

  // Assignment click -> navigate to detail
  const handleAssignmentClick = (assignmentId: string) => {
    navigate(`/employee/einsatz/${assignmentId}`);
  };

  // Update assignment times (resize)
  const handleUpdateAssignmentTimes = async (assignmentId: string, newStartTime: string, newEndTime: string) => {
    const { error } = await supabase
      .from("daily_assignments")
      .update({ start_time: newStartTime, end_time: newEndTime })
      .eq("id", assignmentId);
    if (error) {
      toast.error("Fehler beim Aktualisieren");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["employee-calendar-data"] });
  };

  // Delete assignment
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("daily_assignments")
        .delete()
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-calendar-data"] });
      toast.success("Zuweisung gelöscht");
    },
    onError: () => {
      toast.error("Fehler beim Löschen der Zuweisung");
    },
  });

  const handleDeleteAssignment = (assignmentId: string) => {
    deleteAssignmentMutation.mutate(assignmentId);
  };

  // Helmet click for employee assignment
  const handleHelmetClick = (dayIdx: number) => {
    if (selectedEmployeeDay === dayIdx) {
      setSelectedEmployeeDay(null);
    } else {
      setSelectedEmployeeDay(dayIdx);
    }
  };

  // Assign employee mutation
  const assignEmployeeMutation = useMutation({
    mutationFn: async ({ employeeId, dailyAssignmentId }: { employeeId: string; dailyAssignmentId: string }) => {
      const { data, error } = await supabase
        .from("employee_assignments")
        .insert({
          daily_assignment_id: dailyAssignmentId,
          employee_id: employeeId,
        })
        .select("id, employee_id, daily_assignment_id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Mitarbeiter eingeteilt");
      queryClient.invalidateQueries({ queryKey: ["employee-calendar-data"] });
    },
    onError: () => {
      toast.error("Fehler beim Einteilen des Mitarbeiters");
    },
  });

  const handleEmployeeAssignment = (employeeId: string) => {
    if (selectedEmployeeDay === null) return;
    const selectedDayDate = weekDays[selectedEmployeeDay];
    const dayStr = format(selectedDayDate, "yyyy-MM-dd");

    // Only use own assignments (calendarData) for employee assignment
    const dayAssignments = (calendarData || []).filter(a => a.assignment_date === dayStr);

    if (dayAssignments.length === 0) {
      toast.error("Bitte erst eine Baustelle für diesen Tag planen");
      return;
    }

    if (dayAssignments.length > 1) {
      setPickerAssignments(dayAssignments);
      setPickerEmployeeId(employeeId);
      setPickerOpen(true);
      return;
    }

    assignEmployeeMutation.mutate({
      employeeId,
      dailyAssignmentId: dayAssignments[0].id,
    });
  };

  const handlePickerSelect = (assignmentId: string) => {
    if (!pickerEmployeeId) return;
    assignEmployeeMutation.mutate({
      employeeId: pickerEmployeeId,
      dailyAssignmentId: assignmentId,
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* Mobile sidebar trigger */}
          {isMobile && (
            <Sheet
              open={isSidebarOpen || isSelectingMode}
              onOpenChange={(open) => {
                if (!open) {
                  setIsSidebarOpen(false);
                  setSidebarSearchOpen(false);
                  setSidebarSearchQuery("");
                  handleCancelSelection();
                } else {
                  setIsSidebarOpen(true);
                }
              }}
            >
              <SheetTrigger asChild>
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <ExcavatorIcon className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSidebarSearchOpen(true);
                      setSidebarSearchQuery("");
                      setIsSidebarOpen(true);
                    }}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <SheetHeader className="sr-only">
                  <SheetTitle>Baustellen</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col h-full bg-card">
                  {isSelectingMode && (
                    <div className="p-3 border-b flex items-center justify-between">
                      <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={handleCancelSelection}>
                        <ArrowLeft className="h-4 w-4" />
                        Abbrechen
                      </Button>
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <ConstructionSiteSidebar
                      sites={constructionSites}
                      companyId={profile?.company_id || ""}
                      userId={user?.id || ""}
                      currentFilter={siteFilter}
                      onFilterChange={setSiteFilter}
                      hideFilterDropdown
                      onSiteClick={handleSiteSelectionForAssignment}
                      isSelectingMode={isSelectingMode}
                      showSearch={sidebarSearchOpen}
                      externalSearchQuery={sidebarSearchQuery}
                      onExternalSearchChange={setSidebarSearchQuery}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}

          {/* Mobile Employee Sheet */}
          {isMobile && (
            <Sheet
              open={selectedEmployeeDay !== null && isMobile}
              onOpenChange={(open) => !open && setSelectedEmployeeDay(null)}
            >
              <SheetContent side="left" className="p-0 w-80">
                <SheetHeader className="sr-only">
                  <SheetTitle>Mitarbeiter</SheetTitle>
                </SheetHeader>
                {selectedEmployeeDay !== null && (
                  <EmployeeSidebar
                    selectedDay={weekDays[selectedEmployeeDay]}
                    companyId={profile?.company_id || ""}
                    onEmployeeClick={handleEmployeeAssignment}
                    onClose={() => setSelectedEmployeeDay(null)}
                    hideCloseButton
                  />
                )}
              </SheetContent>
            </Sheet>
          )}

          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(p => p - 1)} className="h-9 w-9">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} className="text-xs hidden sm:flex">
            Heute
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(p => p + 1)} className="h-9 w-9">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="text-center">
          <p className="text-sm font-medium">
            KW {format(currentMonday, "w", { locale: de })} · {format(currentMonday, "d. MMM", { locale: de })} – {format(addDays(currentMonday, 5), "d. MMM", { locale: de })}
          </p>
          {isCurrentWeek && (
            <span className="text-xs text-primary font-medium">Diese Woche</span>
          )}
        </div>
      </div>

      {/* Calendar with optional desktop sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Dimming overlay when in selection mode (Desktop) */}
        {isSelectingMode && !isMobile && (
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 pointer-events-auto"
            onClick={handleCancelSelection}
          >
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-6 bg-card rounded-lg shadow-lg border">
                <p className="text-lg font-medium mb-2">Baustelle auswählen</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Wählen Sie eine Baustelle aus der Seitenleiste
                </p>
                <Button variant="outline" onClick={handleCancelSelection}>
                  Abbrechen
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        {!isMobile && (
          <aside className={`w-64 flex-shrink-0 hidden md:block relative h-full ${isSelectingMode ? "z-30" : ""}`}>
            <ConstructionSiteSidebar
              sites={constructionSites}
              companyId={profile?.company_id || ""}
              userId={user?.id || ""}
              currentFilter={siteFilter}
              onFilterChange={setSiteFilter}
              onSiteClick={handleSiteSelectionForAssignment}
              isSelectingMode={isSelectingMode}
              externalSearchQuery={sidebarSearchQuery}
              onExternalSearchChange={setSidebarSearchQuery}
            />

            {/* Employee sidebar overlay when helmet is clicked */}
            {selectedEmployeeDay !== null && (
              <div className="absolute inset-0 z-10">
                <EmployeeSidebar
                  selectedDay={weekDays[selectedEmployeeDay]}
                  companyId={profile?.company_id || ""}
                  onEmployeeClick={handleEmployeeAssignment}
                  onClose={() => setSelectedEmployeeDay(null)}
                />
              </div>
            )}
          </aside>
        )}

        {/* Calendar */}
        <main className={`flex-1 flex flex-col overflow-hidden ${isSelectingMode && !isMobile ? "pointer-events-none" : ""}`}>
          <CalendarWeekView
            weekDays={weekDays}
            assignments={assignments}
            todayStr={todayStr}
            onAssignmentClick={handleAssignmentClick}
            onUpdateAssignmentTimes={handleUpdateAssignmentTimes}
            onDeleteAssignment={handleDeleteAssignment}
            selectedEmployeeDay={selectedEmployeeDay}
            onHelmetClick={handleHelmetClick}
            employeeAssignments={employeeAssignments}
            onEmptyFieldClick={handleEmptyFieldClick}
            isSelectingMode={isSelectingMode}
          />
        </main>
      </div>

      {/* Assignment Picker Dialog */}
      <AssignmentPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        assignments={pickerAssignments}
        onSelect={handlePickerSelect}
      />
    </div>
  );
};
