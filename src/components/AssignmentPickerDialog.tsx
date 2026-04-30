import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Wrench } from "lucide-react";

interface Assignment {
  id: string;
  assignment_date: string;
  start_time: string | null;
  end_time: string | null;
  construction_site_id: string;
  construction_sites: {
    customer_last_name: string;
    color: string | null;
  } | null;
}

interface AssignmentPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: Assignment[];
  employeeName?: string;
  onSelect: (assignmentId: string) => void;
}

export function AssignmentPickerDialog({
  open,
  onOpenChange,
  assignments,
  employeeName,
  onSelect,
}: AssignmentPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Baustelle auswählen</DialogTitle>
          <DialogDescription>
            {employeeName
              ? `Welcher Baustelle soll ${employeeName} zugeordnet werden?`
              : "Welcher Baustelle soll der Mitarbeiter zugeordnet werden?"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {assignments.map((assignment) => {
            const site = assignment.construction_sites;
            const timeRange =
              assignment.start_time && assignment.end_time
                ? `${assignment.start_time} – ${assignment.end_time}`
                : null;

            return (
              <button
                key={assignment.id}
                onClick={() => {
                  onSelect(assignment.id);
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: site?.color
                      ? `${site.color}20`
                      : "hsl(var(--muted))",
                  }}
                >
                  <Wrench
                    className="w-5 h-5"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {site?.customer_last_name || "Unbekannt"}
                  </p>
                  {timeRange && (
                    <p className="text-sm text-muted-foreground">{timeRange}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
