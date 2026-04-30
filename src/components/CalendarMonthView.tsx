import { Card, CardContent } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, getDay } from "date-fns";
import { de } from "date-fns/locale";
import { getTextColor } from "@/lib/colorUtils";

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

interface CalendarMonthViewProps {
  currentDate: Date;
  assignments: Assignment[] | undefined;
  todayStr: string;
}

export const CalendarMonthView = ({
  currentDate,
  assignments,
  todayStr,
}: CalendarMonthViewProps) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  // Filter out weekends (Saturday = 6, Sunday = 0)
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    .filter(day => getDay(day) !== 0 && getDay(day) !== 6);
  
  const getAssignmentsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return assignments?.filter(a => a.assignment_date === dateStr) || [];
  };

  return (
    <div>
      <div className="grid grid-cols-5 gap-2 mb-2">
        {["Mo", "Di", "Mi", "Do", "Fr"].map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {calendarDays.map((day, idx) => {
          const dayAssignments = getAssignmentsForDate(day);
          const isToday = format(day, "yyyy-MM-dd") === todayStr;
          const isCurrentMonth = isSameMonth(day, currentDate);
          
          return (
            <Card
              key={idx}
              className={`${
                isToday ? "border-accent border-2" : ""
              } ${
                !isCurrentMonth ? "opacity-40" : ""
              } min-h-[100px]`}
            >
              <CardContent className="p-2">
                <p className={`text-sm font-bold mb-1 ${isToday ? "text-accent" : "text-foreground"}`}>
                  {format(day, "d")}
                </p>
                {dayAssignments.length > 0 && (
                  <div className="space-y-1">
                    {dayAssignments.slice(0, 2).map((assignment) => {
                      const color = assignment.construction_sites?.color || "#3B82F6";
                      const textColor = getTextColor(color);
                      
                      return (
                        <div
                          key={assignment.id}
                          className="text-xs font-medium truncate rounded px-1.5 py-1 shadow-sm"
                          style={{
                            backgroundColor: color,
                            color: textColor,
                          }}
                        >
                          <div className="font-semibold leading-tight">
                            {assignment.construction_sites?.customer_last_name}
                          </div>
                          <div className="text-[10px] opacity-90 leading-tight">
                            {assignment.start_time.slice(0, 5)} - {assignment.end_time.slice(0, 5)}
                          </div>
                        </div>
                      );
                    })}
                    {dayAssignments.length > 2 && (
                      <div className="text-xs text-muted-foreground font-medium">
                        +{dayAssignments.length - 2} mehr
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
