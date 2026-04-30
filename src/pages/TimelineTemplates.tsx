import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTimelineTemplates, useCreateTemplate } from "@/hooks/useTimelineData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Layers, Trash2, GripVertical, Pencil, FolderOpen, ChevronDown, ChevronRight, ListTodo, Package } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { StageFormCard } from "@/components/timeline/StageFormCard";

interface TemplateStageItem {
  id?: string;
  text: string;
}

interface TemplateStage {
  id?: string;
  name: string;
  description: string;
  todos: TemplateStageItem[];
  packingItems: TemplateStageItem[];
}

const TimelineTemplates = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: templates, isLoading } = useTimelineTemplates();
  const createTemplate = useCreateTemplate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [stages, setStages] = useState<TemplateStage[]>([
    { name: "", description: "", todos: [], packingItems: [] },
  ]);

  // Fetch categories
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
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

  const { data: categories = [] } = useQuery({
    queryKey: ["construction-site-categories", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from("construction_site_categories")
        .select("id, name")
        .eq("company_id", profile.company_id)
        .order("name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({
      templateId,
      name,
      description,
      categoryId,
      stages: newStages,
    }: {
      templateId: string;
      name: string;
      description?: string;
      categoryId: string | null;
      stages: TemplateStage[];
    }) => {
      // Update template
      const { error: templateError } = await supabase
        .from("timeline_templates")
        .update({
          name,
          description: description || null,
          category_id: categoryId,
        })
        .eq("id", templateId);

      if (templateError) throw templateError;

      // Delete existing stages (CASCADE will delete todos/packing items)
      const { error: deleteError } = await supabase
        .from("timeline_template_stages")
        .delete()
        .eq("template_id", templateId);

      if (deleteError) throw deleteError;

      // Insert new stages and get their IDs
      const stagesToInsert = newStages.map((stage, index) => ({
        template_id: templateId,
        name: stage.name,
        description: stage.description || null,
        display_order: index + 1,
      }));

      const { data: insertedStages, error: insertError } = await supabase
        .from("timeline_template_stages")
        .insert(stagesToInsert)
        .select("id");

      if (insertError) throw insertError;

      // Insert todos for each stage
      const todosToInsert = newStages.flatMap((stage, i) => 
        stage.todos.map((todo, todoIdx) => ({
          stage_id: insertedStages[i].id,
          text: todo.text,
          display_order: todoIdx,
        }))
      );

      if (todosToInsert.length > 0) {
        const { error: todosError } = await supabase
          .from("timeline_template_stage_todos")
          .insert(todosToInsert);
        if (todosError) throw todosError;
      }

      // Insert packing items for each stage
      const packingToInsert = newStages.flatMap((stage, i) => 
        stage.packingItems.map((item, itemIdx) => ({
          stage_id: insertedStages[i].id,
          text: item.text,
          display_order: itemIdx,
        }))
      );

      if (packingToInsert.length > 0) {
        const { error: packingError } = await supabase
          .from("timeline_template_stage_packing_items")
          .insert(packingToInsert);
        if (packingError) throw packingError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline-templates"] });
      queryClient.invalidateQueries({ queryKey: ["timeline-templates-for-select"] });
      toast.success("Vorlage aktualisiert");
      setIsEditOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Fehler beim Aktualisieren der Vorlage");
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      // First delete stages
      await supabase
        .from("timeline_template_stages")
        .delete()
        .eq("template_id", templateId);

      // Then delete template
      const { error } = await supabase
        .from("timeline_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline-templates"] });
      queryClient.invalidateQueries({ queryKey: ["timeline-templates-for-select"] });
      toast.success("Vorlage gelöscht");
      setDeleteTemplateId(null);
    },
    onError: () => {
      toast.error("Fehler beim Löschen der Vorlage");
    },
  });

  const resetForm = () => {
    setTemplateName("");
    setTemplateDescription("");
    setSelectedCategoryId(null);
    setStages([{ name: "", description: "", todos: [], packingItems: [] }]);
    setEditingTemplateId(null);
  };

  const handleAddStage = () => {
    setStages([...stages, { name: "", description: "", todos: [], packingItems: [] }]);
  };

  const handleRemoveStage = (index: number) => {
    if (stages.length > 1) {
      setStages(stages.filter((_, i) => i !== index));
    }
  };

  const handleStageChange = (index: number, field: "name" | "description", value: string) => {
    const newStages = [...stages];
    newStages[index][field] = value;
    setStages(newStages);
  };

  const handleAddStageTodo = (stageIndex: number, text: string) => {
    if (!text.trim()) return;
    const newStages = [...stages];
    newStages[stageIndex].todos.push({ text });
    setStages(newStages);
  };

  const handleRemoveStageTodo = (stageIndex: number, todoIndex: number) => {
    const newStages = [...stages];
    newStages[stageIndex].todos.splice(todoIndex, 1);
    setStages(newStages);
  };

  const handleAddStagePackingItem = (stageIndex: number, text: string) => {
    if (!text.trim()) return;
    const newStages = [...stages];
    newStages[stageIndex].packingItems.push({ text });
    setStages(newStages);
  };

  const handleRemoveStagePackingItem = (stageIndex: number, itemIndex: number) => {
    const newStages = [...stages];
    newStages[stageIndex].packingItems.splice(itemIndex, 1);
    setStages(newStages);
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }

    const validStages = stages.filter(s => s.name.trim());
    if (validStages.length === 0) {
      toast.error("Bitte fügen Sie mindestens eine Stufe hinzu");
      return;
    }

    try {
      await createTemplate.mutateAsync({
        name: templateName,
        description: templateDescription || undefined,
        categoryId: selectedCategoryId,
        stages: validStages,
      });

      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleEditTemplate = async (template: NonNullable<typeof templates>[0]) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(template.description || "");
    setSelectedCategoryId(template.categoryId || null);
    
    // Fetch todos and packing items for each stage
    const stageIds = template.stages.map(s => s.id);
    
    const [todosResult, packingResult] = await Promise.all([
      supabase
        .from("timeline_template_stage_todos")
        .select("*")
        .in("stage_id", stageIds)
        .order("display_order"),
      supabase
        .from("timeline_template_stage_packing_items")
        .select("*")
        .in("stage_id", stageIds)
        .order("display_order"),
    ]);

    const todosByStage = new Map<string, TemplateStageItem[]>();
    const packingByStage = new Map<string, TemplateStageItem[]>();
    
    todosResult.data?.forEach(t => {
      const list = todosByStage.get(t.stage_id) || [];
      list.push({ id: t.id, text: t.text });
      todosByStage.set(t.stage_id, list);
    });
    
    packingResult.data?.forEach(p => {
      const list = packingByStage.get(p.stage_id) || [];
      list.push({ id: p.id, text: p.text });
      packingByStage.set(p.stage_id, list);
    });

    setStages(
      template.stages.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description || "",
        todos: todosByStage.get(s.id) || [],
        packingItems: packingByStage.get(s.id) || [],
      }))
    );
    setIsEditOpen(true);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplateId || !templateName.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }

    const validStages = stages.filter(s => s.name.trim());
    if (validStages.length === 0) {
      toast.error("Bitte fügen Sie mindestens eine Stufe hinzu");
      return;
    }

    updateTemplateMutation.mutate({
      templateId: editingTemplateId,
      name: templateName,
      description: templateDescription || undefined,
      categoryId: selectedCategoryId,
      stages: validStages,
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 min-h-screen bg-background">
        <header className="border-b border-border bg-card safe-top">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <Skeleton className="h-6 w-48" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </main>
      </div>
    );
  }

  const renderTemplateForm = (isEdit: boolean) => (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Name der Vorlage</label>
        <Input
          placeholder="z.B. Standard-Bauprojekt"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Beschreibung (optional)</label>
        <Textarea
          placeholder="Kurze Beschreibung der Vorlage..."
          value={templateDescription}
          onChange={(e) => setTemplateDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Kategorie (optional)</label>
        <Select
          value={selectedCategoryId || "none"}
          onValueChange={(v) => setSelectedCategoryId(v === "none" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Keine Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Keine Kategorie</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Stufen</label>
          <Button variant="outline" size="sm" onClick={handleAddStage}>
            <Plus className="w-4 h-4 mr-1" />
            Stufe hinzufügen
          </Button>
        </div>

        <div className="space-y-3">
          {stages.map((stage, index) => (
            <StageFormCard
              key={index}
              stage={stage}
              index={index}
              totalStages={stages.length}
              onNameChange={(value) => handleStageChange(index, "name", value)}
              onDescriptionChange={(value) => handleStageChange(index, "description", value)}
              onRemove={() => handleRemoveStage(index)}
              onAddTodo={(text) => handleAddStageTodo(index, text)}
              onRemoveTodo={(todoIndex) => handleRemoveStageTodo(index, todoIndex)}
              onAddPackingItem={(text) => handleAddStagePackingItem(index, text)}
              onRemovePackingItem={(itemIndex) => handleRemoveStagePackingItem(index, itemIndex)}
            />
          ))}
        </div>
      </div>

      <Button
        className="w-full"
        onClick={isEdit ? handleUpdateTemplate : handleCreateTemplate}
        disabled={isEdit ? updateTemplateMutation.isPending : createTemplate.isPending}
      >
        {isEdit
          ? updateTemplateMutation.isPending
            ? "Wird gespeichert..."
            : "Änderungen speichern"
          : createTemplate.isPending
          ? "Wird erstellt..."
          : "Vorlage erstellen"}
      </Button>
    </div>
  );

  return (
    <div className="flex-1 min-h-screen bg-background overflow-x-hidden">
      <header className="border-b border-indigo-500/20 bg-gradient-to-r from-indigo-500/15 via-indigo-500/5 to-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold flex-1">Zeitstrahlübersicht</h1>
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Sticky Toolbar */}
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border pb-3 pt-1 -mx-4 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground">
                  {templates?.length || 0} Vorlage{(templates?.length || 0) !== 1 ? "n" : ""}
                </span>
              </div>
              <Dialog open={isCreateOpen} onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Neue Vorlage</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Neue Zeitstrahl-Vorlage erstellen</DialogTitle>
                  </DialogHeader>
                  {renderTemplateForm(false)}
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Templates List */}
          {!templates || templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Keine Vorlagen vorhanden.</p>
              <Button size="sm" className="mt-4" onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Erste Vorlage erstellen
              </Button>
            </div>
          ) : (
            (() => {
              const grouped = templates.reduce((acc, template) => {
                const key = template.categoryId || "uncategorized";
                const label = template.categoryName || "Ohne Kategorie";
                if (!acc[key]) {
                  acc[key] = { label, templates: [] };
                }
                acc[key].templates.push(template);
                return acc;
              }, {} as Record<string, { label: string; templates: typeof templates }>);

              const sortedGroups = Object.entries(grouped).sort(([keyA, a], [keyB, b]) => {
                if (keyA === "uncategorized") return 1;
                if (keyB === "uncategorized") return -1;
                return a.label.localeCompare(b.label, "de");
              });

              return (
                <div className="space-y-3">
                  {sortedGroups.map(([groupKey, group]) => (
                    <Collapsible key={groupKey}>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/40 transition-colors">
                            <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-medium text-sm flex-1 text-left truncate">{group.label}</span>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {group.templates.length} Vorlage{group.templates.length !== 1 ? "n" : ""}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0 group-data-[state=open]:rotate-180" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="divide-y divide-border/50">
                            {group.templates.map((template) => (
                              <div
                                key={template.id}
                                className="flex items-center gap-3 py-2.5 px-3 pl-7 hover:bg-muted/40 transition-colors group"
                              >
                                <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm truncate">{template.name}</span>
                                    {template.isDefault && (
                                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                                        Standard
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {template.stages.length} Stufen: {template.stages.map(s => s.name).join(" → ")}
                                  </div>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                                      <Pencil className="w-3.5 h-3.5 mr-2" />
                                      Bearbeiten
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setDeleteTemplateId(template.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                                      Löschen
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Zeitstrahl-Vorlage bearbeiten</DialogTitle>
          </DialogHeader>
          {renderTemplateForm(true)}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Vorlage wird
              dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplateId && deleteTemplateMutation.mutate(deleteTemplateId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TimelineTemplates;
