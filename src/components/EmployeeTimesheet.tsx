import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format, differenceInMinutes, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Download, User, Calendar, Check, X } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EmployeeTimesheetProps {
  onBack: () => void;
}

export const EmployeeTimesheet = ({ onBack }: EmployeeTimesheetProps) => {
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    clock_in_time: string;
    clock_out_time: string;
    leistung: string;
    construction_site_id: string;
  }>({ clock_in_time: "", clock_out_time: "", leistung: "", construction_site_id: "" });

  const startEditing = useCallback((entry: any) => {
    setEditingEntryId(entry.id);
    setEditValues({
      clock_in_time: format(new Date(entry.clock_in), "HH:mm"),
      clock_out_time: entry.clock_out ? format(new Date(entry.clock_out), "HH:mm") : "",
      leistung: entry.leistung || "",
      construction_site_id: entry.construction_site_id || "",
    });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingEntryId(null);
  }, []);

  const saveEditing = useCallback(async (entry: any) => {
    try {
      const entryDate = format(new Date(entry.clock_in), "yyyy-MM-dd");
      const newClockIn = new Date(`${entryDate}T${editValues.clock_in_time}:00`).toISOString();
      const newClockOut = editValues.clock_out_time
        ? new Date(`${entryDate}T${editValues.clock_out_time}:00`).toISOString()
        : null;

      const { error } = await supabase
        .from("time_entries")
        .update({
          clock_in: newClockIn,
          clock_out: newClockOut,
          leistung: editValues.leistung || null,
          construction_site_id: editValues.construction_site_id || null,
        })
        .eq("id", entry.id);

      if (error) throw error;
      toast.success("Zeiteintrag aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["time-entries-month"] });
      setEditingEntryId(null);
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Speichern");
    }
  }, [editValues, queryClient]);

  // Fetch all profiles
  const { data: profiles } = useQuery({
    queryKey: ["all-profiles-timesheet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, vacation_days")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch construction sites
  const { data: sites } = useQuery({
    queryKey: ["sites-timesheet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_sites")
        .select("id, customer_last_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch time entries for the selected month
  const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
  const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));

  const { data: timeEntries, isLoading } = useQuery({
    queryKey: ["time-entries-month", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .gte("clock_in", monthStart.toISOString())
        .lte("clock_in", monthEnd.toISOString())
        .order("clock_in", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const siteMap = useMemo(() => {
    const map = new Map<string, string>();
    sites?.forEach((s) => map.set(s.id, s.customer_last_name));
    return map;
  }, [sites]);

  // Calculate per-employee monthly summaries
  const employeeSummaries = useMemo(() => {
    if (!timeEntries || !profiles) return [];

    const map = new Map<string, {
      id: string;
      name: string;
      email: string;
      totalMinutes: number;
      entries: typeof timeEntries;
    }>();

    profiles.forEach((p) => {
      map.set(p.id, {
        id: p.id,
        name: p.full_name || "Unbekannt",
        email: p.email,
        totalMinutes: 0,
        entries: [],
      });
    });

    timeEntries.forEach((entry) => {
      const emp = map.get(entry.user_id);
      if (!emp) return;
      emp.entries.push(entry);
      if (entry.clock_out) {
        emp.totalMinutes += differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in));
      }
    });

    return Array.from(map.values())
      .filter((e) => e.entries.length > 0)
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [timeEntries, profiles]);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const formatHoursDecimal = (minutes: number) => {
    return (minutes / 60).toFixed(2);
  };

  const monthLabel = format(new Date(selectedYear, selectedMonth), "MMMM yyyy", { locale: de });

  // Get detail entries for the selected employee
  const selectedEmpData = useMemo(() => {
    if (!selectedEmployee) return null;
    return employeeSummaries.find((e) => e.id === selectedEmployee) || null;
  }, [selectedEmployee, employeeSummaries]);

  // Group entries by day for detail view
  const dailyEntries = useMemo(() => {
    if (!selectedEmpData) return [];

    const dayMap = new Map<string, {
      date: string;
      entries: typeof timeEntries;
      totalMinutes: number;
    }>();

    const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth));
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = format(new Date(selectedYear, selectedMonth, d), "yyyy-MM-dd");
      dayMap.set(dateStr, { date: dateStr, entries: [], totalMinutes: 0 });
    }

    selectedEmpData.entries.forEach((entry) => {
      const dateStr = format(new Date(entry.clock_in), "yyyy-MM-dd");
      const day = dayMap.get(dateStr);
      if (!day) return;
      day.entries.push(entry);
      if (entry.clock_out) {
        day.totalMinutes += differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in));
      }
    });

    return Array.from(dayMap.values());
  }, [selectedEmpData, selectedYear, selectedMonth]);

  // Summary calculations
  const workDays = useMemo(() => dailyEntries.filter((d) => d.entries.length > 0).length, [dailyEntries]);
  const standardHoursPerDay = 8;
  const totalStandardMinutes = workDays * standardHoursPerDay * 60;
  const overtimeMinutes = selectedEmpData ? Math.max(0, selectedEmpData.totalMinutes - totalStandardMinutes) : 0;

  // Generate PDF
  const downloadPDF = () => {
    if (!selectedEmpData) return;

    const doc = new jsPDF();
    const empName = selectedEmpData.name;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header line
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(1.5);
    doc.line(14, 14, pageWidth - 14, 14);

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("ZEITERFASSUNGSBOGEN", 14, 26);

    // Meta info
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const metaY = 34;
    doc.text(`Mitarbeiter:`, 14, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(empName, 50, metaY);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Zeitraum:`, 14, metaY + 6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(monthLabel, 50, metaY + 6);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Erstellt am:`, 14, metaY + 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(format(new Date(), "dd.MM.yyyy, HH:mm 'Uhr'", { locale: de }), 50, metaY + 12);

    doc.setTextColor(0);

    // Table data
    const tableData = dailyEntries.map((day) => {
      const dateFormatted = format(new Date(day.date), "EEE, dd.MM.", { locale: de });
      const dayDate = new Date(day.date);
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      
      if (day.entries.length === 0) {
        return { data: [dateFormatted, "—", "—", "—", "—", "—"], isWeekend };
      }

      const clockIns = day.entries.map((e) => format(new Date(e.clock_in), "HH:mm")).join("\n");
      const clockOuts = day.entries.map((e) => e.clock_out ? format(new Date(e.clock_out), "HH:mm") : "aktiv").join("\n");
      const sites = day.entries.map((e) => e.construction_site_id ? (siteMap.get(e.construction_site_id) || "—") : "—").join("\n");
      const leistungen = day.entries.map((e) => e.leistung || "—").join("\n");

      return { data: [dateFormatted, clockIns, clockOuts, sites, leistungen, formatDuration(day.totalMinutes)], isWeekend };
    });

    autoTable(doc, {
      startY: 52,
      head: [["Datum", "Von", "Bis", "Baustelle", "Leistung", "Stunden"]],
      body: tableData.map(r => r.data),
      styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: [220, 220, 220], lineWidth: 0.3 },
      headStyles: { fillColor: [41, 128, 185], fontSize: 8, fontStyle: "bold", textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: "bold" },
        1: { cellWidth: 18 },
        2: { cellWidth: 18 },
        5: { halign: "right", fontStyle: "bold", cellWidth: 22 },
      },
      didParseCell: (data) => {
        if (data.section === "body") {
          const row = tableData[data.row.index];
          if (row?.isWeekend) {
            data.cell.styles.fillColor = [235, 238, 242];
            data.cell.styles.textColor = [150, 150, 150];
          }
        }
      },
    });

    // Summary box at bottom
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, finalY, pageWidth - 28, 38, 3, 3, "S");

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Zusammenfassung", 20, finalY + 8);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const col1X = 20;
    const col2X = pageWidth / 2 + 10;
    const row1Y = finalY + 16;
    const rowH = 6;

    doc.text("Arbeitstage:", col1X, row1Y);
    doc.setFont("helvetica", "bold");
    doc.text(`${workDays} Tage`, col1X + 40, row1Y);

    doc.setFont("helvetica", "normal");
    doc.text("Gesamtstunden:", col1X, row1Y + rowH);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatDuration(selectedEmpData.totalMinutes)} (${formatHoursDecimal(selectedEmpData.totalMinutes)}h)`, col1X + 40, row1Y + rowH);

    doc.setFont("helvetica", "normal");
    doc.text("Sollstunden:", col2X, row1Y);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatDuration(totalStandardMinutes)}`, col2X + 40, row1Y);

    doc.setFont("helvetica", "normal");
    doc.text("Überstunden:", col2X, row1Y + rowH);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(overtimeMinutes > 0 ? 220 : 0, overtimeMinutes > 0 ? 50 : 0, overtimeMinutes > 0 ? 50 : 0);
    doc.text(`${formatDuration(overtimeMinutes)} (${formatHoursDecimal(overtimeMinutes)}h)`, col2X + 40, row1Y + rowH);
    doc.setTextColor(0);

    doc.setFont("helvetica", "normal");
    doc.text("Urlaubstage:", col1X, row1Y + rowH * 2);
    doc.setFont("helvetica", "bold");
    const empProfile = profiles?.find(p => p.id === selectedEmployee);
    const vacDays = empProfile?.vacation_days ?? 0;
    doc.text(`${vacDays} Tage/Jahr`, col1X + 40, row1Y + rowH * 2);

    doc.setFont("helvetica", "normal");
    doc.text("Krankheitstage:", col2X, row1Y + rowH * 2);
    doc.setFont("helvetica", "bold");
    doc.text("0 Tage", col2X + 40, row1Y + rowH * 2);

    // Signature lines
    const sigY = finalY + 52;
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.line(14, sigY, 90, sigY);
    doc.line(pageWidth - 90, sigY, pageWidth - 14, sigY);
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130);
    doc.text("Unterschrift Mitarbeiter", 14, sigY + 4);
    doc.text("Unterschrift Arbeitgeber", pageWidth - 90, sigY + 4);
    doc.setTextColor(0);

    doc.save(`Zeiterfassung_${empName.replace(/\s+/g, "_")}_${format(new Date(selectedYear, selectedMonth), "yyyy-MM")}.pdf`);
  };

  // Month selector options
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: format(new Date(selectedYear, i), "MMMM", { locale: de }),
  }));

  const years = Array.from({ length: 3 }, (_, i) => {
    const y = now.getFullYear() - i;
    return { value: y.toString(), label: y.toString() };
  });

  return (
    <div className="space-y-6">
      {/* Header with month/year selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 ml-auto">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Employee overview or detail */}
      {!selectedEmployee ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Mitarbeiter Übersicht – {monthLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Laden...</div>
            ) : employeeSummaries.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mitarbeiter</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Einträge</TableHead>
                      <TableHead className="text-right">Arbeitsstunden</TableHead>
                      <TableHead className="text-right">Stunden (dezimal)</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeSummaries.map((emp) => (
                      <TableRow
                        key={emp.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedEmployee(emp.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            {emp.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                        <TableCell>{emp.entries.length}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatDuration(emp.totalMinutes)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatHoursDecimal(emp.totalMinutes)}h
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="default" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold px-5">Details →</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total row */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={3}>Gesamt</TableCell>
                      <TableCell className="text-right font-mono text-primary">
                        {formatDuration(employeeSummaries.reduce((sum, e) => sum + e.totalMinutes, 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary">
                        {formatHoursDecimal(employeeSummaries.reduce((sum, e) => sum + e.totalMinutes, 0))}h
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Keine Zeiteinträge in diesem Monat</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Employee Detail View */
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(null)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {selectedEmpData?.name} – {monthLabel}
                </CardTitle>
              </div>
              <Button onClick={downloadPDF} className="gap-2">
                <Download className="w-4 h-4" />
                PDF herunterladen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {selectedEmpData ? (
              <>

                {/* Daily breakdown */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Einstempeln</TableHead>
                        <TableHead>Ausstempeln</TableHead>
                        <TableHead>Baustelle</TableHead>
                        <TableHead>Leistung</TableHead>
                        <TableHead className="text-right">Arbeitszeit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyEntries.map((day) => {
                        const dayDate = new Date(day.date);
                        const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
                        const hasEntries = day.entries.length > 0;

                        if (!hasEntries) {
                          return (
                            <TableRow
                              key={day.date}
                              className={isWeekend ? "bg-muted/20 text-muted-foreground" : "text-muted-foreground"}
                            >
                              <TableCell>
                                {format(dayDate, "EEE, dd.MM.", { locale: de })}
                              </TableCell>
                              <TableCell>—</TableCell>
                              <TableCell>—</TableCell>
                              <TableCell>—</TableCell>
                              <TableCell>—</TableCell>
                              <TableCell className="text-right">—</TableCell>
                            </TableRow>
                          );
                        }

                        return day.entries.map((entry, idx) => {
                          const isEditing = editingEntryId === entry.id;
                          return (
                          <TableRow
                            key={entry.id}
                            className={`${isWeekend ? "bg-muted/20" : ""} ${!isEditing ? "cursor-pointer" : ""}`}
                            onDoubleClick={() => !isEditing && startEditing(entry)}
                            onKeyDown={isEditing ? (e) => {
                              if (e.key === "Enter") { e.preventDefault(); saveEditing(entry); }
                              if (e.key === "Escape") { cancelEditing(); }
                            } : undefined}
                          >
                            {idx === 0 && (
                              <TableCell rowSpan={day.entries.length} className="font-medium align-top border-r">
                                {format(dayDate, "EEE, dd.MM.", { locale: de })}
                              </TableCell>
                            )}
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  type="time"
                                  value={editValues.clock_in_time}
                                  onChange={(e) => setEditValues(v => ({ ...v, clock_in_time: e.target.value }))}
                                  className="h-8 w-24"
                                />
                              ) : (
                                <>{format(new Date(entry.clock_in), "HH:mm")} Uhr</>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  type="time"
                                  value={editValues.clock_out_time}
                                  onChange={(e) => setEditValues(v => ({ ...v, clock_out_time: e.target.value }))}
                                  className="h-8 w-24"
                                />
                              ) : (
                                <>{entry.clock_out ? `${format(new Date(entry.clock_out), "HH:mm")} Uhr` : "aktiv"}</>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Select
                                  value={editValues.construction_site_id || "__none__"}
                                  onValueChange={(v) => setEditValues(prev => ({ ...prev, construction_site_id: v === "__none__" ? "" : v }))}
                                >
                                  <SelectTrigger className="h-8 w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Keine —</SelectItem>
                                    {sites?.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>{s.customer_last_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <>{entry.construction_site_id ? siteMap.get(entry.construction_site_id) || "—" : "—"}</>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  value={editValues.leistung}
                                  onChange={(e) => setEditValues(v => ({ ...v, leistung: e.target.value }))}
                                  className="h-8 w-32"
                                  placeholder="Leistung"
                                />
                              ) : (
                                <span className="text-muted-foreground">{entry.leistung || "—"}</span>
                              )}
                            </TableCell>
                            {isEditing ? (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={cancelEditing}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => saveEditing(entry)}>
                                    <Check className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            ) : (
                              idx === 0 && (
                                <TableCell
                                  rowSpan={day.entries.length}
                                  className="text-right font-mono font-semibold align-top border-l"
                                >
                                  {formatDuration(day.totalMinutes)}
                                </TableCell>
                              )
                            )}
                          </TableRow>
                          );
                        });
                      })}
                      {/* Total row */}
                      <TableRow className="bg-primary/10 font-semibold border-t-2 border-primary/30">
                        <TableCell colSpan={5}>Gesamtstunden – {monthLabel}</TableCell>
                        <TableCell className="text-right font-mono text-primary text-base">
                          {formatDuration(selectedEmpData.totalMinutes)} ({formatHoursDecimal(selectedEmpData.totalMinutes)}h)
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Professional summary footer */}
                <div className="mt-6 border rounded-lg p-5 bg-muted/20 space-y-4">
                  <h4 className="font-semibold text-foreground">Zusammenfassung</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Arbeitstage</p>
                      <p className="text-lg font-bold font-mono">{workDays} Tage</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Gesamtstunden</p>
                      <p className="text-lg font-bold font-mono text-primary">
                        {formatDuration(selectedEmpData.totalMinutes)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">({formatHoursDecimal(selectedEmpData.totalMinutes)}h)</span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Sollstunden</p>
                      <p className="text-lg font-bold font-mono">{formatDuration(totalStandardMinutes)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Überstunden</p>
                      <p className={`text-lg font-bold font-mono ${overtimeMinutes > 0 ? "text-destructive" : "text-foreground"}`}>
                        {formatDuration(overtimeMinutes)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">({formatHoursDecimal(overtimeMinutes)}h)</span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Urlaubstage/Jahr</p>
                      <p className="text-lg font-bold font-mono">{profiles?.find(p => p.id === selectedEmployee)?.vacation_days ?? 0} Tage</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Krankheitstage</p>
                      <p className="text-lg font-bold font-mono">0 Tage</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-4">Mitarbeiter nicht gefunden</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
