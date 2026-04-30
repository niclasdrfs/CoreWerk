import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { X, User, UserCheck, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface EmployeeSidebarProps {
  selectedDay: Date;
  companyId: string;
  onEmployeeClick: (employeeId: string) => void;
  onClose: () => void;
  hideCloseButton?: boolean;
}

export const EmployeeSidebar = ({
  selectedDay,
  companyId,
  onEmployeeClick,
  onClose,
  hideCloseButton = false,
}: EmployeeSidebarProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const dateStr = format(selectedDay, "yyyy-MM-dd");
  const dayName = format(selectedDay, "EEEE", { locale: de });
  const dateFormatted = format(selectedDay, "d. MMMM", { locale: de });

  // Fetch all profiles in the company
  const { data: profiles = [] } = useQuery({
    queryKey: ["company-profiles", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles_limited" as any)
        .select("id, full_name, email")
        .eq("company_id", companyId);

      if (error) throw error;
      return (data || []) as unknown as { id: string; full_name: string | null; email: string }[];
    },
    enabled: !!companyId,
  });

  // Fetch user roles separately (no join needed)
  const { data: userRoles = [] } = useQuery({
    queryKey: ["company-user-roles", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("company_id", companyId)
        .in("role", ["installation_manager", "employee"]);

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Filter profiles to only include those with relevant roles
  const employeeUserIds = new Set(userRoles.map(r => r.user_id));
  const employees = profiles.filter(p => employeeUserIds.has(p.id));

  // Fetch assignments for the selected day to know who's already assigned
  const { data: dayAssignments = [] } = useQuery({
    queryKey: ["day-employee-assignments", companyId, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_assignments")
        .select(`
          id,
          installation_manager_id,
          employee_assignments (
            id,
            employee_id
          )
        `)
        .eq("company_id", companyId)
        .eq("assignment_date", dateStr);

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Mutation to remove an employee assignment
  const removeAssignmentMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      // Find the employee_assignment id for this employee on this day
      const assignmentToDelete = dayAssignments
        .flatMap(da => da.employee_assignments || [])
        .find(ea => ea.employee_id === employeeId);

      if (!assignmentToDelete) {
        throw new Error("Zuweisung nicht gefunden");
      }

      const { error } = await supabase
        .from("employee_assignments")
        .delete()
        .eq("id", assignmentToDelete.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mitarbeiter entfernt");
      queryClient.invalidateQueries({ queryKey: ["day-employee-assignments", companyId, dateStr] });
      queryClient.invalidateQueries({ queryKey: ["week-employee-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["daily-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
    },
    onError: (error) => {
      console.error("Error removing assignment:", error);
      toast.error("Fehler beim Entfernen des Mitarbeiters");
    },
  });

  // Build a map: employeeId -> { assignmentId, managerId }
  const assignmentDetails = new Map<string, { assignmentId: string; managerId: string }>();
  dayAssignments.forEach(da => {
    da.employee_assignments?.forEach(ea => {
      assignmentDetails.set(ea.employee_id, {
        assignmentId: ea.id,
        managerId: da.installation_manager_id
      });
    });
  });

  // Get all assigned employee IDs for this day
  const assignedEmployeeIds = new Set(assignmentDetails.keys());

  // Split employees into 3 categories
  const availableEmployees = employees.filter(e => !assignedEmployeeIds.has(e.id));
  const myAssignedEmployees = employees.filter(e => {
    const details = assignmentDetails.get(e.id);
    return details && details.managerId === user?.id;
  });
  const otherAssignedEmployees = employees.filter(e => {
    const details = assignmentDetails.get(e.id);
    return details && details.managerId !== user?.id;
  });

  const handleRemoveEmployee = (employeeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeAssignmentMutation.mutate(employeeId);
  };

  return (
    <div className="h-full flex flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="font-semibold text-foreground">Mitarbeiter</h2>
          <p className="text-sm text-muted-foreground">{dayName}, {dateFormatted}</p>
        </div>
        {!hideCloseButton && (
          <Button variant="ghost" size="icon" onClick={onClose} title="Schließen">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Available employees */}
          <div className="rounded-lg bg-emerald-500/10 p-3">
            <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <User className="h-3 w-3" />
              Verfügbar ({availableEmployees.length})
            </h3>
            <div className="space-y-2">
              {availableEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Keine verfügbaren Mitarbeiter
                </p>
              ) : (
                availableEmployees.map((employee) => (
                  <Card
                    key={employee.id}
                    className="p-3 cursor-pointer hover:bg-emerald-500/20 transition-colors border-emerald-500/30"
                    onClick={() => onEmployeeClick(employee.id)}
                  >
                    <p className="font-medium text-sm">
                      {employee.full_name || employee.email}
                    </p>
                    {employee.full_name && (
                      <p className="text-xs text-muted-foreground">{employee.email}</p>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* My assigned employees */}
          <div className="rounded-lg bg-blue-500/10 p-3">
            <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <UserCheck className="h-3 w-3" />
              Meine Zuteilungen ({myAssignedEmployees.length})
            </h3>
            <div className="space-y-2">
              {myAssignedEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Noch keine Mitarbeiter eingeteilt
                </p>
              ) : (
                myAssignedEmployees.map((employee) => (
                  <Card
                    key={employee.id}
                    className="p-3 flex items-start justify-between gap-2 border-blue-500/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {employee.full_name || employee.email}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={(e) => handleRemoveEmployee(employee.id, e)}
                      disabled={removeAssignmentMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Employees assigned by other managers */}
          {otherAssignedEmployees.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 p-3">
              <h3 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Users className="h-3 w-3" />
                Anderweitig eingeteilt ({otherAssignedEmployees.length})
              </h3>
              <div className="space-y-2">
                {otherAssignedEmployees.map((employee) => {
                  const details = assignmentDetails.get(employee.id);
                  const managerProfile = profiles.find(p => p.id === details?.managerId);

                  return (
                    <Card
                      key={employee.id}
                      className="p-3 border-amber-500/30 opacity-75"
                    >
                      <p className="font-medium text-sm">
                        {employee.full_name || employee.email}
                      </p>
                      {managerProfile && (
                        <p className="text-xs text-muted-foreground">
                          Eingeteilt von: {managerProfile.full_name || managerProfile.email}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
