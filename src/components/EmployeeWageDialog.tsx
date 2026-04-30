import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Euro, Save, Users } from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: string;
  full_name: string | null;
  email: string;
  hourly_wage: number | null;
}

export const EmployeeWageDialog = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wages, setWages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && user) {
      fetchEmployees();
    }
  }, [open, user]);

  const fetchEmployees = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's company
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.company_id) return;

      // Get all employees in company
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, hourly_wage")
        .eq("company_id", profile.company_id)
        .order("full_name");

      if (error) throw error;

      setEmployees(data || []);
      
      // Initialize wages state
      const initialWages: Record<string, string> = {};
      data?.forEach((emp) => {
        initialWages[emp.id] = emp.hourly_wage?.toString() || "";
      });
      setWages(initialWages);
    } catch (err) {
      console.error("Error fetching employees:", err);
      toast.error("Fehler beim Laden der Mitarbeiter");
    } finally {
      setLoading(false);
    }
  };

  const handleWageChange = (employeeId: string, value: string) => {
    // Only allow valid decimal input
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setWages((prev) => ({ ...prev, [employeeId]: value }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Update each employee's wage
      const updates = Object.entries(wages).map(([employeeId, wage]) => {
        const hourlyWage = wage === "" ? null : parseFloat(wage);
        return supabase
          .from("profiles")
          .update({ hourly_wage: hourlyWage })
          .eq("id", employeeId);
      });

      const results = await Promise.all(updates);
      
      const hasError = results.some((r) => r.error);
      if (hasError) {
        throw new Error("Einige Updates sind fehlgeschlagen");
      }

      toast.success("Stundenlöhne gespeichert");
      setOpen(false);
    } catch (err) {
      console.error("Error saving wages:", err);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Euro className="w-4 h-4" />
          Stundenlöhne verwalten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Mitarbeiter Stundenlöhne
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Keine Mitarbeiter gefunden
            </p>
          ) : (
            <div className="space-y-4">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {employee.full_name || "Unbenannt"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {employee.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`wage-${employee.id}`} className="sr-only">
                      Stundenlohn
                    </Label>
                    <Input
                      id={`wage-${employee.id}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={wages[employee.id] || ""}
                      onChange={(e) =>
                        handleWageChange(employee.id, e.target.value)
                      }
                      className="w-24 text-right"
                    />
                    <span className="text-muted-foreground">€/h</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
