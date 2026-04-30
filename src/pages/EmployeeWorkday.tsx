import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Building2, 
  Menu,
  MapPin,
  Search,
  ChevronDown, 
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Home,
  Package,
  Wrench,
  ExternalLink,
  User,
  Users,
  Settings,
  Clock,
  CalendarDays,
  PlayCircle,
  StopCircle,
  ArrowLeft,
  Plus,
  Send,
  MessageCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PendingIndicator } from "@/components/PendingIndicator";
import { EmployeeCalendarTab } from "@/components/EmployeeCalendarTab";
import { EmployeeChatTab } from "@/components/EmployeeChatTab";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConstructionSiteEditDialog } from "@/components/ConstructionSiteEditDialog";

interface ConstructionSite {
  id: string;
  customer_last_name: string;
  address: string | null;
  customer_phone: string | null;
  color: string | null;
}

interface DailyAssignment {
  id: string;
  assignment_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  installation_manager_id: string;
  construction_sites: ConstructionSite;
}

interface EmployeeAssignment {
  daily_assignment_id: string;
  daily_assignments: DailyAssignment;
}

interface TeamMember {
  employee_id: string;
  full_name: string | null;
}

interface MaterialTodo {
  id: string;
  employee_id: string;
  daily_assignment_id: string;
  quantity: number | null;
  is_completed: boolean | null;
  notes: string | null;
  profiles: { full_name: string | null } | null;
  assignment_materials: {
    id: string;
    quantity: number | null;
    materials: { name: string; category: string } | null;
  } | null;
}

interface CustomTodo {
  id: string;
  text: string;
  is_completed: boolean | null;
  employee_id: string | null;
  daily_assignment_id: string;
  profiles?: { full_name: string | null } | null;
}

interface PackingItem {
  id: string;
  text: string;
  is_checked: boolean | null;
  employee_id: string | null;
  daily_assignment_id: string;
  profiles?: { full_name: string | null } | null;
}

type WorkdayTab = "todos" | "hours" | "calendar" | "chat";

const EmployeeWorkday = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WorkdayTab>("todos");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Time booking state
  const [selectedAuftragId, setSelectedAuftragId] = useState<string | null>(null);
  const [selectedLeistung, setSelectedLeistung] = useState<string | null>(null);
  const [auftragSheetOpen, setAuftragSheetOpen] = useState(false);
  const [leistungSheetOpen, setLeistungSheetOpen] = useState(false);
  
  // Date navigation state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const [isCreateSiteDialogOpen, setIsCreateSiteDialogOpen] = useState(false);
  const [vacationFrom, setVacationFrom] = useState("");
  const [vacationTo, setVacationTo] = useState("");
  const [vacationNote, setVacationNote] = useState("");
  const [isSubmittingVacation, setIsSubmittingVacation] = useState(false);
  
  const goToPreviousDay = () => {
    setSelectedDate(prev => addDays(prev, -1));
  };
  
  const goToNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  // Loading state for assignments only
  const isLoadingEntry = false;

  // Fetch employee profile to get company_id
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

  // Fetch active time entry
  const { data: activeEntry } = useQuery({
    queryKey: ["employee-active-entry", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", user!.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!user?.id,
  });

  // Clock in mutation
  const clockInMutation = useMutation({
    mutationFn: async ({ siteId, leistung }: { siteId?: string | null; leistung?: string | null }) => {
      if (!user || !profile?.company_id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("time_entries")
        .insert({
          user_id: user.id,
          company_id: profile.company_id,
          construction_site_id: siteId || null,
          leistung: leistung || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zeitbuchung gestartet!");
      queryClient.invalidateQueries({ queryKey: ["employee-active-entry"] });
    },
    onError: (error: Error) => {
      if (error.message?.includes("active time entry")) {
        toast.info("Es läuft bereits eine Zeitbuchung");
        queryClient.invalidateQueries({ queryKey: ["employee-active-entry"] });
        return;
      }
      toast.error("Fehler", { description: error.message });
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
      toast.success("Zeitbuchung gestoppt!");
      queryClient.invalidateQueries({ queryKey: ["employee-active-entry"] });
    },
    onError: (error: Error) => {
      toast.error("Fehler", { description: error.message });
    },
  });

  // Fetch all active construction sites for the company (same as manager sidebar)
  const { data: activeSites = [] } = useQuery({
    queryKey: ["company-construction-sites", profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_sites")
        .select("id, customer_last_name, address, color")
        .eq("company_id", profile!.company_id!)
        .eq("status", "active")
        .order("customer_last_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Get assignments for the selected date
  const { data: dayAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["employee-day-assignments", user?.id, selectedDateStr],
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
            notes,
            installation_manager_id,
            construction_sites (
              id,
              customer_last_name,
              address,
              customer_phone,
              color
            )
          )
        `)
        .eq("employee_id", user.id);
      
      if (error) throw error;
      
      // Filter for selected date
      const filtered = (data as unknown as EmployeeAssignment[])?.filter(
        ea => ea.daily_assignments?.assignment_date === selectedDateStr
      ) || [];
      
      return filtered;
    },
    enabled: !!user?.id,
  });



  if (isLoadingEntry || isLoadingAssignments) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className={`border-b safe-top ${
        activeTab === "todos" 
          ? "bg-primary border-primary/20" 
          : activeTab === "hours" 
            ? "bg-destructive border-destructive/20" 
            : "bg-emerald-600 border-emerald-500/20"
      }`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {window.history.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => navigate("/employee")} className="text-white hover:bg-white/10">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <h1 className="text-lg font-semibold text-white">
                {activeTab === "todos" ? "Start" : activeTab === "hours" ? "Zeitbuchung" : activeTab === "calendar" ? "Mein Kalender" : "Chat"}
              </h1>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="w-4 h-4 mr-2" />
                  Einstellungen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          {activeTab === "todos" && (
            <>

              {/* Create new site button */}
              {profile?.company_id && user?.id && (
                <div className="mb-4">
                  <Button 
                    className="w-full font-semibold shadow-sm rounded-xl bg-orange-500 hover:bg-orange-600 text-black"
                    onClick={() => setIsCreateSiteDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Neue Baustelle anlegen
                  </Button>
                </div>
              )}

              {/* Date Navigation */}
              <div className="flex items-center justify-between mb-6">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={goToPreviousDay}
                  className="h-10 w-10 rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                
                <div className="text-center">
                  <p className="text-lg font-medium">
                    {format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de })}
                  </p>
                  {isToday(selectedDate) && (
                    <span className="text-xs text-primary font-medium">Heute</span>
                  )}
                </div>
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={goToNextDay}
                  className="h-10 w-10 rounded-full"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* Construction Sites */}
              {dayAssignments && dayAssignments.length > 0 ? (
                <div className="space-y-4">
                  {dayAssignments
                    .map((assignment) => (
                    <ConstructionSiteCard
                      key={assignment.daily_assignment_id}
                      assignment={assignment}
                      currentUserId={user?.id || ""}
                    />
                  ))}
                </div>
              ) : (
                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                      <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Keine Baustellen für {isToday(selectedDate) ? "heute" : format(selectedDate, "d. MMMM", { locale: de })} zugewiesen.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {activeTab === "hours" && (
            <div className="space-y-6">
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
                      className="flex h-16 w-full items-center justify-between rounded-2xl border border-input bg-card px-4 py-4 text-lg text-foreground shadow-sm"
                    >
                      <span className={selectedAuftragId ? "text-foreground" : "text-muted-foreground"}>
                        {selectedAuftragId
                          ? activeSites.find(s => s.id === selectedAuftragId)?.customer_last_name ?? "Bitte auswählen"
                          : selectedLeistung
                            ? selectedLeistung
                            : "Bitte auswählen"}
                      </span>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </button>

                    <Sheet open={auftragSheetOpen} onOpenChange={setAuftragSheetOpen}>
                      <SheetContent side="right" className="p-0 w-full sm:w-96">
                        <SheetHeader className="p-4 border-b border-border flex flex-row items-center gap-3">
                          <button onClick={() => setAuftragSheetOpen(false)} className="p-1 rounded-md hover:bg-accent">
                            <ArrowLeft className="w-5 h-5" />
                          </button>
                          <SheetTitle>Auftrag auswählen</SheetTitle>
                        </SheetHeader>
                        <div className="overflow-y-auto h-[calc(100%-65px)]">
                          {activeSites.length > 0 && (
                            <div className="divide-y divide-border">
                              {activeSites.map((site) => (
                                <button
                                  key={site.id}
                                  onClick={() => {
                                    setSelectedAuftragId(site.id);
                                    setSelectedLeistung(null);
                                    setAuftragSheetOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-accent ${
                                    selectedAuftragId === site.id ? "bg-accent" : ""
                                  }`}
                                >
                                  {site.color && (
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: site.color }} />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-medium truncate">{site.customer_last_name}</p>
                                    {site.address && <p className="text-sm text-muted-foreground truncate">{site.address}</p>}
                                  </div>
                                  {selectedAuftragId === site.id && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                                </button>
                              ))}
                            </div>
                          )}
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
                      className="flex h-16 w-full items-center justify-between rounded-2xl border border-input bg-card px-4 py-4 text-lg text-foreground shadow-sm"
                    >
                      <span className={selectedLeistung ? "text-foreground" : "text-muted-foreground"}>
                        {selectedLeistung ?? "Bitte auswählen"}
                      </span>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </button>

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
                                {selectedLeistung === leistung && <div className="ml-auto w-2 h-2 rounded-full bg-primary shrink-0" />}
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
                            ? `Baustelle: ${activeSites.find(s => s.id === (activeEntry as any).construction_site_id)?.customer_last_name ?? "Unbekannt"}`
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
                onClick={() => navigate("/employee/meine-buchungen")}
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
                          <Input type="date" className="rounded-2xl h-12" value={vacationFrom} onChange={e => setVacationFrom(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Bis</label>
                          <Input type="date" className="rounded-2xl h-12" value={vacationTo} onChange={e => setVacationTo(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Bemerkung</label>
                        <textarea
                          placeholder="Optional"
                          value={vacationNote}
                          onChange={e => setVacationNote(e.target.value)}
                          className="flex min-h-[80px] w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm text-foreground shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
                        />
                      </div>
                      <Button 
                        className="w-full rounded-2xl h-12"
                        disabled={!vacationFrom || !vacationTo || isSubmittingVacation}
                        onClick={async () => {
                          if (!user || !profile?.company_id || !vacationFrom || !vacationTo) return;
                          setIsSubmittingVacation(true);
                          try {
                            // Get user's name
                            const { data: myProfile } = await supabase
                              .from("profiles")
                              .select("full_name")
                              .eq("id", user.id)
                              .single();
                            
                            // Find or create "Urlaubsanträge" group
                            let { data: existingGroup } = await supabase
                              .from("chat_groups")
                              .select("id")
                              .eq("company_id", profile.company_id)
                              .eq("name", "Urlaubsanträge")
                              .maybeSingle();
                            
                            let groupId: string;
                            if (existingGroup) {
                              groupId = existingGroup.id;
                            } else {
                              const { data: newGroup, error: createErr } = await supabase
                                .from("chat_groups")
                                .insert({ name: "Urlaubsanträge", company_id: profile.company_id, created_by: user.id })
                                .select("id")
                                .single();
                              if (createErr) throw createErr;
                              groupId = newGroup.id;
                              // Add the creator as member
                              await supabase.from("chat_group_members").insert({ group_id: groupId, user_id: user.id });
                            }

                            // Ensure current user is a member
                            const { data: membership } = await supabase
                              .from("chat_group_members")
                              .select("id")
                              .eq("group_id", groupId)
                              .eq("user_id", user.id)
                              .maybeSingle();
                            if (!membership) {
                              await supabase.from("chat_group_members").insert({ group_id: groupId, user_id: user.id });
                            }
                            
                            const fromFormatted = format(new Date(vacationFrom + "T00:00:00"), "dd.MM.yyyy", { locale: de });
                            const toFormatted = format(new Date(vacationTo + "T00:00:00"), "dd.MM.yyyy", { locale: de });
                            const content = `📋 **Urlaubsantrag**\n👤 ${myProfile?.full_name || "Mitarbeiter"}\n📅 ${fromFormatted} – ${toFormatted}${vacationNote ? `\n💬 ${vacationNote}` : ""}`;
                            
                            const { error: msgErr } = await supabase.from("chat_messages").insert({
                              sender_id: user.id,
                              company_id: profile.company_id,
                              chat_group_id: groupId,
                              content,
                            });
                            if (msgErr) throw msgErr;
                            
                            toast.success("Urlaubsantrag eingereicht!");
                            setVacationFrom("");
                            setVacationTo("");
                            setVacationNote("");
                          } catch (err) {
                            console.error(err);
                            toast.error("Fehler beim Einreichen des Antrags");
                          } finally {
                            setIsSubmittingVacation(false);
                          }
                        }}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Antrag einreichen
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>
          )}

          {activeTab === "calendar" && (
            <EmployeeCalendarTab />
          )}

          {activeTab === "chat" && (
            <EmployeeChatTab />
          )}
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-border bg-muted shadow-[0_-4px_16px_rgba(0,0,0,0.15)] safe-bottom">
        <div className="flex items-stretch h-20 md:h-16">
          <button
            onClick={() => setActiveTab("todos")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "todos" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">Start</span>
          </button>
          <button
            onClick={() => setActiveTab("hours")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "hours" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-xs font-medium">Stunden</span>
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "calendar" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-xs font-medium">Kalender</span>
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "chat" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-medium">Chat</span>
          </button>
        </div>
      </nav>

      {/* Create Site Dialog */}
      {profile?.company_id && user?.id && (
        <ConstructionSiteEditDialog
          site={null}
          open={isCreateSiteDialogOpen}
          onOpenChange={setIsCreateSiteDialogOpen}
          mode="create"
          companyId={profile.company_id}
          userId={user.id}
        />
      )}
    </div>
  );
};

interface ConstructionSiteCardProps {
  assignment: EmployeeAssignment;
  currentUserId: string;
}

const ConstructionSiteCard = ({ assignment, currentUserId }: ConstructionSiteCardProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const site = assignment.daily_assignments.construction_sites;
  const dailyAssignment = assignment.daily_assignments;
  const dailyAssignmentId = assignment.daily_assignment_id;

  // Track pending mutation item IDs
  const [pendingTodoIds, setPendingTodoIds] = useState<Set<string>>(new Set());
  const [pendingPackingIds, setPendingPackingIds] = useState<Set<string>>(new Set());
  const [pendingMaterialIds, setPendingMaterialIds] = useState<Set<string>>(new Set());

  const [newTodoText, setNewTodoText] = useState("");
  const [newPackingText, setNewPackingText] = useState("");
  const [showTodoInput, setShowTodoInput] = useState(false);
  const [showPackingInput, setShowPackingInput] = useState(false);

  const [todosOpen, setTodosOpen] = useState(true);
  const [packingOpen, setPackingOpen] = useState(true);
  const [materialsOpen, setMaterialsOpen] = useState(true);

  // Fetch installation manager name
  const { data: installationManager } = useQuery({
    queryKey: ["installation-manager", dailyAssignment.installation_manager_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles_limited" as any)
        .select("full_name")
        .eq("id", dailyAssignment.installation_manager_id)
        .single();
      
      if (error) throw error;
      return data as unknown as { full_name: string | null };
    },
    enabled: !!dailyAssignment.installation_manager_id,
  });

  // Fetch ALL daily_assignment_ids for this construction site on this day
  const { data: allSiteDailyAssignmentIds = [dailyAssignmentId] } = useQuery({
    queryKey: ["site-daily-assignments", site.id, dailyAssignment.assignment_date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_assignments")
        .select("id")
        .eq("construction_site_id", site.id)
        .eq("assignment_date", dailyAssignment.assignment_date);
      if (error) throw error;
      return (data || []).map(da => da.id);
    },
    enabled: !!site.id && !!dailyAssignment.assignment_date,
  });

  // Fetch ALL team members for this construction site on this day (not just same daily_assignment_id)
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["assignment-team", site.id, dailyAssignment.assignment_date],
    queryFn: async () => {
      // Get ALL employee_assignments for these daily_assignments
      const { data: allEmployeeAssignments, error: eaError } = await supabase
        .from("employee_assignments")
        .select("employee_id")
        .in("daily_assignment_id", allSiteDailyAssignmentIds);
      
      if (eaError) throw eaError;
      if (!allEmployeeAssignments || allEmployeeAssignments.length === 0) return [];
      
      const uniqueEmployeeIds = [...new Set(allEmployeeAssignments.map(a => a.employee_id))];
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles_limited" as any)
        .select("id, full_name")
        .in("id", uniqueEmployeeIds);
      
      if (profilesError) throw profilesError;
      
      const typedProfiles = (profiles || []) as unknown as { id: string; full_name: string | null }[];
      
      return uniqueEmployeeIds.map(empId => ({
        employee_id: empId,
        full_name: typedProfiles.find(p => p.id === empId)?.full_name || null
      })) as TeamMember[];
    },
    enabled: !!site.id && !!dailyAssignment.assignment_date && allSiteDailyAssignmentIds.length > 0,
  });

  // Format team members - show "Du" for current user, exclude installation manager
  const formattedTeamMembers = teamMembers
    .filter(m => m.employee_id !== dailyAssignment.installation_manager_id) // Don't duplicate manager
    .map(m => m.employee_id === currentUserId ? "Du" : (m.full_name || "Unbekannt"));

  const todosQueryKey = ["employee-custom-todos-site", site.id, dailyAssignment.assignment_date];
  const packingQueryKey = ["employee-packing-list-site", site.id, dailyAssignment.assignment_date];
  const materialsQueryKey = ["employee-material-todos-site", site.id, dailyAssignment.assignment_date];

  // Fetch custom todos for ALL assignments of this site on this day
  const { data: customTodos = [] } = useQuery({
    queryKey: [...todosQueryKey, allSiteDailyAssignmentIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_custom_todos")
        .select("*, profiles:employee_id(full_name)")
        .in("daily_assignment_id", allSiteDailyAssignmentIds)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return (data || []) as CustomTodo[];
    },
    enabled: allSiteDailyAssignmentIds.length > 0,
  });

  // Fetch packing list for ALL assignments of this site on this day
  const { data: packingList = [] } = useQuery({
    queryKey: [...packingQueryKey, allSiteDailyAssignmentIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_packing_list")
        .select("*")
        .in("daily_assignment_id", allSiteDailyAssignmentIds)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      
      const employeeIds = [...new Set((data || []).map(p => p.employee_id).filter(Boolean))] as string[];
      let profileMap: Record<string, string> = {};
      if (employeeIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", employeeIds);
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name || ""]));
        }
      }
      
      return (data || []).map(item => ({
        ...item,
        profiles: item.employee_id ? { full_name: profileMap[item.employee_id] || null } : null,
      })) as PackingItem[];
    },
    enabled: allSiteDailyAssignmentIds.length > 0,
  });

  // Fetch material todos for ALL assignments of this site on this day
  const { data: materialTodos = [] } = useQuery({
    queryKey: [...materialsQueryKey, allSiteDailyAssignmentIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_material_todos")
        .select(`
          *,
          profiles:employee_id (full_name),
          assignment_materials (
            id,
            quantity,
            materials (name, category)
          )
        `)
        .in("daily_assignment_id", allSiteDailyAssignmentIds)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return (data as unknown as MaterialTodo[]) || [];
    },
    enabled: allSiteDailyAssignmentIds.length > 0,
  });

  // Toggle custom todo mutation with optimistic update
  const toggleCustomTodoMutation = useMutation({
    mutationFn: async ({ todoId, isCompleted }: { todoId: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("employee_custom_todos")
        .update({ 
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null
        })
        .eq("id", todoId);
      if (error) throw error;
    },
    onMutate: async ({ todoId, isCompleted }) => {
      setPendingTodoIds(prev => new Set(prev).add(todoId));
      await queryClient.cancelQueries({ queryKey: todosQueryKey });
      const previous = queryClient.getQueryData<CustomTodo[]>(todosQueryKey);
      queryClient.setQueryData<CustomTodo[]>(todosQueryKey, old =>
        (old || []).map(t => t.id === todoId ? { ...t, is_completed: isCompleted } : t)
      );
      return { previous };
    },
    onError: (_err, { todoId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(todosQueryKey, context.previous);
      }
      setPendingTodoIds(prev => { const s = new Set(prev); s.delete(todoId); return s; });
      toast.error("Fehler beim Speichern");
    },
    onSuccess: (_data, { todoId }) => {
      setPendingTodoIds(prev => { const s = new Set(prev); s.delete(todoId); return s; });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: todosQueryKey });
    },
  });

  // Toggle packing item mutation with optimistic update
  const togglePackingItemMutation = useMutation({
    mutationFn: async ({ itemId, isChecked }: { itemId: string; isChecked: boolean }) => {
      const { error } = await supabase
        .from("assignment_packing_list")
        .update({ is_checked: isChecked })
        .eq("id", itemId);
      if (error) throw error;
    },
    onMutate: async ({ itemId, isChecked }) => {
      setPendingPackingIds(prev => new Set(prev).add(itemId));
      await queryClient.cancelQueries({ queryKey: packingQueryKey });
      const previous = queryClient.getQueryData<PackingItem[]>(packingQueryKey);
      queryClient.setQueryData<PackingItem[]>(packingQueryKey, old =>
        (old || []).map(p => p.id === itemId ? { ...p, is_checked: isChecked } : p)
      );
      return { previous };
    },
    onError: (_err, { itemId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(packingQueryKey, context.previous);
      }
      setPendingPackingIds(prev => { const s = new Set(prev); s.delete(itemId); return s; });
      toast.error("Fehler beim Speichern");
    },
    onSuccess: (_data, { itemId }) => {
      setPendingPackingIds(prev => { const s = new Set(prev); s.delete(itemId); return s; });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: packingQueryKey });
    },
  });

  // Toggle material todo mutation with optimistic update
  const toggleMaterialTodoMutation = useMutation({
    mutationFn: async ({ todoId, isCompleted }: { todoId: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("employee_material_todos")
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq("id", todoId);
      if (error) throw error;
    },
    onMutate: async ({ todoId, isCompleted }) => {
      setPendingMaterialIds(prev => new Set(prev).add(todoId));
      await queryClient.cancelQueries({ queryKey: materialsQueryKey });
      const previous = queryClient.getQueryData<MaterialTodo[]>(materialsQueryKey);
      queryClient.setQueryData<MaterialTodo[]>(materialsQueryKey, old =>
        (old || []).map(t => t.id === todoId ? { ...t, is_completed: isCompleted } : t)
      );
      return { previous };
    },
    onError: (_err, { todoId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(materialsQueryKey, context.previous);
      }
      setPendingMaterialIds(prev => { const s = new Set(prev); s.delete(todoId); return s; });
      toast.error("Fehler beim Speichern");
    },
    onSuccess: (_data, { todoId }) => {
      setPendingMaterialIds(prev => { const s = new Set(prev); s.delete(todoId); return s; });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: materialsQueryKey });
    },
  });


  // Add new custom todo mutation
  const addCustomTodoMutation = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase
        .from("employee_custom_todos")
        .insert({
          daily_assignment_id: dailyAssignmentId,
          employee_id: currentUserId,
          text,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewTodoText("");
      setShowTodoInput(false);
      queryClient.invalidateQueries({ queryKey: todosQueryKey });
      toast.success("To-Do hinzugefügt");
    },
    onError: (error: Error) => {
      toast.error("Fehler", { description: error.message });
    },
  });

  // Add new packing list item mutation
  const addPackingItemMutation = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase
        .from("assignment_packing_list")
        .insert({
          daily_assignment_id: dailyAssignmentId,
          employee_id: currentUserId,
          text,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPackingText("");
      setShowPackingInput(false);
      queryClient.invalidateQueries({ queryKey: packingQueryKey });
      toast.success("Packliste ergänzt");
    },
    onError: (error: Error) => {
      toast.error("Fehler", { description: error.message });
    },
  });

  // Show ALL items (own first, then others)
  const myTodos = [
    ...customTodos.filter(t => t.employee_id === currentUserId || t.employee_id === null),
    ...customTodos.filter(t => t.employee_id !== currentUserId && t.employee_id !== null),
  ];
  const myPackingItems = [
    ...packingList.filter(p => p.employee_id === currentUserId || p.employee_id === null),
    ...packingList.filter(p => p.employee_id !== currentUserId && p.employee_id !== null),
  ];
  const myMaterialTodos = [
    ...materialTodos.filter(t => t.employee_id === currentUserId),
    ...materialTodos.filter(t => t.employee_id !== currentUserId),
  ];

  // Calculate progress for each section
  const todoProgress = {
    completed: myTodos.filter(t => t.is_completed).length,
    total: myTodos.length
  };
  
  const packingProgress = {
    completed: myPackingItems.filter(p => p.is_checked).length,
    total: myPackingItems.length
  };
  
  const materialProgress = {
    completed: myMaterialTodos.filter(t => t.is_completed).length,
    total: myMaterialTodos.length
  };

  const hasAnyTasks = myTodos.length > 0 || myPackingItems.length > 0 || myMaterialTodos.length > 0;

  return (
    <Card 
      className="overflow-hidden rounded-2xl shadow-sm"
      style={{ 
        borderLeftWidth: '6px',
        borderLeftColor: site.color || 'hsl(var(--primary))'
      }}
    >
      <CardHeader className="pb-3">
        {/* Installation Manager and Team */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <User className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            {installationManager?.full_name || "Lädt..."}
          </span>
          {formattedTeamMembers.length > 0 && (
            <>
              <span>–</span>
              <span>{formattedTeamMembers.join(", ")}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-muted-foreground" />
          <CardTitle className="text-xl">Baustelle {site.customer_last_name}</CardTitle>
        </div>
        
        {/* Contact Info */}
        <div className="flex flex-col gap-2 mt-3">
          {site.address && (
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="flex-1">{site.address}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Time */}
        {(dailyAssignment.start_time || dailyAssignment.end_time) && (
          <p className="text-sm text-muted-foreground mt-2">
            {dailyAssignment.start_time?.slice(0, 5)} - {dailyAssignment.end_time?.slice(0, 5)} Uhr
          </p>
        )}

        {/* Notes */}
        {dailyAssignment.notes && (
          <p className="text-sm text-muted-foreground bg-muted p-2 rounded mt-2">
            {dailyAssignment.notes}
          </p>
        )}
        {/* Mitarbeiter zuteilen Button */}
        <Button
          variant="outline"
          className="w-full mt-3 gap-2 rounded-xl"
          onClick={() => navigate(`/employee/einsatz/${dailyAssignmentId}`)}
        >
          <Users className="w-4 h-4" />
          Mitarbeiter zuteilen & Details
        </Button>

      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* To-Dos Section */}
        <Collapsible open={todosOpen} onOpenChange={setTodosOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-muted/50 hover:bg-muted">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                <span className="font-medium">To-Dos</span>
              </div>
              <div className="flex items-center gap-2">
                {myTodos.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {todoProgress.completed}/{todoProgress.total}
                  </span>
                )}
                {todosOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-1">
            {myTodos.map((todo) => {
              const canToggle = true; // All employees can toggle all items like managers
              return (
                <div
                  key={todo.id}
                  className={`flex items-center gap-3 py-2 px-3 rounded transition-colors ${canToggle ? "cursor-pointer" : ""} ${
                    todo.is_completed 
                      ? "bg-green-500/15 hover:bg-green-500/20" 
                      : "hover:bg-muted/30"
                  }`}
                  onClick={() => {
                    if (canToggle) {
                      toggleCustomTodoMutation.mutate({
                        todoId: todo.id,
                        isCompleted: !todo.is_completed,
                      });
                    }
                  }}
                >
                  <Checkbox
                    checked={todo.is_completed || false}
                    onCheckedChange={() => {}}
                    disabled={!canToggle}
                    className="pointer-events-none"
                  />
                  <span className={`flex-1 ${todo.is_completed ? "line-through text-green-700 dark:text-green-400" : ""}`}>
                    {todo.text}
                  </span>
                  {todo.employee_id && todo.employee_id !== currentUserId && todo.profiles?.full_name && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{todo.profiles.full_name}</span>
                  )}
                  {pendingTodoIds.has(todo.id) && <PendingIndicator />}
                </div>
              );
            })}
            {showTodoInput ? (
              <form
                className="flex items-center gap-2 px-3 py-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newTodoText.trim()) addCustomTodoMutation.mutate(newTodoText.trim());
                }}
              >
                <Input
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  placeholder="Neues To-Do..."
                  className="flex-1 h-9 rounded-xl text-sm"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Escape") { setShowTodoInput(false); setNewTodoText(""); } }}
                />
                <Button type="submit" size="icon" className="h-9 w-9 rounded-xl shrink-0" disabled={!newTodoText.trim() || addCustomTodoMutation.isPending}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <button
                onClick={() => setShowTodoInput(true)}
                className="flex items-center gap-2 px-3 py-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>To-Do hinzufügen</span>
              </button>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Packing List Section */}
        <Collapsible open={packingOpen} onOpenChange={setPackingOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-muted/50 hover:bg-muted">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span className="font-medium">Packliste</span>
              </div>
              <div className="flex items-center gap-2">
                {myPackingItems.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {packingProgress.completed}/{packingProgress.total}
                  </span>
                )}
                {packingOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-1">
            {myPackingItems.map((item) => {
              const canToggle = true; // All employees can toggle all items like managers
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 py-2 px-3 rounded transition-colors ${canToggle ? "cursor-pointer" : ""} ${
                    item.is_checked 
                      ? "bg-green-500/15 hover:bg-green-500/20" 
                      : "hover:bg-muted/30"
                  }`}
                  onClick={() => {
                    if (canToggle) {
                      togglePackingItemMutation.mutate({
                        itemId: item.id,
                        isChecked: !item.is_checked,
                      });
                    }
                  }}
                >
                  <Checkbox
                    checked={item.is_checked || false}
                    onCheckedChange={() => {}}
                    disabled={!canToggle}
                    className="pointer-events-none"
                  />
                  <span className={`flex-1 ${item.is_checked ? "line-through text-green-700 dark:text-green-400" : ""}`}>
                    {item.text}
                  </span>
                  {item.employee_id && item.employee_id !== currentUserId && item.profiles?.full_name && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{item.profiles.full_name}</span>
                  )}
                  {pendingPackingIds.has(item.id) && <PendingIndicator />}
                </div>
              );
            })}
            {showPackingInput ? (
              <form
                className="flex items-center gap-2 px-3 py-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newPackingText.trim()) addPackingItemMutation.mutate(newPackingText.trim());
                }}
              >
                <Input
                  value={newPackingText}
                  onChange={(e) => setNewPackingText(e.target.value)}
                  placeholder="Neuer Eintrag..."
                  className="flex-1 h-9 rounded-xl text-sm"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Escape") { setShowPackingInput(false); setNewPackingText(""); } }}
                />
                <Button type="submit" size="icon" className="h-9 w-9 rounded-xl shrink-0" disabled={!newPackingText.trim() || addPackingItemMutation.isPending}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <button
                onClick={() => setShowPackingInput(true)}
                className="flex items-center gap-2 px-3 py-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Eintrag hinzufügen</span>
              </button>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Material Section */}
        {myMaterialTodos.length > 0 && (
          <Collapsible open={materialsOpen} onOpenChange={setMaterialsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-muted/50 hover:bg-muted">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  <span className="font-medium">Material</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {materialProgress.completed}/{materialProgress.total}
                  </span>
                  {materialsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1">
              {myMaterialTodos.map((todo) => {
                const materialName = todo.assignment_materials?.materials?.name || "Unbekanntes Material";
                const quantity = todo.quantity && todo.quantity > 1 ? ` ×${todo.quantity}` : "";
                const canToggle = true; // All employees can toggle all items like managers
                
                return (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-3 py-2 px-3 rounded transition-colors ${canToggle ? "cursor-pointer" : ""} ${
                      todo.is_completed 
                        ? "bg-green-500/15 hover:bg-green-500/20" 
                        : "hover:bg-muted/30"
                    }`}
                    onClick={() => {
                      if (canToggle) {
                        toggleMaterialTodoMutation.mutate({
                          todoId: todo.id,
                          isCompleted: !todo.is_completed,
                        });
                      }
                    }}
                  >
                    <Checkbox
                      checked={todo.is_completed || false}
                      onCheckedChange={() => {}}
                      disabled={!canToggle}
                      className="pointer-events-none"
                    />
                    <span className={`flex-1 ${todo.is_completed ? "line-through text-green-700 dark:text-green-400" : ""}`}>
                      {materialName}{quantity}
                    </span>
                    {todo.employee_id !== currentUserId && todo.profiles?.full_name && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{(todo.profiles as any).full_name}</span>
                    )}
                    {pendingMaterialIds.has(todo.id) && <PendingIndicator />}
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Empty state if no tasks */}
        {!hasAnyTasks && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Keine Aufgaben für diese Baustelle.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeWorkday;
