import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { parseISO, isValid } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayCircle, StopCircle, Wrench, ChevronLeft, ChevronRight, Menu, Clock, Archive, ArrowLeft, Settings, Home, CalendarDays, ChevronDown, ChevronUp, Package, Building2, Search, ListTodo, MessageCircle, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ExcavatorIcon } from "@/components/icons/ExcavatorIcon";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, subMonths, eachDayOfInterval, addDays, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { useState, useEffect, useRef } from "react";
import { ConstructionSiteSidebar } from "@/components/ConstructionSiteSidebar";
import { AssignmentPickerDialog } from "@/components/AssignmentPickerDialog";
import { EmployeeSidebar } from "@/components/EmployeeSidebar";
import { CalendarMonthView } from "@/components/CalendarMonthView";
import { CalendarWeekView } from "@/components/CalendarWeekView";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageLoadingSkeleton } from "@/components/ui/loading-skeleton";
import { preloadInstallationManagerRoutes } from "@/utils/routePreload";
import { EmployeeChatTab } from "@/components/EmployeeChatTab";
import { ConstructionSiteEditDialog } from "@/components/ConstructionSiteEditDialog";

const InstallationManager = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchParams] = useSearchParams();
  const initialDate = (() => {
    const dateParam = searchParams.get("date");
    if (dateParam) {
      const parsed = parseISO(dateParam);
      if (isValid(parsed)) return parsed;
    }
    return new Date();
  })();
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedEmployeeDay, setSelectedEmployeeDay] = useState<number | null>(null);
  const [siteFilter, setSiteFilter] = useState<"active" | "future" | "archived">("active");
  const [mobileFilterSelected, setMobileFilterSelected] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAssignments, setPickerAssignments] = useState<any[]>([]);
  const [pickerEmployeeId, setPickerEmployeeId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"todos" | "hours" | "calendar" | "chat">("calendar");
  const [auftragSheetOpen, setAuftragSheetOpen] = useState(false);
  const [selectedAuftragId, setSelectedAuftragId] = useState<string | null>(null);
  const [leistungSheetOpen, setLeistungSheetOpen] = useState(false);
  const [selectedLeistung, setSelectedLeistung] = useState<string | null>(null);
  
  const [startTabDate, setStartTabDate] = useState(new Date());
  const startTabDateStr = format(startTabDate, "yyyy-MM-dd");
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false);
  const [startTabSearchOpen, setStartTabSearchOpen] = useState(false);
  const [isCreateSiteDialogOpen, setIsCreateSiteDialogOpen] = useState(false);

  // Preload installation manager routes for instant navigation
  useEffect(() => {
    preloadInstallationManagerRoutes();
  }, []);

  // New: Click-based assignment creation state
  const [pendingAssignment, setPendingAssignment] = useState<{
    date: Date;
    startTime: string;
  } | null>(null);
  const isSelectingMode = pendingAssignment !== null;
  
  // Handle click on empty calendar field
  const handleEmptyFieldClick = (date: Date, startTime: string) => {
    setPendingAssignment({ date, startTime });
    
    // On mobile, open the sidebar automatically
    if (isMobile) {
      setIsSidebarOpen(true);
      setMobileFilterSelected(true);
    }
  };
  
  // Handle site selection for pending assignment
  const handleSiteSelectionForAssignment = async (siteId: string) => {
    if (!pendingAssignment || !user?.id || !profile?.company_id) return;
    
    // Calculate default end time (1 hour after start)
    const [startHours, startMins] = pendingAssignment.startTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMins;
    const endTotalMinutes = Math.min(startTotalMinutes + 60, 20 * 60); // Max 20:00
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
    
    // Navigate to the assignment detail page (with packing list, to-dos, employees)
    if (newAssignment) {
      navigate(`/installation-manager/einsatz/${newAssignment.id}`);
    }
    
    setPendingAssignment(null);
    setIsSidebarOpen(false);
    queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
  };
  
  // Cancel pending assignment selection
  const handleCancelSelection = () => {
    setPendingAssignment(null);
    setIsSidebarOpen(false);
  };

  const today = format(new Date(), "yyyy-MM-dd");

  // Kombinierte Query: Profil + aktiver Zeiteintrag in einer Anfrage
  const { data: userState, isLoading: isLoadingEntry } = useQuery({
    queryKey: ["user-state", user?.id],
    queryFn: async () => {
      if (!user?.id) return { profile: null, activeEntry: null };
      
      // Parallele Abfragen mit Promise.all
      const [profileResult, timeEntryResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single(),
        supabase
          .from("time_entries")
          .select("*")
          .eq("user_id", user.id)
          .is("clock_out", null)
          .order("clock_in", { ascending: false })
          .limit(1)
      ]);
      
      if (profileResult.error) throw profileResult.error;
      if (timeEntryResult.error) throw timeEntryResult.error;
      
      // Verwende erstes Element des Arrays oder null
      const activeEntry = timeEntryResult.data && timeEntryResult.data.length > 0 
        ? timeEntryResult.data[0] 
        : null;
      
      return {
        profile: profileResult.data,
        activeEntry
      };
    },
    enabled: !!user?.id,
  });

  const profile = userState?.profile;
  const activeEntry = userState?.activeEntry;

  // Clock in mutation - now with site/leistung
  const clockInMutation = useMutation({
    mutationFn: async ({ siteId, leistung }: { siteId?: string | null; leistung?: string | null }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const { error } = await supabase
        .from("time_entries")
        .insert({
          user_id: user.id,
          company_id: userProfile.company_id,
          construction_site_id: siteId || null,
          leistung: leistung || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zeitbuchung gestartet!", {
        description: "Die Arbeitszeit läuft.",
      });
      queryClient.invalidateQueries({ queryKey: ["user-state"] });
    },
    onError: (error: Error) => {
      if (error.message?.includes("active time entry")) {
        toast.info("Es läuft bereits eine Zeitbuchung", {
          description: "Bitte stoppen Sie die aktuelle Buchung zuerst.",
        });
        queryClient.invalidateQueries({ queryKey: ["user-state"] });
        return;
      }
      toast.error("Fehler", {
        description: error.message,
      });
    },
  });

  // Clock out mutation
  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntry) throw new Error("No active time entry");

      const { error } = await supabase
        .from("time_entries")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", activeEntry.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ausgestempelt!", {
        description: "Schönen Feierabend!",
      });
      queryClient.invalidateQueries({ queryKey: ["user-state"] });
    },
    onError: (error: Error) => {
      toast.error("Fehler", {
        description: error.message,
      });
    },
  });

  // Fetch construction sites based on filter
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


  // Fetch assignments with todos and packing list for "Start" tab
  const { data: todayAssignmentsWithTasks = [] } = useQuery({
    queryKey: ["manager-today-tasks", user?.id, startTabDateStr],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get assignments for selected date
      const { data: todayAssignments, error: aError } = await supabase
        .from("daily_assignments")
        .select(`
          id,
          assignment_date,
          start_time,
          end_time,
          notes,
          construction_sites (
            id,
            customer_last_name,
            address,
            color
          )
        `)
        .eq("installation_manager_id", user.id)
        .eq("assignment_date", startTabDateStr);

      if (aError) throw aError;
      if (!todayAssignments || todayAssignments.length === 0) return [];

      const assignmentIds = todayAssignments.map(a => a.id);

      // Fetch todos, packing list, and material todos in parallel
      const [todosResult, packingResult, materialTodosResult] = await Promise.all([
        supabase
          .from("employee_custom_todos")
          .select("*, profiles:employee_id(full_name)")
          .in("daily_assignment_id", assignmentIds)
          .order("created_at", { ascending: true }),
        supabase
          .from("assignment_packing_list")
          .select("*")
          .in("daily_assignment_id", assignmentIds)
          .order("created_at", { ascending: true }),
        supabase
          .from("employee_material_todos")
          .select("*, profiles:employee_id(full_name), assignment_materials(material_id, quantity, materials(name))")
          .in("daily_assignment_id", assignmentIds)
          .order("created_at", { ascending: true }),
      ]);

      if (todosResult.error) throw todosResult.error;
      if (packingResult.error) throw packingResult.error;
      if (materialTodosResult.error) throw materialTodosResult.error;

      // Fetch profile names for packing list employee_ids
      const packingEmployeeIds = [...new Set((packingResult.data || []).map(p => p.employee_id).filter(Boolean))];
      let packingProfiles: Record<string, string> = {};
      if (packingEmployeeIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", packingEmployeeIds);
        if (profilesData) {
          packingProfiles = Object.fromEntries(profilesData.map(p => [p.id, p.full_name || ""]));
        }
      }

      return todayAssignments.map(assignment => ({
        ...assignment,
        todos: (todosResult.data || []).filter(t => t.daily_assignment_id === assignment.id),
        packingList: (packingResult.data || []).filter(p => p.daily_assignment_id === assignment.id).map(p => ({
          ...p,
          profiles: p.employee_id ? { full_name: packingProfiles[p.employee_id] || null } : null,
        })),
        materialTodos: (materialTodosResult.data || []).filter(m => m.daily_assignment_id === assignment.id),
      }));
    },
    enabled: !!user?.id,
  });

  // Toggle todo mutation
  const toggleTodoMutation = useMutation({
    mutationFn: async ({ todoId, isCompleted }: { todoId: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("employee_custom_todos")
        .update({ is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null })
        .eq("id", todoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-today-tasks"] });
    },
  });

  // Toggle packing item mutation
  const togglePackingMutation = useMutation({
    mutationFn: async ({ itemId, isChecked }: { itemId: string; isChecked: boolean }) => {
      const { error } = await supabase
        .from("assignment_packing_list")
        .update({ is_checked: isChecked })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-today-tasks"] });
    },
  });

  const getDateRange = () => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return { start, end };
    } else {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return { start, end };
    }
  };

  const { start: rangeStart, end: rangeEnd } = getDateRange();

  // Kombinierte Query: Assignments mit Employee-Assignments in einer Anfrage
  const { data: calendarData } = useQuery({
    queryKey: ["calendar-data", profile?.company_id, user?.id, format(rangeStart, "yyyy-MM-dd"), format(rangeEnd, "yyyy-MM-dd")],
    queryFn: async () => {
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
        .eq("installation_manager_id", user?.id)
        .gte("assignment_date", format(rangeStart, "yyyy-MM-dd"))
        .lte("assignment_date", format(rangeEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id && !!user?.id,
  });

  // Extrahiere assignments und employeeAssignments aus der kombinierten Query
  const assignments = calendarData || [];
  const employeeAssignments = (calendarData || []).flatMap(assignment =>
    (assignment.employee_assignments || []).map(ea => ({
      ...ea,
      daily_assignment_id: assignment.id,
      daily_assignments: {
        assignment_date: assignment.assignment_date,
        installation_manager_id: user?.id
      }
    }))
  );

  // Navigation handlers
  const navigatePrev = () => {
    if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // Toggle material todo mutation
  const toggleMaterialTodoMutation = useMutation({
    mutationFn: async ({ todoId, isCompleted }: { todoId: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("employee_material_todos")
        .update({ is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null })
        .eq("id", todoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-today-tasks"] });
    },
  });

  const handleAssignmentClick = (assignmentId: string) => {
    navigate(`/installation-manager/einsatz/${assignmentId}`);
  };

  // Navigate to assignment page for a construction site
  // Priority: today's assignment > next future > last past
  const handleSiteClick = async (siteId: string) => {
    // First check assignments in current calendar view
    const siteAssignments = assignments.filter(a => a.construction_site_id === siteId);
    
    if (siteAssignments.length > 0) {
      // Sort by date
      const sorted = [...siteAssignments].sort((a, b) => 
        a.assignment_date.localeCompare(b.assignment_date)
      );
      
      // Priority: today > future > past
      const todayAssignment = sorted.find(a => a.assignment_date === today);
      if (todayAssignment) {
        navigate(`/installation-manager/einsatz/${todayAssignment.id}`);
        return;
      }
      
      const futureAssignment = sorted.find(a => a.assignment_date > today);
      if (futureAssignment) {
        navigate(`/installation-manager/einsatz/${futureAssignment.id}`);
        return;
      }
      
      // Take the most recent past assignment
      const pastAssignments = sorted.filter(a => a.assignment_date < today);
      if (pastAssignments.length > 0) {
        navigate(`/installation-manager/einsatz/${pastAssignments[pastAssignments.length - 1].id}`);
        return;
      }
    }
    
    // Fallback: query the database for any assignment for this site
    const { data: dbAssignment } = await supabase
      .from("daily_assignments")
      .select("id")
      .eq("installation_manager_id", user?.id)
      .eq("construction_site_id", siteId)
      .order("assignment_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (dbAssignment) {
      navigate(`/installation-manager/einsatz/${dbAssignment.id}`);
    } else {
      toast.info("Keine Zuweisung vorhanden", {
        description: "Bitte zuerst im Kalender planen.",
      });
    }
  };

  // Create assignment via drag & drop
  const handleCreateAssignment = async (date: Date, siteId: string, startTime: string, endTime: string) => {
    if (!user?.id || !profile?.company_id) return;

    const { error } = await supabase.from("daily_assignments").insert({
      assignment_date: format(date, "yyyy-MM-dd"),
      construction_site_id: siteId,
      installation_manager_id: user.id,
      company_id: profile.company_id,
      start_time: startTime,
      end_time: endTime,
    });

    if (error) {
      toast.error("Fehler beim Erstellen der Zuweisung");
      return;
    }

    // Haptic feedback on mobile when assignment is created
    if (navigator.vibrate) {
      navigator.vibrate(50); // Short 50ms vibration
    }

    queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
  };

  // Update assignment times via resize (start and end)
  const handleUpdateAssignmentTimes = async (assignmentId: string, newStartTime: string, newEndTime: string) => {
    const { error } = await supabase
      .from("daily_assignments")
      .update({ start_time: newStartTime, end_time: newEndTime })
      .eq("id", assignmentId);

    if (error) {
      toast.error("Fehler beim Aktualisieren");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
  };

  // Move assignment to new date/time via drag & drop
  const handleMoveAssignment = async (assignmentId: string, newDate: Date, newStartTime: string, newEndTime: string) => {
    const { error } = await supabase
      .from("daily_assignments")
      .update({
        assignment_date: format(newDate, "yyyy-MM-dd"),
        start_time: newStartTime,
        end_time: newEndTime,
      })
      .eq("id", assignmentId);

    if (error) {
      toast.error("Fehler beim Verschieben");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
  };

  // Delete assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("daily_assignments")
        .delete()
        .eq("id", assignmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
      toast.success("Zuweisung gelöscht");
    },
    onError: (error: Error) => {
      toast.error("Fehler beim Löschen der Zuweisung");
      console.error(error);
    },
  });

  const handleDeleteAssignment = (assignmentId: string) => {
    deleteAssignmentMutation.mutate(assignmentId);
  };

  // Handle helmet click for employee assignment
  const handleHelmetClick = (dayIdx: number) => {
    if (selectedEmployeeDay === dayIdx) {
      // Toggle off
      setSelectedEmployeeDay(null);
    } else {
      setSelectedEmployeeDay(dayIdx);
    }
  };

  type DayAssignmentsQueryKey = readonly ["day-employee-assignments", string, string];
  type AssignEmployeeVars = { employeeId: string; dailyAssignmentId: string };
  type AssignEmployeeCtx = {
    previous?: unknown;
    key?: DayAssignmentsQueryKey;
    optimisticId?: string;
  };

  const assignEmployeeMutation = useMutation<
    { id: string; employee_id: string; daily_assignment_id: string },
    Error,
    AssignEmployeeVars,
    AssignEmployeeCtx
  >({
    mutationFn: async (vars) => {
      const { data, error } = await supabase
        .from("employee_assignments")
        .insert({
          daily_assignment_id: vars.dailyAssignmentId,
          employee_id: vars.employeeId,
        })
        .select("id, employee_id, daily_assignment_id")
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (vars) => {
      if (!profile?.company_id || selectedEmployeeDay === null) return {};

      const optimisticId = `optimistic-${vars.employeeId}-${Date.now()}`;
      const selectedDayDate = weekDays[selectedEmployeeDay];
      const dayStr = format(selectedDayDate, "yyyy-MM-dd");
      const key: DayAssignmentsQueryKey = ["day-employee-assignments", profile.company_id, dayStr];

      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);

      queryClient.setQueryData(key, (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((da) => {
          if (da.id !== vars.dailyAssignmentId) return da;

          const alreadyAssigned = (da.employee_assignments ?? []).some(
            (ea: any) => ea.employee_id === vars.employeeId
          );
          if (alreadyAssigned) return da;

          return {
            ...da,
            employee_assignments: [
              ...(da.employee_assignments ?? []),
              { id: optimisticId, employee_id: vars.employeeId },
            ],
          };
        });
      });

      return { previous, key, optimisticId };
    },
    onError: (error, _vars, ctx) => {
      console.error(error);
      toast.error("Fehler beim Einteilen des Mitarbeiters");
      if (ctx?.key) {
        queryClient.setQueryData(ctx.key, ctx.previous);
      }
    },
    onSuccess: (data, _vars, ctx) => {
      // Ersetze Optimistic-ID durch echte ID, damit Entfernen sofort funktioniert
      if (ctx?.key && ctx?.optimisticId) {
        queryClient.setQueryData(ctx.key, (old: any[] | undefined) => {
          if (!old) return old;
          return old.map((da) => ({
            ...da,
            employee_assignments: (da.employee_assignments ?? []).map((ea: any) =>
              ea.id === ctx.optimisticId
                ? { ...ea, id: data.id, employee_id: data.employee_id }
                : ea
            ),
          }));
        });
      }

      toast.success("Mitarbeiter eingeteilt");
    },
    onSettled: (_data, _error, _vars, ctx) => {
      if (ctx?.key) queryClient.invalidateQueries({ queryKey: ctx.key });
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
    },
  });

  // Handle employee assignment
  const handleEmployeeAssignment = (employeeId: string) => {
    if (selectedEmployeeDay === null) return;

    const selectedDayDate = weekDays[selectedEmployeeDay];
    const dayStr = format(selectedDayDate, "yyyy-MM-dd");

    // Find assignments for this day
    const dayAssignments = assignments.filter((a) => a.assignment_date === dayStr);

    if (dayAssignments.length === 0) {
      toast.error("Bitte erst eine Baustelle für diesen Tag planen");
      return;
    }

    if (dayAssignments.length > 1) {
      // Multiple assignments: show picker dialog
      setPickerAssignments(dayAssignments);
      setPickerEmployeeId(employeeId);
      setPickerOpen(true);
      return;
    }

    // Single assignment: assign directly
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

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 1 }),
    end: endOfWeek(currentDate, { weekStartsOn: 1 }),
  });

  const isClockedIn = !!activeEntry;
  // Loading state
  if (isLoadingEntry) {
    return <PageLoadingSkeleton />;
  }

  // Main view when clocked in - Calendar with sidebar
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className={`flex items-center justify-between px-4 py-1.5 border-b ${
        activeTab === "calendar" 
          ? "bg-card" 
          : activeTab === "todos" 
            ? "bg-primary border-primary/20" 
            : activeTab === "chat"
              ? "bg-[hsl(142,70%,35%)] border-[hsl(142,70%,30%)]"
              : "bg-destructive border-destructive/20"
      }`}>
        <div className="flex items-center gap-2 md:gap-4">
          {/* Hamburger dropdown menu - always visible */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={activeTab !== "calendar" ? "text-white hover:bg-white/10" : ""}>
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="w-4 h-4 mr-2" />
                Einstellungen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Sites Sheet - separate from the hamburger menu */}
          {isMobile && (
            <>
              {/* Sites Sheet */}
              <Sheet 
                open={isSidebarOpen || isSelectingMode} 
                onOpenChange={(open) => {
                  if (!open) {
                    setIsSidebarOpen(false);
                    setMobileFilterSelected(false);
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
                    <Button variant="ghost" size="icon">
                      <ExcavatorIcon className="h-6 w-6" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSidebarSearchOpen(true);
                        setSidebarSearchQuery("");
                        setIsSidebarOpen(true);
                      }}
                    >
                      <Search className="h-5 w-5" />
                    </Button>
                  </div>
                </SheetTrigger>
                <SheetContent 
                  side="left" 
                  className="p-0 w-80"
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>Baustellen</SheetTitle>
                  </SheetHeader>
                  
                  <div className="flex flex-col h-full bg-card">
                    {isSelectingMode && (
                      <div className="p-3 border-b flex items-center justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 -ml-2"
                          onClick={handleCancelSelection}
                        >
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

              {/* Employee Sheet for mobile - opens when helmet is clicked */}
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
            </>
          )}
          
          {activeTab === "calendar" ? (
            <>
              <h1 className="text-lg md:text-xl font-bold hidden sm:block">Kalender</h1>
              <div className="flex items-center gap-1 md:gap-2">
                <Button variant="outline" size="icon" onClick={navigatePrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={navigateToday} className="hidden sm:flex">
                  Heute
                </Button>
                <Button variant="outline" size="icon" onClick={navigateNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-xs md:text-sm text-muted-foreground truncate max-w-[120px] md:max-w-none">
                {viewMode === "week"
                  ? `KW ${format(currentDate, "w", { locale: de })}`
                  : format(currentDate, "MMM yyyy", { locale: de })}
              </span>
            </>
          ) : (
            <h1 className="text-lg font-semibold text-white">
              {activeTab === "todos" ? "Start" : activeTab === "hours" ? "Zeitbuchung" : "Chat"}
            </h1>
          )}
        </div>
        {activeTab === "calendar" && (
          <div className="flex items-center gap-2 md:gap-4">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as "week" | "month")}
              className="hidden sm:flex"
            >
              <ToggleGroupItem value="week" size="sm">
                Woche
              </ToggleGroupItem>
              <ToggleGroupItem value="month" size="sm">
                Monat
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
      </header>

      {/* Main content */}
      {activeTab === "calendar" && (
        <div className="flex-1 flex overflow-hidden relative pb-20 md:pb-12">
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
          
          {/* Desktop Sidebar - Sites always visible, Employees overlay when helmet clicked */}
          {!isMobile && (
            <aside className={`w-72 flex-shrink-0 hidden md:block relative h-full ${isSelectingMode ? "z-30" : ""}`}>
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
          <main className={`flex-1 flex flex-col p-2 md:p-4 overflow-hidden ${isSelectingMode && !isMobile ? "pointer-events-none" : ""}`}>
            {viewMode === "week" ? (
              <CalendarWeekView
                weekDays={weekDays}
                assignments={assignments}
                todayStr={today}
                onAssignmentClick={handleAssignmentClick}
                onUpdateAssignmentTimes={handleUpdateAssignmentTimes}
                onDeleteAssignment={handleDeleteAssignment}
                selectedEmployeeDay={selectedEmployeeDay}
                onHelmetClick={handleHelmetClick}
                employeeAssignments={employeeAssignments}
                onEmptyFieldClick={handleEmptyFieldClick}
                isSelectingMode={isSelectingMode}
              />
            ) : (
              <CalendarMonthView
                currentDate={currentDate}
                assignments={assignments}
                todayStr={today}
              />
            )}
          </main>
        </div>
      )}

      {activeTab === "todos" && (
        <main className="flex-1 overflow-auto pb-20">
          <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
            {/* Create new site button */}
            {profile?.company_id && user?.id && (
              <Button 
                className="w-full font-semibold shadow-sm rounded-xl bg-orange-500 hover:bg-orange-600 text-black"
                onClick={() => setIsCreateSiteDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Neue Baustelle anlegen
              </Button>
            )}

            {/* Date Navigation */}
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setStartTabDate(prev => addDays(prev, -1))}
                className="h-10 w-10 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              
              <div className="text-center">
                <p className="text-lg font-medium">
                  {format(startTabDate, "EEEE, d. MMMM yyyy", { locale: de })}
                </p>
                {isToday(startTabDate) && (
                  <span className="text-xs text-primary font-medium">Heute</span>
                )}
              </div>
              
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setStartTabDate(prev => addDays(prev, 1))}
                className="h-10 w-10 rounded-full"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>


            {todayAssignmentsWithTasks.length === 0 ? (
              <Card className="rounded-2xl shadow-sm">
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Home className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Keine Aufgaben für {isToday(startTabDate) ? "heute" : format(startTabDate, "d. MMMM", { locale: de })} geplant.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              todayAssignmentsWithTasks
                .map((assignment) => {
                const site = assignment.construction_sites as any;
                const todos = assignment.todos || [];
                const packingList = assignment.packingList || [];
                const materialTodos = assignment.materialTodos || [];
                const hasTasks = todos.length > 0 || packingList.length > 0 || materialTodos.length > 0;

                return (
                  <Card
                    key={assignment.id}
                    className="rounded-2xl shadow-sm overflow-hidden"
                    style={{
                      borderLeftWidth: '6px',
                      borderLeftColor: site?.color || 'hsl(var(--primary))'
                    }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                        <CardTitle className="text-lg">{site?.customer_last_name || "Baustelle"}</CardTitle>
                      </div>
                      {(assignment.start_time || assignment.end_time) && (
                        <p className="text-sm text-muted-foreground">
                          {assignment.start_time?.slice(0, 5)} - {assignment.end_time?.slice(0, 5)} Uhr
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {!hasTasks && (
                        <p className="text-sm text-muted-foreground py-2">Keine Aufgaben für diese Baustelle.</p>
                      )}

                      {/* To-Dos */}
                      {todos.length > 0 && (
                        <Collapsible defaultOpen>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-muted/50 hover:bg-muted">
                              <div className="flex items-center gap-2">
                                <ListTodo className="w-4 h-4" />
                                <span className="font-medium">To-Dos</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  {todos.filter((t: any) => t.is_completed).length}/{todos.length}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                              </div>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-2 space-y-1">
                            {todos.map((todo: any) => (
                              <div
                                key={todo.id}
                                className={`flex items-center gap-3 py-2 px-3 rounded transition-colors cursor-pointer ${
                                  todo.is_completed ? "bg-green-500/15" : "hover:bg-muted/30"
                                }`}
                                onClick={() => toggleTodoMutation.mutate({ todoId: todo.id, isCompleted: !todo.is_completed })}
                              >
                                <Checkbox
                                  checked={todo.is_completed || false}
                                  onCheckedChange={() => {}}
                                  className="pointer-events-none"
                                />
                                <span className={`flex-1 ${todo.is_completed ? "line-through text-muted-foreground" : ""}`}>
                                  {todo.text}
                                </span>
                                {todo.profiles?.full_name && (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">{todo.profiles.full_name}</span>
                                )}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Packliste */}
                      {packingList.length > 0 && (
                        <Collapsible defaultOpen>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-muted/50 hover:bg-muted">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                <span className="font-medium">Packliste</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  {packingList.filter((p: any) => p.is_checked).length}/{packingList.length}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                              </div>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-2 space-y-1">
                            {packingList.map((item: any) => (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 py-2 px-3 rounded transition-colors cursor-pointer ${
                                  item.is_checked ? "bg-green-500/15" : "hover:bg-muted/30"
                                }`}
                                onClick={() => togglePackingMutation.mutate({ itemId: item.id, isChecked: !item.is_checked })}
                              >
                                <Checkbox
                                  checked={item.is_checked || false}
                                  onCheckedChange={() => {}}
                                  className="pointer-events-none"
                                />
                                <span className={`flex-1 ${item.is_checked ? "line-through text-muted-foreground" : ""}`}>
                                  {item.text}
                                </span>
                                {item.profiles?.full_name && (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">{item.profiles.full_name}</span>
                                )}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Material-Aufgaben */}
                      {materialTodos.length > 0 && (
                        <Collapsible defaultOpen>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-muted/50 hover:bg-muted">
                              <div className="flex items-center gap-2">
                                <Wrench className="w-4 h-4" />
                                <span className="font-medium">Material-Aufgaben</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  {materialTodos.filter((m: any) => m.is_completed).length}/{materialTodos.length}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                              </div>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-2 space-y-1">
                            {materialTodos.map((mt: any) => {
                              const materialName = mt.assignment_materials?.materials?.name || "Material";
                              const qty = mt.quantity || mt.assignment_materials?.quantity || 1;
                              return (
                                <div
                                  key={mt.id}
                                  className={`flex items-center gap-3 py-2 px-3 rounded transition-colors cursor-pointer ${
                                    mt.is_completed ? "bg-green-500/15" : "hover:bg-muted/30"
                                  }`}
                                  onClick={() => toggleMaterialTodoMutation.mutate({ todoId: mt.id, isCompleted: !mt.is_completed })}
                                >
                                  <Checkbox
                                    checked={mt.is_completed || false}
                                    onCheckedChange={() => {}}
                                    className="pointer-events-none"
                                  />
                                  <span className={`flex-1 ${mt.is_completed ? "line-through text-muted-foreground" : ""}`}>
                                    {materialName} {qty > 1 ? `×${qty}` : ""}
                                  </span>
                                  {mt.profiles?.full_name && (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">{mt.profiles.full_name}</span>
                                  )}
                                </div>
                              );
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </main>
      )}

      {activeTab === "hours" && (
        <main className="flex-1 overflow-auto pb-20">
          <div className="container mx-auto px-2 py-6 max-w-full space-y-6">
            {/* Zeitbuchung */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Zeitbuchung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Auftrag</label>
                  <button
                    type="button"
                    onClick={() => setAuftragSheetOpen(true)}
                    className="flex h-16 w-full items-center justify-between rounded-2xl border border-input bg-card px-4 py-4 text-lg text-foreground shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <span className={selectedAuftragId ? "text-foreground" : "text-muted-foreground"}>
                      {selectedAuftragId
                        ? constructionSites.find(s => s.id === selectedAuftragId)?.customer_last_name ?? "Bitte auswählen"
                        : "Bitte auswählen"}
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>

                  {/* Auftrag Sheet */}
                  <Sheet open={auftragSheetOpen} onOpenChange={setAuftragSheetOpen}>
                    <SheetContent side="right" className="p-0 w-full sm:w-96">
                      <SheetHeader className="p-4 border-b border-border flex flex-row items-center gap-3">
                        <button onClick={() => setAuftragSheetOpen(false)} className="p-1 rounded-md hover:bg-accent">
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <SheetTitle>Auftrag auswählen</SheetTitle>
                      </SheetHeader>
                      <div className="overflow-y-auto h-[calc(100%-65px)]">
                        {/* Baustellen */}
                        {constructionSites.length > 0 ? (
                          <div className="divide-y divide-border">
                            {constructionSites.map((site) => (
                              <button
                                key={site.id}
                                onClick={() => {
                                  setSelectedAuftragId(site.id);
                                  setAuftragSheetOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-accent ${
                                  selectedAuftragId === site.id ? "bg-accent" : ""
                                }`}
                              >
                                {site.color && (
                                  <div
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: site.color }}
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-base font-medium truncate">{site.customer_last_name}</p>
                                  {site.address && (
                                    <p className="text-sm text-muted-foreground truncate">{site.address}</p>
                                  )}
                                </div>
                                {selectedAuftragId === site.id && (
                                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-muted-foreground">
                            <p>Keine aktiven Baustellen</p>
                          </div>
                        )}

                        {/* Leistungsverzeichnis */}
                        <div className="border-t border-border">
                          <div className="px-4 py-3 bg-muted/50">
                            <p className="text-sm font-medium text-muted-foreground">Leistungen</p>
                          </div>
                          <div className="divide-y divide-border">
                            {["Arbeitsvorbereitung", "Herstellung", "Intern/Sonstiges", "Montage", "Pause"].map((leistung) => (
                              <button
                                key={leistung}
                                onClick={() => {
                                  setSelectedAuftragId(null);
                                  setSelectedLeistung(leistung);
                                  setAuftragSheetOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-accent"
                              >
                                <p className="text-base font-medium">{leistung}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Leistung</label>
                  <button
                    type="button"
                    onClick={() => setLeistungSheetOpen(true)}
                    className="flex h-16 w-full items-center justify-between rounded-2xl border border-input bg-card px-4 py-4 text-lg text-foreground shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <span className={selectedLeistung ? "text-foreground" : "text-muted-foreground"}>
                      {selectedLeistung ?? "Bitte auswählen"}
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>

                  {/* Leistung Sheet */}
                  <Sheet open={leistungSheetOpen} onOpenChange={setLeistungSheetOpen}>
                    <SheetContent side="right" className="p-0 w-full sm:w-96">
                      <SheetHeader className="p-4 border-b border-border flex flex-row items-center gap-3">
                        <button onClick={() => setLeistungSheetOpen(false)} className="p-1 rounded-md hover:bg-accent">
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <SheetTitle>Leistung auswählen</SheetTitle>
                      </SheetHeader>
                      <div className="overflow-y-auto h-[calc(100%-65px)]">
                        <div className="divide-y divide-border">
                          {["Arbeitsvorbereitung", "Herstellung", "Intern/Sonstiges", "Montage", "Pause"].map((leistung) => (
                            <button
                              key={leistung}
                              onClick={() => {
                                setSelectedLeistung(leistung);
                                setLeistungSheetOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-accent ${
                                selectedLeistung === leistung ? "bg-accent" : ""
                              }`}
                            >
                              <p className="text-base font-medium">{leistung}</p>
                              {selectedLeistung === leistung && (
                                <div className="ml-auto w-2 h-2 rounded-full bg-primary shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                {/* Active Booking Display */}
                {activeEntry && (
                  <Card className="rounded-2xl border-green-500/30 bg-green-500/10">
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-medium">Zeitbuchung läuft</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {(activeEntry as any).construction_site_id
                          ? `Baustelle: ${constructionSites.find(s => s.id === (activeEntry as any).construction_site_id)?.customer_last_name ?? "Unbekannt"}`
                          : (activeEntry as any).leistung
                            ? `Leistung: ${(activeEntry as any).leistung}`
                            : "Allgemein"}
                        {" · Seit "}
                        {format(new Date(activeEntry.clock_in), "HH:mm", { locale: de })} Uhr
                      </div>
                      <Button
                        onClick={() => clockOutMutation.mutate()}
                        disabled={clockOutMutation.isPending}
                        variant="destructive"
                        className="w-full rounded-2xl h-12"
                      >
                        <StopCircle className="w-5 h-5 mr-2" />
                        Buchung stoppen
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Buchen Button */}
                {!activeEntry && (
                  <Button
                    onClick={() => {
                      if (!selectedAuftragId && !selectedLeistung) {
                        toast.error("Bitte wählen Sie einen Auftrag oder eine Leistung aus.");
                        return;
                      }
                      clockInMutation.mutate({
                        siteId: selectedAuftragId,
                        leistung: selectedLeistung,
                      });
                    }}
                    disabled={clockInMutation.isPending || (!selectedAuftragId && !selectedLeistung)}
                    className="w-full rounded-2xl h-14 text-lg bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                    variant="ghost"
                  >
                    <PlayCircle className="w-5 h-5 mr-2" />
                    Buchen
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Meine Buchungen */}
            <Card
              className="rounded-2xl shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/installation-manager/meine-buchungen")}
            >
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Meine Buchungen</CardTitle>
                  <CardDescription>Vergangene Zeitbuchungen einsehen & bearbeiten</CardDescription>
                </div>
                <Clock className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
            </Card>

            {/* Urlaubsantrag */}
            <Collapsible>
              <Card className="rounded-2xl shadow-sm">
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Urlaubsantrag</CardTitle>
                      <CardDescription>Reiche hier deinen Urlaubsantrag ein</CardDescription>
                    </div>
                    <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Von</label>
                        <Input type="date" className="rounded-2xl h-12" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Bis</label>
                        <Input type="date" className="rounded-2xl h-12" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Bemerkung</label>
                      <textarea
                        placeholder="Optional"
                        className="flex min-h-[80px] w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm text-foreground shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
                      />
                    </div>
                    <Button className="w-full rounded-2xl h-12">
                      Antrag einreichen
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        </main>
      )}

      {activeTab === "chat" && (
        <main className="flex-1 overflow-auto pb-20">
          <div className="container mx-auto px-4 py-6 max-w-3xl">
            <EmployeeChatTab />
          </div>
        </main>
      )}

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-border bg-muted shadow-[0_-4px_16px_rgba(0,0,0,0.15)] safe-bottom">
        <div className="flex items-stretch h-20 md:h-10 divide-x divide-border">
          <button
            onClick={() => setActiveTab("todos")}
            className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 transition-colors ${
              activeTab === "todos" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Home className="w-5 h-5 md:w-4 md:h-4" />
            <span className="hidden md:inline text-xs font-medium">Start</span>
            <span className="md:hidden text-xs font-medium">Start</span>
          </button>
          <button
            onClick={() => setActiveTab("hours")}
            className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 transition-colors ${
              activeTab === "hours" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-5 h-5 md:w-4 md:h-4" />
            <span className="hidden md:inline text-xs font-medium">Zeitbuchung</span>
            <span className="md:hidden text-xs font-medium">Stunden</span>
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 transition-colors ${
              activeTab === "calendar" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="w-5 h-5 md:w-4 md:h-4" />
            <span className="hidden md:inline text-xs font-medium">Kalender</span>
            <span className="md:hidden text-xs font-medium">Kalender</span>
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 transition-colors ${
              activeTab === "chat" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="w-5 h-5 md:w-4 md:h-4" />
            <span className="hidden md:inline text-xs font-medium">Chat</span>
            <span className="md:hidden text-xs font-medium">Chat</span>
          </button>
        </div>
      </nav>

      <AssignmentPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        assignments={pickerAssignments}
        onSelect={handlePickerSelect}
      />

      {/* Create Site Dialog */}
      <ConstructionSiteEditDialog
        site={null}
        open={isCreateSiteDialogOpen}
        onOpenChange={setIsCreateSiteDialogOpen}
        mode="create"
        companyId={profile?.company_id || ""}
        userId={user?.id || ""}
      />
    </div>
  );
};

export default InstallationManager;
