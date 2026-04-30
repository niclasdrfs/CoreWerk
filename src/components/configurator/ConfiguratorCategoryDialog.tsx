import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  userId: string;
  category?: any;
}

export function ConfiguratorCategoryDialog({ open, onOpenChange, companyId, userId, category }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(category?.name || "");
      setDescription(category?.description || "");
    }
  }, [open, category]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (category) {
        const { error } = await supabase
          .from("product_configurator_categories")
          .update({ name, description: description || null })
          .eq("id", category.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("product_configurator_categories")
          .insert({
            name,
            description: description || null,
            company_id: companyId,
            created_by: userId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurator-categories"] });
      toast.success(category ? "Kategorie aktualisiert" : "Kategorie erstellt");
      onOpenChange(false);
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Kategorie bearbeiten" : "Neue Kategorie"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Alu-Dach"
            />
          </div>
          <div>
            <Label htmlFor="cat-desc">Beschreibung (optional)</Label>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurzbeschreibung der Kategorie"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
            {category ? "Speichern" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
