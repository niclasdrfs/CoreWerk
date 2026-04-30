import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Ruler, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface CategoryParametersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
}

const unitOptions = [
  { value: "m", label: "Meter (m)" },
  { value: "m²", label: "Quadratmeter (m²)" },
  { value: "m³", label: "Kubikmeter (m³)" },
  { value: "Stk", label: "Stück (Stk)" },
  { value: "lfm", label: "Laufmeter (lfm)" },
];

export const CategoryParametersDialog = ({
  open,
  onOpenChange,
  categoryId,
  categoryName,
}: CategoryParametersDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("m");

  const { data: profile } = useQuery({
    queryKey: ["owner-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: parameters = [], isLoading } = useQuery({
    queryKey: ["category-parameters", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_parameters")
        .select("*")
        .eq("category_id", categoryId)
        .order("display_order");

      if (error) throw error;
      return data;
    },
    enabled: !!categoryId && open,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase.from("category_parameters").insert({
        category_id: categoryId,
        company_id: profile.company_id,
        name: newName.trim(),
        unit: newUnit,
        display_order: parameters.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-parameters", categoryId] });
      setNewName("");
      setNewUnit("m");
      toast.success("Parameter hinzugefügt");
    },
    onError: () => toast.error("Fehler beim Hinzufügen"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (paramId: string) => {
      const { error } = await supabase
        .from("category_parameters")
        .delete()
        .eq("id", paramId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-parameters", categoryId] });
      toast.success("Parameter gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const handleAdd = () => {
    if (!newName.trim()) return;
    addMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-primary" />
            Maßeinheiten: {categoryName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Definiere welche Maße für Baustellen dieser Kategorie erfasst werden sollen.
          </p>

          {/* Existing parameters */}
          <div className="space-y-2">
            {parameters.map((param) => (
              <div
                key={param.id}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                <span className="flex-1 text-sm font-medium">{param.name}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {param.unit}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => deleteMutation.mutate(param.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            {!isLoading && parameters.length === 0 && (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                Noch keine Maßeinheiten definiert
              </p>
            )}
          </div>

          {/* Add new parameter */}
          <div className="border-t border-border pt-4 space-y-3">
            <Label className="text-sm font-medium">Neuen Parameter hinzufügen</Label>
            <div className="flex gap-2">
              <Input
                placeholder="z.B. Fläche, Geländerlänge..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="flex-1"
              />
              <Select value={newUnit} onValueChange={setNewUnit}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAdd}
              disabled={!newName.trim() || addMutation.isPending}
              size="sm"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Hinzufügen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
