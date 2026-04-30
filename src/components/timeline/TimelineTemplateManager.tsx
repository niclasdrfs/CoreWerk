import { useState } from "react";
import { useTimelineTemplates, useCreateTemplate, TimelineTemplate } from "@/hooks/useTimelineData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Star, Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TimelineTemplateManagerProps {
  categoryId?: string | null;
  onSelectTemplate?: (template: TimelineTemplate) => void;
}

export const TimelineTemplateManager = ({
  categoryId,
  onSelectTemplate,
}: TimelineTemplateManagerProps) => {
  const { data: templates, isLoading } = useTimelineTemplates(categoryId);
  const createTemplate = useCreateTemplate();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categoryId || null);
  const [isDefault, setIsDefault] = useState(false);
  const [stages, setStages] = useState<Array<{ name: string; description: string; visibleToManager: boolean }>>([
    { name: "", description: "", visibleToManager: true },
  ]);

  // Fetch categories for dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ["construction-site-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_site_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const addStage = () => {
    setStages([...stages, { name: "", description: "", visibleToManager: true }]);
  };

  const removeStage = (index: number) => {
    if (stages.length > 1) {
      setStages(stages.filter((_, i) => i !== index));
    }
  };

  const updateStage = (index: number, field: "name" | "description", value: string) => {
    const updated = [...stages];
    updated[index][field] = value;
    setStages(updated);
  };

  const handleCreate = async () => {
    if (!name.trim() || stages.every(s => !s.name.trim())) return;

    await createTemplate.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId: selectedCategoryId,
      isDefault,
      stages: stages.filter(s => s.name.trim()).map(s => ({
        name: s.name.trim(),
        description: s.description.trim() || undefined,
        visibleToManager: s.visibleToManager,
      })),
    });

    setDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsDefault(false);
    setStages([{ name: "", description: "", visibleToManager: true }]);
  };

  if (isLoading) {
    return <div className="py-4 text-center text-muted-foreground">Laden...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Zeitstrahl-Vorlagen</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Neue Vorlage
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Neue Zeitstrahl-Vorlage erstellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <Input
                  placeholder="Name der Vorlage"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Textarea
                  placeholder="Beschreibung (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
                <Select
                  value={selectedCategoryId || "none"}
                  onValueChange={(v) => setSelectedCategoryId(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kategorie zuordnen (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Kategorie (universell)</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isDefault"
                    checked={isDefault}
                    onCheckedChange={(c) => setIsDefault(c === true)}
                  />
                  <label htmlFor="isDefault" className="text-sm">
                    Als Standard für diese Kategorie festlegen
                  </label>
                </div>
              </div>

              {/* Stages */}
              <div className="space-y-3">
                <h4 className="font-medium">Stufen</h4>
                {stages.map((stage, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
                    <GripVertical className="w-4 h-4 text-muted-foreground mt-3 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder={`Stufe ${index + 1} Name`}
                        value={stage.name}
                        onChange={(e) => updateStage(index, "name", e.target.value)}
                      />
                      <Input
                        placeholder="Beschreibung (optional)"
                        value={stage.description}
                        onChange={(e) => updateStage(index, "description", e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={stage.visibleToManager}
                          onCheckedChange={(checked) => {
                            const updated = [...stages];
                            updated[index].visibleToManager = checked;
                            setStages(updated);
                          }}
                          id={`visible-${index}`}
                        />
                        <label htmlFor={`visible-${index}`} className="text-xs text-muted-foreground">
                          Sichtbar für Montageleiter
                        </label>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStage(index)}
                      disabled={stages.length === 1}
                      className="shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addStage} className="w-full gap-2">
                  <Plus className="w-4 h-4" />
                  Stufe hinzufügen
                </Button>
              </div>

              <Button
                onClick={handleCreate}
                disabled={!name.trim() || stages.every(s => !s.name.trim()) || createTemplate.isPending}
                className="w-full"
              >
                Vorlage erstellen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates List */}
      {templates?.length === 0 ? (
        <Card className="p-6 text-center">
          <Layers className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Noch keine Vorlagen erstellt</p>
          <p className="text-sm text-muted-foreground mt-1">
            Erstellen Sie eine Vorlage, um sie für Baustellen zu verwenden
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates?.map((template) => (
            <Card
              key={template.id}
              className="p-4 cursor-pointer hover:bg-accent/5 transition-colors"
              onClick={() => onSelectTemplate?.(template)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{template.name}</h4>
                    {template.isDefault && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="w-3 h-3" />
                        Standard
                      </Badge>
                    )}
                    {template.categoryName && (
                      <Badge variant="outline">{template.categoryName}</Badge>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {template.stages.length} Stufen: {template.stages.map(s => s.name).join(" → ")}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
