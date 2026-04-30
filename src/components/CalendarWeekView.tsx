import { useState, useRef, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getTextColor } from "@/lib/colorUtils";
import { HardHat, Trash2 } from "lucide-react";

interface Assignment {
  id: string;
  assignment_date: string;
  start_time: string;
  end_time: string;
  construction_sites: {
    customer_last_name: string;
    color: string | null;
  } | null;
}

interface DragData {
  siteId: string;
  siteName: string;
  siteColor: string;
}

interface EmployeeAssignment {
  id: string;
  employee_id: string;
  daily_assignment_id: string;
  daily_assignments: {
    assignment_date: string;
  } | null;
  profiles: {
    full_name: string | null;
    email: string;
  } | null;
}

interface CalendarWeekViewProps {
  weekDays: Date[];
  assignments: Assignment[] | undefined;
  todayStr: string;
  onAssignmentClick: (assignmentId: string) => void;
  onCreateAssignment?: (date: Date, siteId: string, startTime: string, endTime: string) => void;
  onUpdateAssignmentTimes?: (assignmentId: string, startTime: string, endTime: string) => void;
  onMoveAssignment?: (assignmentId: string, newDate: Date, startTime: string, endTime: string) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  selectedEmployeeDay?: number | null;
  onHelmetClick?: (dayIdx: number) => void;
  employeeAssignments?: EmployeeAssignment[];
  // New: Click-based creation
  onEmptyFieldClick?: (date: Date, startTime: string) => void;
  isSelectingMode?: boolean;
}

export const CalendarWeekView = ({
  weekDays,
  assignments,
  todayStr,
  onAssignmentClick,
  onCreateAssignment,
  onUpdateAssignmentTimes,
  onMoveAssignment,
  onDeleteAssignment,
  selectedEmployeeDay,
  onHelmetClick,
  employeeAssignments = [],
  onEmptyFieldClick,
  isSelectingMode = false,
}: CalendarWeekViewProps) => {
  const hours = Array.from({ length: 11 }, (_, i) => i + 6); // 06:00 - 16:00
  const [rowHeight, setRowHeight] = useState(25); // Dynamic height per hour row
  const gridRef = useRef<HTMLDivElement>(null);
  const [wasResizing, setWasResizing] = useState(false); // Prevents click after resize
  const [resizing, setResizing] = useState<{
    id: string;
    startY: number;
    originalTime: string;
    otherTime: string;
    type: 'start' | 'end';
  } | null>(null);
  const [resizePreview, setResizePreview] = useState<{ startTime: string; endTime: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get employees assigned on a specific date
  const getEmployeesForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return employeeAssignments.filter(ea => ea.daily_assignments?.assignment_date === dateStr);
  };

  const getAssignmentsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return assignments?.filter(a => a.assignment_date === dateStr) || [];
  };

  const getTimePosition = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return ((hours - 6) * 60 + minutes) / 60; // Position in hours from 06:00
  };

  const getBlockHeight = (startTime: string, endTime: string): number => {
    const start = getTimePosition(startTime);
    const end = getTimePosition(endTime);
    return (end - start) * rowHeight; // Height in pixels (dynamic per hour)
  };

  // Calculate row height dynamically based on available space
  useEffect(() => {
    const calculateRowHeight = () => {
      if (!containerRef.current || !gridRef.current) return;
      
      const container = containerRef.current;
      const headerHeight = container.querySelector('.shrink-0')?.getBoundingClientRect().height || 60;
      const helmetRowHeight = onHelmetClick ? 60 : 0; // Approximate height of helmet row
      const availableHeight = container.clientHeight - headerHeight - helmetRowHeight;
      const calculatedHeight = Math.max(14, availableHeight / hours.length * 0.85);
      setRowHeight(calculatedHeight);
    };

    calculateRowHeight();
    window.addEventListener('resize', calculateRowHeight);
    
    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(calculateRowHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', calculateRowHeight);
      resizeObserver.disconnect();
    };
  }, [hours.length, onHelmetClick]);

  const roundToHalfHour = (hour: number): string => {
    const roundedHour = Math.floor(hour);
    const minutes = (hour - roundedHour) >= 0.5 ? 30 : 0;
    return `${String(roundedHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const calculateTimeFromY = (clientY: number, dayColumnElement: HTMLElement): number => {
    const rect = dayColumnElement.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    // Each hour is rowHeight px, round to 30-minute intervals
    const minutesFromTop = (relativeY / rowHeight) * 60;
    const roundedMinutes = Math.round(minutesFromTop / 30) * 30;
    return Math.max(0, Math.min(14 * 60, roundedMinutes)); // 0 to 840 minutes (14 hours from 6:00)
  };

  const minutesToTimeString = (minutesFromStart: number): string => {
    const totalMinutes = 6 * 60 + minutesFromStart; // Add 6 hours offset
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  // Handle click on empty calendar space
  const handleDayClick = (e: React.MouseEvent, date: Date) => {
    // Only trigger if clicking directly on the day column (not on an assignment)
    const target = e.target as HTMLElement;
    if (target.closest('[data-assignment]')) return;
    
    if (!onEmptyFieldClick) return;
    
    const minutesFromStart = calculateTimeFromY(e.clientY, e.currentTarget as HTMLElement);
    const startTime = minutesToTimeString(minutesFromStart);
    
    onEmptyFieldClick(date, startTime);
  };

  const handleResizeStart = (
    e: React.MouseEvent,
    assignmentId: string,
    time: string,
    otherTime: string,
    type: 'start' | 'end'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing({ id: assignmentId, startY: e.clientY, originalTime: time, otherTime, type });
    if (type === 'start') {
      setResizePreview({ startTime: time, endTime: otherTime });
    } else {
      setResizePreview({ startTime: otherTime, endTime: time });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing || !containerRef.current) return;

    const deltaY = e.clientY - resizing.startY;
    const deltaHours = deltaY / rowHeight; // dynamic px per hour

    const [origHours, origMinutes] = resizing.originalTime.split(':').map(Number);
    const originalTotalMinutes = origHours * 60 + origMinutes;
    let newTotalMinutes = originalTotalMinutes + deltaHours * 60;

    // Round to 30-minute intervals
    const roundedMinutes = Math.round(newTotalMinutes / 30) * 30;

    // Parse the other time for min duration check
    const [otherHours, otherMinutes] = resizing.otherTime.split(':').map(Number);
    const otherTotalMinutes = otherHours * 60 + otherMinutes;

    let finalMinutes: number;
    if (resizing.type === 'start') {
      // Start time: must be >= 6:00 and at least 30min before end
      finalMinutes = Math.max(6 * 60, Math.min(otherTotalMinutes - 30, roundedMinutes));
    } else {
      // End time: must be <= 20:00 and at least 30min after start
      finalMinutes = Math.max(otherTotalMinutes + 30, Math.min(20 * 60, roundedMinutes));
    }

    const newHours = Math.floor(finalMinutes / 60);
    const newMinutes = finalMinutes % 60;
    const newTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;

    if (resizing.type === 'start') {
      setResizePreview({ startTime: newTime, endTime: resizing.otherTime });
    } else {
      setResizePreview({ startTime: resizing.otherTime, endTime: newTime });
    }
  }, [resizing, rowHeight]);

  const handleMouseUp = useCallback(() => {
    if (resizing && resizePreview && onUpdateAssignmentTimes) {
      onUpdateAssignmentTimes(resizing.id, resizePreview.startTime, resizePreview.endTime);
    }
    if (resizing) {
      // Prevent click from firing immediately after resize
      setWasResizing(true);
      setTimeout(() => setWasResizing(false), 150);
    }
    setResizing(null);
    setResizePreview(null);
  }, [resizing, resizePreview, onUpdateAssignmentTimes]);

  // Add global mouse listeners for resize
  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="border border-border rounded-lg overflow-hidden bg-card h-full flex flex-col">
      {/* Header with day names - only weekdays (Mon-Fri) */}
      <div className="grid grid-cols-[40px_repeat(6,minmax(0,1fr))] border-b border-border bg-muted/50 shrink-0">
        <div className="px-0.5 py-0.5 text-[9px] font-bold text-muted-foreground border-r border-border text-center">
          Zeit
        </div>
        {weekDays.slice(0, 6).map((day, idx) => {
          const isToday = format(day, "yyyy-MM-dd") === todayStr;
          return (
            <div
              key={idx}
              className={`px-1 py-0.5 text-center border-r border-border last:border-r-0 ${
                isToday ? "bg-accent/10" : ""
              }`}
            >
              <p className="text-[10px] font-semibold text-muted-foreground leading-tight">
                {format(day, "EEE", { locale: de })}
              </p>
              <p className={`text-xs font-bold leading-tight ${isToday ? "text-accent" : "text-foreground"}`}>
                {format(day, "dd")}
              </p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div ref={gridRef} className="grid grid-cols-[40px_repeat(6,minmax(0,1fr))] overflow-hidden">
        {/* Time column */}
        <div className="border-r border-border bg-muted/30">
          {hours.map((hour) => (
            <div
              key={hour}
              className="px-1 text-[10px] font-medium text-muted-foreground border-b border-border flex items-start justify-center"
              style={{ height: `${rowHeight}px` }}
            >
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Day columns - only weekdays (Mon-Fri) */}
        {weekDays.slice(0, 6).map((day, dayIdx) => {
          const dayAssignments = getAssignmentsForDate(day);
          const isToday = format(day, "yyyy-MM-dd") === todayStr;

          return (
            <div
              key={dayIdx}
              className={`relative border-r border-border last:border-r-0 cursor-pointer ${
                isToday ? "bg-accent/5" : ""
              } ${isSelectingMode ? "ring-2 ring-primary/50" : ""}`}
              onClick={(e) => handleDayClick(e, day)}
            >
              {/* Working hours background stripe (7:00 - 16:00) */}
              <div
                className="absolute left-0 right-0 bg-primary/10 pointer-events-none"
                style={{
                  top: `${(7 - 6) * rowHeight}px`, // 7:00 - starts at hour 7, offset from 6:00
                  height: `${9 * rowHeight}px`, // 9 hours (7:00 to 16:00)
                }}
              />
              
              {/* Hour grid lines */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="border-b border-border"
                  style={{ height: `${rowHeight}px` }}
                />
              ))}

              {/* Assignment blocks */}
              <div className="absolute inset-0 pointer-events-none">
                {dayAssignments.map((assignment) => {
                  const isResizingThis = resizing?.id === assignment.id;
                  const displayStartTime = isResizingThis && resizePreview ? resizePreview.startTime : (assignment.start_time || "08:00");
                  const displayEndTime = isResizingThis && resizePreview ? resizePreview.endTime : (assignment.end_time || "09:00");
                  const topPosition = getTimePosition(displayStartTime) * rowHeight;
                  const height = getBlockHeight(displayStartTime, displayEndTime);
                  const color = assignment.construction_sites?.color || "#3B82F6";
                  const textColor = getTextColor(color);

                  return (
                    <div
                      key={assignment.id}
                      data-assignment="true"
                      className={`absolute left-0.5 right-0.5 rounded shadow-sm overflow-hidden pointer-events-auto cursor-pointer transition-transform group ${
                        isResizingThis ? "ring-1 ring-primary" : "hover:scale-[1.02]"
                      }`}
                      style={{
                        top: `${topPosition}px`,
                        height: `${Math.max(height, 8)}px`,
                        backgroundColor: `${color}8C`,
                        color: textColor,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!resizing && !wasResizing) {
                          onAssignmentClick(assignment.id);
                        }
                      }}
                    >
                      {/* Resize handle TOP - for start time */}
                      {onUpdateAssignmentTimes && height > 15 && (
                        <div
                          className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize bg-black/10 hover:bg-black/30 transition-colors"
                          onMouseDown={(e) => handleResizeStart(e, assignment.id, assignment.start_time, assignment.end_time, 'start')}
                        />
                      )}

                      <div className="px-1 h-full flex flex-col justify-center overflow-hidden">
                        <p className="font-semibold text-[11px] leading-tight truncate">
                          {assignment.construction_sites?.customer_last_name}
                        </p>
                        {height > 30 && (
                          <p className="text-[10px] opacity-90 leading-tight truncate">
                            {displayStartTime.slice(0, 5)}-{displayEndTime.slice(0, 5)}
                          </p>
                        )}
                      </div>

                      {/* Resize handle BOTTOM - for end time */}
                      {onUpdateAssignmentTimes && height > 15 && (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-black/10 hover:bg-black/30 transition-colors"
                          onMouseDown={(e) => handleResizeStart(e, assignment.id, assignment.end_time, assignment.start_time, 'end')}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Helmet row for employee assignment */}
      {onHelmetClick && (
        <div className="grid grid-cols-[40px_repeat(6,minmax(0,1fr))] border-t border-b border-border">
          <div className="border-r border-border flex items-center justify-center py-0.5">
            <span className="text-[9px] text-foreground font-semibold">Zuteilung</span>
          </div>
          {weekDays.slice(0, 6).map((day, dayIdx) => {
            const dayEmployees = getEmployeesForDate(day);
            return (
              <div
                key={dayIdx}
                className={`flex flex-col items-center py-0.5 cursor-pointer transition-colors border-r last:border-r-0 min-h-[24px] ${
                  selectedEmployeeDay === dayIdx
                    ? "text-orange-500 bg-orange-50"
                    : "text-muted-foreground hover:text-orange-400 hover:bg-orange-50/50"
                }`}
                onClick={() => onHelmetClick(dayIdx)}
              >
                <HardHat
                  className={`h-3.5 w-3.5 flex-shrink-0 ${selectedEmployeeDay === dayIdx ? "animate-pulse" : ""}`}
                />
                {dayEmployees.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mt-1 px-1">
                    {dayEmployees.map((emp) => (
                      <span
                        key={emp.id}
                        className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full truncate max-w-[60px]"
                        title={emp.profiles?.full_name || emp.profiles?.email || ""}
                      >
                        {emp.profiles?.full_name?.split(" ")[0] || emp.profiles?.email?.split("@")[0] || "?"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
