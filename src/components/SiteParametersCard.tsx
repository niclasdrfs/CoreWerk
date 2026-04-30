import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Ruler } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface SiteParametersCardProps {
  siteId: string;
  categoryId: string | null;
}

export const SiteParametersCard = ({ siteId, categoryId }: SiteParametersCardProps) => {
  const queryClient = useQueryClient();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  // Fetch parameters for this category
  const { data: parameters = [] } = useQuery({
    queryKey: ["category-parameters", categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await supabase
        .from("category_parameters")
        .select("*")
        .eq("category_id", categoryId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!categoryId,
  });

  // Fetch existing values for this site
  const { data: siteValues = [] } = useQuery({
    queryKey: ["site-parameters", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_site_parameters")
        .select("*")
        .eq("construction_site_id", siteId);
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  // Sync local values from DB
  useEffect(() => {
    const vals: Record<string, string> = {};
    siteValues.forEach((sv) => {
      vals[sv.parameter_id] = String(sv.value);
    });
    setLocalValues(vals);
  }, [siteValues]);

  const upsertMutation = useMutation({
    mutationFn: async ({ parameterId, value }: { parameterId: string; value: number }) => {
      const existing = siteValues.find((sv) => sv.parameter_id === parameterId);
      if (existing) {
        const { error } = await supabase
          .from("construction_site_parameters")
          .update({ value })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("construction_site_parameters")
          .insert({
            construction_site_id: siteId,
            parameter_id: parameterId,
            value,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-parameters", siteId] });
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const handleBlur = (parameterId: string) => {
    const val = parseFloat(localValues[parameterId] || "0");
    if (isNaN(val)) return;
    const existing = siteValues.find((sv) => sv.parameter_id === parameterId);
    if (existing && existing.value === val) return;
    if (!existing && val === 0) return;
    upsertMutation.mutate({ parameterId, value: val });
  };

  if (!categoryId || parameters.length === 0) return null;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Projektmaße</h2>
        <Ruler className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {parameters.map((param) => (
          <div key={param.id} className="space-y-1.5">
            <Label className="text-sm flex items-center gap-2">
              {param.name}
              <Badge variant="outline" className="text-[10px] font-mono">
                {param.unit}
              </Badge>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              value={localValues[param.id] || ""}
              onChange={(e) =>
                setLocalValues((prev) => ({ ...prev, [param.id]: e.target.value }))
              }
              onBlur={() => handleBlur(param.id)}
              className="h-9"
            />
          </div>
        ))}
      </div>
    </Card>
  );
};
