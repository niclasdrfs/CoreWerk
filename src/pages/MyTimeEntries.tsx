import { useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Building2, Pencil, Check, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, differenceInMinutes, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

const MyTimeEntries = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ clockIn: "", clockOut: "" });

  const basePath = location.pathname.includes("/ober-montageleiter")
    ? "/ober-montageleiter"
    : location.pathname.includes("/employee")
      ? "/employee/workday"
      : "/installation-manager";

  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd'T'00:00:00");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd'T'23:59:59");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["my-time-entries", user?.id, monthStart],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          construction_sites (
            customer_last_name,
            color
          )
        `)
        .eq("user_id", user.id)
        .gte("clock_in", monthStart)
        .lte("clock_in", monthEnd)
        .order("clock_in", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, typeof entries> = {};
    for (const entry of entries) {
      const dateKey = format(parseISO(entry.clock_in), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [entries]);

  const totalMinutes = useMemo(() => {
    return entries.reduce((sum, e) => {
      if (!e.clock_out) return sum;
      return sum + differenceInMinutes(parseISO(e.clock_out), parseISO(e.clock_in));
    }, 0);
  }, [entries]);

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  };

  const startEdit = useCallback((entry: any) => {
    setEditingId(entry.id);
    setEditValues({
      clockIn: format(parseISO(entry.clock_in), "HH:mm"),
      clockOut: entry.clock_out ? format(parseISO(entry.clock_out), "HH:mm") : "",
    });
  }, []);

  const saveEdit = useCallback(async (entry: any) => {
    try {
      const dateStr = format(parseISO(entry.clock_in), "yyyy-MM-dd");
      const newClockIn = new Date(`${dateStr}T${editValues.clockIn}:00`).toISOString();
      const newClockOut = editValues.clockOut
        ? new Date(`${dateStr}T${editValues.clockOut}:00`).toISOString()
        : null;

      const { error } = await supabase
        .from("time_entries")
        .update({ clock_in: newClockIn, clock_out: newClockOut })
        .eq("id", entry.id);

      if (error) throw error;
      toast.success("Zeiteintrag aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["my-time-entries"] });
      setEditingId(null);
    } catch {
      toast.error("Fehler beim Speichern");
    }
  }, [editValues, queryClient]);

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-card safe-top sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(basePath)} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4 max-w-2xl">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-bold">
              {format(currentMonth, "MMMM yyyy", { locale: de })}
            </h1>
            <p className="text-xs text-muted-foreground">
              {entries.length} Buchungen · {formatDuration(totalMinutes)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Summary Card */}
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 text-center gap-2">
              <div>
                <p className="text-2xl font-bold text-foreground">{entries.length}</p>
                <p className="text-xs text-muted-foreground">Buchungen</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(totalMinutes / 60).toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Stunden</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{groupedEntries.length}</p>
                <p className="text-xs text-muted-foreground">Tage</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entries grouped by day */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Lade Buchungen...</div>
        ) : groupedEntries.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Keine Buchungen in diesem Monat</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedEntries.map(([dateKey, dayEntries]) => {
              const dayTotal = dayEntries.reduce((sum, e) => {
                if (!e.clock_out) return sum;
                return sum + differenceInMinutes(parseISO(e.clock_out), parseISO(e.clock_in));
              }, 0);

              return (
                <div key={dateKey}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-sm font-semibold">
                      {format(parseISO(dateKey), "EEEE, d. MMMM", { locale: de })}
                    </h3>
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {formatDuration(dayTotal)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {dayEntries.map((entry: any) => {
                      const isEditing = editingId === entry.id;
                      const duration = entry.clock_out
                        ? differenceInMinutes(parseISO(entry.clock_out), parseISO(entry.clock_in))
                        : null;
                      const siteName = entry.construction_sites?.customer_last_name;
                      const siteColor = entry.construction_sites?.color;

                      return (
                        <Card key={entry.id} className="rounded-xl overflow-hidden">
                          <CardContent className="p-0">
                            <div className="flex items-stretch">
                              {/* Color bar */}
                              <div
                                className="w-1.5 shrink-0"
                                style={{ backgroundColor: siteColor || 'hsl(var(--primary))' }}
                              />

                              <div className="flex-1 p-3">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-xs text-muted-foreground">Von</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          placeholder="08:00"
                                          value={editValues.clockIn}
                                          onChange={e => {
                                            let val = e.target.value.replace(/[^\d:]/g, '');
                                            if (val.length === 2 && !val.includes(':') && editValues.clockIn.length < val.length) val += ':';
                                            if (val.length <= 5) setEditValues(v => ({ ...v, clockIn: val }));
                                          }}
                                          maxLength={5}
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-muted-foreground">Bis</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          placeholder="17:00"
                                          value={editValues.clockOut}
                                          onChange={e => {
                                            let val = e.target.value.replace(/[^\d:]/g, '');
                                            if (val.length === 2 && !val.includes(':') && editValues.clockOut.length < val.length) val += ':';
                                            if (val.length <= 5) setEditValues(v => ({ ...v, clockOut: val }));
                                          }}
                                          maxLength={5}
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingId(null)}
                                        className="h-7 px-2"
                                      >
                                        <X className="w-3.5 h-3.5 mr-1" />
                                        Abbrechen
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => saveEdit(entry)}
                                        disabled={!editValues.clockIn.match(/^\d{2}:\d{2}$/)}
                                        className="h-7 px-2"
                                      >
                                        <Check className="w-3.5 h-3.5 mr-1" />
                                        Speichern
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => startEdit(entry)}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                          {format(parseISO(entry.clock_in), "HH:mm")}
                                          {" – "}
                                          {entry.clock_out
                                            ? format(parseISO(entry.clock_out), "HH:mm")
                                            : "läuft"}
                                        </span>
                                        {duration !== null && (
                                          <span className="text-xs text-muted-foreground">
                                            ({(duration / 60).toFixed(1)}h)
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        {siteName ? (
                                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Building2 className="w-3 h-3" />
                                            {siteName}
                                          </span>
                                        ) : entry.leistung ? (
                                          <span className="text-xs text-muted-foreground">
                                            {entry.leistung}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">
                                            Allgemein
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyTimeEntries;
