import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, differenceInMinutes } from "date-fns";
import { de } from "date-fns/locale";
import { Clock, User, Building2, MapPin, Timer } from "lucide-react";
import { ExcavatorIcon } from "@/components/icons/ExcavatorIcon";
import { useEffect, useState, useMemo } from "react";

export const TimeTracking = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch all time entries
  const { data: timeEntries, isLoading: isLoadingEntries } = useQuery({
    queryKey: ["time-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .order("clock_in", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles separately
  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      if (error) throw error;
      return data;
    },
  });

  // Fetch active construction sites
  const { data: sites } = useQuery({
    queryKey: ["active-construction-sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_sites")
        .select("id, customer_last_name, color, status, address")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, { full_name: string | null; email: string }>();
    profiles?.forEach((p) => map.set(p.id, { full_name: p.full_name, email: p.email }));
    return map;
  }, [profiles]);

  const siteMap = useMemo(() => {
    const map = new Map<string, { customer_last_name: string; color: string | null; address: string | null }>();
    sites?.forEach((s) => map.set(s.id, { customer_last_name: s.customer_last_name, color: s.color, address: s.address }));
    return map;
  }, [sites]);

  const activeEntries = useMemo(
    () => timeEntries?.filter((e) => !e.clock_out) || [],
    [timeEntries]
  );

  // Group time entries by construction site
  const siteGroupedEntries = useMemo(() => {
    if (!timeEntries || !sites) return [];

    const groups = new Map<string, {
      siteId: string;
      siteName: string;
      siteColor: string | null;
      siteAddress: string | null;
      entries: typeof timeEntries;
      totalMinutes: number;
      activeCount: number;
    }>();

    // Initialize all active sites
    sites.forEach((site) => {
      groups.set(site.id, {
        siteId: site.id,
        siteName: site.customer_last_name,
        siteColor: site.color,
        siteAddress: site.address,
        entries: [],
        totalMinutes: 0,
        activeCount: 0,
      });
    });

    // Assign entries to sites
    timeEntries.forEach((entry) => {
      if (!entry.construction_site_id) return;
      const group = groups.get(entry.construction_site_id);
      if (!group) return;

      group.entries.push(entry);
      if (entry.clock_out) {
        group.totalMinutes += differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in));
      } else {
        group.totalMinutes += differenceInMinutes(now, new Date(entry.clock_in));
        group.activeCount++;
      }
    });

    return Array.from(groups.values())
      .filter((g) => g.entries.length > 0 || g.activeCount > 0)
      .sort((a, b) => b.activeCount - a.activeCount || b.totalMinutes - a.totalMinutes);
  }, [timeEntries, sites, now]);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const calculateLiveDuration = (clockIn: string) => {
    const minutes = differenceInMinutes(now, new Date(clockIn));
    return formatDuration(minutes);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="sites" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sites" className="gap-1.5">
            <Building2 className="w-4 h-4" />
            Baustellen
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1.5">
            <Clock className="w-4 h-4" />
            Aktiv
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <User className="w-4 h-4" />
            Verlauf
          </TabsTrigger>
        </TabsList>

        {/* BAUSTELLEN-ÜBERSICHT */}
        <TabsContent value="sites" className="space-y-4 mt-4">
          {isLoadingEntries ? (
            <div className="text-center py-4">Laden...</div>
          ) : siteGroupedEntries.length > 0 ? (
            <>
              {/* Total overview bar */}
              <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3 mb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ExcavatorIcon className="w-4 h-4" />
                  <span>{siteGroupedEntries.length} Baustellen</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Timer className="w-4 h-4 text-muted-foreground" />
                  {formatDuration(siteGroupedEntries.reduce((sum, g) => sum + g.totalMinutes, 0))}
                </div>
              </div>

              {siteGroupedEntries.map((group) => {
                const employeeMap = new Map<string, {
                  name: string;
                  entries: typeof timeEntries;
                  totalMinutes: number;
                  isActive: boolean;
                  services: Set<string>;
                }>();

                group.entries.forEach((entry) => {
                  const profile = profileMap.get(entry.user_id);
                  const name = profile?.full_name || "Unbekannt";
                  if (!employeeMap.has(entry.user_id)) {
                    employeeMap.set(entry.user_id, {
                      name,
                      entries: [],
                      totalMinutes: 0,
                      isActive: false,
                      services: new Set(),
                    });
                  }
                  const emp = employeeMap.get(entry.user_id)!;
                  emp.entries.push(entry);
                  if (entry.leistung) emp.services.add(entry.leistung);
                  if (entry.clock_out) {
                    emp.totalMinutes += differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in));
                  } else {
                    emp.totalMinutes += differenceInMinutes(now, new Date(entry.clock_in));
                    emp.isActive = true;
                  }
                });

                const employees = Array.from(employeeMap.values()).sort(
                  (a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || b.totalMinutes - a.totalMinutes
                );

                const totalHours = (group.totalMinutes / 60).toFixed(1);

                return (
                  <Card
                    key={group.siteId}
                    className={`overflow-hidden ${group.activeCount > 0 ? "ring-1 ring-green-500/30" : ""}`}
                  >
                    {/* Site Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: group.siteColor || "hsl(var(--muted-foreground))" }}
                      >
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{group.siteName}</h3>
                        {group.siteAddress && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {group.siteAddress}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {group.activeCount > 0 && (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700 mb-1">
                            {group.activeCount} aktiv
                          </Badge>
                        )}
                      </div>
                    </div>

                    <CardContent className="p-0">
                      {/* Employee rows */}
                      <div className="divide-y divide-border">
                        {employees.map((emp) => (
                          <div
                            key={emp.name}
                            className={`flex items-center gap-3 px-4 py-2.5 ${emp.isActive ? "bg-green-50/50 dark:bg-green-950/10" : ""}`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${emp.isActive ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                                {emp.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                  {emp.name}
                                  {emp.isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />}
                                </p>
                                {emp.services.size > 0 && (
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {Array.from(emp.services).join(", ")}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs text-muted-foreground">{emp.entries.length}×</span>
                              <span className={`text-sm font-mono font-semibold ${emp.isActive ? "text-green-600" : "text-foreground"}`}>
                                {formatDuration(emp.totalMinutes)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Site total footer */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-t border-border">
                        <span className="text-xs font-medium text-muted-foreground">
                          Gesamt · {employees.length} Mitarbeiter · {group.entries.length} Einträge
                        </span>
                        <span className="text-sm font-mono font-bold text-primary">
                          {formatDuration(group.totalMinutes)} ({totalHours}h)
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Keine Zeiteinträge für Baustellen vorhanden</p>
            </div>
          )}
        </TabsContent>

        {/* AKTIV EINGESTEMPELT */}
        <TabsContent value="active" className="mt-4">
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-600" />
                <CardTitle>Aktuell eingestempelt</CardTitle>
              </div>
              <CardDescription>Mitarbeiter die gerade arbeiten</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEntries && !timeEntries ? (
                <div className="text-center py-4">Laden...</div>
              ) : activeEntries.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mitarbeiter</TableHead>
                        <TableHead>Baustelle</TableHead>
                        <TableHead>Leistung</TableHead>
                        <TableHead>Eingestempelt seit</TableHead>
                        <TableHead>Arbeitszeit</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeEntries.map((entry) => {
                        const profile = profileMap.get(entry.user_id);
                        const site = entry.construction_site_id ? siteMap.get(entry.construction_site_id) : null;
                        return (
                          <TableRow key={entry.id} className="bg-green-50/50 dark:bg-green-950/20">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                {profile?.full_name || "Unbekannt"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {site ? (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: site.color || "hsl(var(--muted-foreground))" }}
                                  />
                                  {site.customer_last_name}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {entry.leistung || "—"}
                            </TableCell>
                            <TableCell>
                              {format(new Date(entry.clock_in), "dd.MM.yyyy HH:mm", { locale: de })} Uhr
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-green-600">
                              {calculateLiveDuration(entry.clock_in)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                Aktiv
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Derzeit keine Mitarbeiter eingestempelt</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VERLAUF */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Zeiterfassung Verlauf</CardTitle>
              <CardDescription>Alle Arbeitszeiten der Mitarbeiter</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEntries && !timeEntries ? (
                <div className="text-center py-4">Zeiteinträge werden geladen...</div>
              ) : timeEntries && timeEntries.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mitarbeiter</TableHead>
                        <TableHead>Baustelle</TableHead>
                        <TableHead>Leistung</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Einstempeln</TableHead>
                        <TableHead>Ausstempeln</TableHead>
                        <TableHead>Arbeitszeit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeEntries.map((entry) => {
                        const profile = profileMap.get(entry.user_id);
                        const site = entry.construction_site_id ? siteMap.get(entry.construction_site_id) : null;
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium">
                              {profile?.full_name || "Unbekannt"}
                            </TableCell>
                            <TableCell>
                              {site ? (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: site.color || "hsl(var(--muted-foreground))" }}
                                  />
                                  {site.customer_last_name}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {entry.leistung || "—"}
                            </TableCell>
                            <TableCell>
                              {format(new Date(entry.clock_in), "dd.MM.yyyy", { locale: de })}
                            </TableCell>
                            <TableCell>
                              {format(new Date(entry.clock_in), "HH:mm", { locale: de })} Uhr
                            </TableCell>
                            <TableCell>
                              {entry.clock_out
                                ? `${format(new Date(entry.clock_out), "HH:mm", { locale: de })} Uhr`
                                : <Badge variant="outline" className="text-green-600 border-green-600">Aktiv</Badge>}
                            </TableCell>
                            <TableCell className="font-mono">
                              {entry.clock_out
                                ? formatDuration(differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)))
                                : <span className="text-green-600">{calculateLiveDuration(entry.clock_in)}</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  Keine Zeiteinträge gefunden
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
