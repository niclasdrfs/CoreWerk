import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";

interface WageData {
  hourly_wage: string;
  calculated_hourly_wage: string;
}

export const OwnerEmployeeManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [wages, setWages] = useState<Record<string, WageData>>({});
  const [saved, setSaved] = useState(false);

  // Fetch company_id
  const { data: companyId } = useQuery({
    queryKey: ["owner-company-id", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.company_id ?? null;
    },
    enabled: !!user?.id,
  });

  // Fetch employees
  const {
    data: employees = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["owner-employees", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, hourly_wage, calculated_hourly_wage")
        .eq("company_id", companyId!)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // Initialize wages when employees load
  useEffect(() => {
    if (employees.length > 0) {
      setWages((prev) => {
        // Only set if empty (don't overwrite user edits)
        if (Object.keys(prev).length > 0) return prev;
        const initial: Record<string, WageData> = {};
        employees.forEach((emp) => {
          initial[emp.id] = {
            hourly_wage: emp.hourly_wage?.toString() || "",
            calculated_hourly_wage: emp.calculated_hourly_wage?.toString() || "",
          };
        });
        return initial;
      });
    }
  }, [employees]);

  const handleWageChange = (
    employeeId: string,
    field: keyof WageData,
    value: string
  ) => {
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setWages((prev) => ({
        ...prev,
        [employeeId]: {
          ...prev[employeeId],
          [field]: value,
        },
      }));
      setSaved(false);
    }
  };

  const saveWagesMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(wages).map(([employeeId, wageData]) => {
        const hourlyWage =
          wageData.hourly_wage === "" ? null : parseFloat(wageData.hourly_wage);
        const calculatedWage =
          wageData.calculated_hourly_wage === ""
            ? null
            : parseFloat(wageData.calculated_hourly_wage);

        return supabase
          .from("profiles")
          .update({
            hourly_wage: hourlyWage,
            calculated_hourly_wage: calculatedWage,
          })
          .eq("id", employeeId);
      });

      const results = await Promise.all(updates);
      const hasError = results.some((r) => r.error);
      if (hasError) throw new Error("Einige Updates sind fehlgeschlagen");
    },
    onSuccess: () => {
      toast.success("Alle Stundenlöhne gespeichert");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["owner-employees"] });
    },
    onError: () => {
      toast.error("Fehler beim Speichern");
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
        <AlertCircle className="w-5 h-5" />
        <span>{(error as Error)?.message || "Fehler beim Laden der Mitarbeiter"}</span>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">
          Keine Mitarbeiter gefunden
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold text-right">
                Brutto/Stunde
              </TableHead>
              <TableHead className="font-semibold text-right">
                Kalk. Stundenlohn
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">
                      {employee.full_name || "Unbenannt"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {employee.email}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={wages[employee.id]?.hourly_wage || ""}
                      onChange={(e) =>
                        handleWageChange(employee.id, "hourly_wage", e.target.value)
                      }
                      className="w-24 text-right"
                    />
                    <span className="text-muted-foreground text-sm">€</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={wages[employee.id]?.calculated_hourly_wage || ""}
                      onChange={(e) =>
                        handleWageChange(employee.id, "calculated_hourly_wage", e.target.value)
                      }
                      className="w-24 text-right"
                    />
                    <span className="text-muted-foreground text-sm">€</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end p-4 border-t bg-muted/30">
        <Button
          onClick={() => saveWagesMutation.mutate()}
          disabled={saveWagesMutation.isPending}
          className="gap-2"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" />
              Gespeichert
            </>
          ) : saveWagesMutation.isPending ? (
            "Speichern..."
          ) : (
            <>
              <Save className="w-4 h-4" />
              Alle speichern
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
