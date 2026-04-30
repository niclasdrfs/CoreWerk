import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TimelineTemplate {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isDefault: boolean;
  stages: TimelineTemplateStage[];
}

export interface TimelineTemplateStage {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  visibleToManager: boolean;
}

export interface SiteTimelineStage {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: string | null;
  visibleToManager: boolean;
}

export interface SiteTimeline {
  id: string;
  constructionSiteId: string;
  templateId: string | null;
  isCustom: boolean;
  currentStageIndex: number;
  stages: SiteTimelineStage[];
}

// Fetch templates for a company (optimized with JOIN query)
export const useTimelineTemplates = (categoryId?: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["timeline-templates", categoryId],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.company_id) throw new Error("No company found");

      // Single query with nested select for stages (eliminates N+1 problem)
      let query = supabase
        .from("timeline_templates")
        .select(`
          id,
          name,
          description,
          category_id,
          is_default,
          construction_site_categories (
            id,
            name
          ),
          timeline_template_stages (
            id,
            name,
            description,
            display_order,
            visible_to_manager
          )
        `)
        .eq("company_id", profile.company_id)
        .order("is_default", { ascending: false })
        .order("name");

      if (categoryId) {
        query = query.or(`category_id.eq.${categoryId},category_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data - stages are already included
      const templates: TimelineTemplate[] = (data || []).map(t => {
        const category = t.construction_site_categories as { id: string; name: string } | null;
        const stages = (t.timeline_template_stages || []) as Array<{
          id: string;
          name: string;
          description: string | null;
          display_order: number;
          visible_to_manager: boolean;
        }>;

        return {
          id: t.id,
          name: t.name,
          description: t.description,
          categoryId: t.category_id,
          categoryName: category?.name || null,
          isDefault: t.is_default,
          stages: stages
            .sort((a, b) => a.display_order - b.display_order)
            .map(s => ({
              id: s.id,
              name: s.name,
              description: s.description,
              displayOrder: s.display_order,
              visibleToManager: s.visible_to_manager,
            })),
        };
      });

      return templates;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
};

// Batch fetch timelines for multiple sites (used in overview pages)
export interface BatchTimelineData {
  currentStageIndex: number;
  totalStages: number;
  completedStages: number;
}

export const useSiteTimelines = (siteIds: string[]) => {
  return useQuery({
    queryKey: ["site-timelines-batch", siteIds.sort().join(",")],
    queryFn: async () => {
      if (!siteIds.length) return new Map<string, BatchTimelineData>();

      // Single query for all timelines with stages
      const { data: timelines, error } = await supabase
        .from("construction_site_timelines")
        .select(`
          id,
          construction_site_id,
          current_stage_index,
          construction_site_timeline_stages (
            id,
            is_completed,
            display_order
          )
        `)
        .in("construction_site_id", siteIds);

      if (error) throw error;

      // Build map for O(1) access
      const map = new Map<string, BatchTimelineData>();
      (timelines || []).forEach(t => {
        const stages = (t.construction_site_timeline_stages || []) as Array<{
          id: string;
          is_completed: boolean;
          display_order: number;
        }>;
        
        map.set(t.construction_site_id, {
          currentStageIndex: t.current_stage_index ?? 0,
          totalStages: stages.length,
          completedStages: stages.filter(s => s.is_completed).length,
        });
      });

      return map;
    },
    enabled: siteIds.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
};

// Fetch timeline for a specific construction site (for detail pages)
export const useSiteTimeline = (siteId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["site-timeline", siteId],
    queryFn: async () => {
      if (!siteId || !user) return null;

      // Optimized: single query with nested stages
      const { data: timeline, error } = await supabase
        .from("construction_site_timelines")
        .select(`
          id,
          construction_site_id,
          template_id,
          is_custom,
          current_stage_index,
          construction_site_timeline_stages (
            id,
            name,
            description,
            display_order,
            is_completed,
            completed_at,
            completed_by,
            visible_to_manager
          )
        `)
        .eq("construction_site_id", siteId)
        .maybeSingle();

      if (error) throw error;
      if (!timeline) return null;

      const stages = (timeline.construction_site_timeline_stages || []) as Array<{
        id: string;
        name: string;
        description: string | null;
        display_order: number;
        is_completed: boolean;
        completed_at: string | null;
        completed_by: string | null;
        visible_to_manager: boolean;
      }>;

      return {
        id: timeline.id,
        constructionSiteId: timeline.construction_site_id,
        templateId: timeline.template_id,
        isCustom: timeline.is_custom,
        currentStageIndex: timeline.current_stage_index,
        stages: stages
          .sort((a, b) => a.display_order - b.display_order)
            .map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            displayOrder: s.display_order,
            isCompleted: s.is_completed,
            completedAt: s.completed_at,
            completedBy: s.completed_by,
            visibleToManager: s.visible_to_manager,
          })),
      } as SiteTimeline;
    },
    enabled: !!siteId && !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
};

// Create or update timeline for a site
export const useCreateSiteTimeline = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      siteId,
      templateId,
      customStages,
    }: {
      siteId: string;
      templateId?: string;
      customStages?: Array<{ name: string; description?: string }>;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Check if timeline already exists
      const { data: existing } = await supabase
        .from("construction_site_timelines")
        .select("id")
        .eq("construction_site_id", siteId)
        .maybeSingle();

      if (existing) {
        // Delete existing timeline (cascade deletes stages)
        await supabase
          .from("construction_site_timelines")
          .delete()
          .eq("id", existing.id);
      }

      // Create new timeline
      const { data: newTimeline, error: timelineError } = await supabase
        .from("construction_site_timelines")
        .insert({
          construction_site_id: siteId,
          template_id: templateId || null,
          is_custom: !templateId,
          current_stage_index: 0,
        })
        .select()
        .single();

      if (timelineError) throw timelineError;

      // Get stages from template or use custom
      let stagesToCreate: Array<{ name: string; description?: string | null; display_order: number; visible_to_manager?: boolean }> = [];

      if (templateId) {
        const { data: templateStages } = await supabase
          .from("timeline_template_stages")
          .select("name, description, display_order, visible_to_manager")
          .eq("template_id", templateId)
          .order("display_order");

        stagesToCreate = (templateStages || []).map(s => ({
          name: s.name,
          description: s.description,
          display_order: s.display_order,
          visible_to_manager: s.visible_to_manager,
        }));
      } else if (customStages) {
        stagesToCreate = customStages.map((s, i) => ({
          name: s.name,
          description: s.description || null,
          display_order: i,
        }));
      }

      // Create stages
      if (stagesToCreate.length > 0) {
        const { error: stagesError } = await supabase
          .from("construction_site_timeline_stages")
          .insert(
            stagesToCreate.map(s => ({
              timeline_id: newTimeline.id,
              name: s.name,
              description: s.description,
              display_order: s.display_order,
              visible_to_manager: s.visible_to_manager ?? true,
            }))
          );

        if (stagesError) throw stagesError;
      }

      return newTimeline;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["site-timeline", variables.siteId] });
      toast.success("Zeitstrahl wurde erstellt");
    },
    onError: () => {
      toast.error("Fehler beim Erstellen des Zeitstrahls");
    },
  });
};

// Update stage completion status
export const useUpdateStageCompletion = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stageId,
      isCompleted,
      siteId,
      // Optional parameters for automatic employee assignment
      employeeIds,
      dailyAssignmentId,
      assignmentDate,
    }: {
      stageId: string;
      isCompleted: boolean;
      siteId: string;
      employeeIds?: string[];
      dailyAssignmentId?: string;
      assignmentDate?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("construction_site_timeline_stages")
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          completed_by: isCompleted ? user.id : null,
        })
        .eq("id", stageId);

      if (error) throw error;

      // Auto-assign employees when stage is completed
      if (isCompleted && employeeIds && employeeIds.length > 0) {
        const assignmentsToInsert = employeeIds.map(empId => ({
          stage_id: stageId,
          employee_id: empId,
          assigned_by: user.id,
          notes: "Automatisch erfasst bei Stufen-Abschluss",
          assignment_date: assignmentDate || null,
          daily_assignment_id: dailyAssignmentId || null,
        }));

        const { error: assignError } = await supabase
          .from("stage_employee_assignments")
          .insert(assignmentsToInsert);

        if (assignError) {
          console.error("Error inserting stage employee assignments:", assignError);
          // Don't throw - the stage completion succeeded, this is secondary
        }
      }

      // Update current_stage_index in timeline
      const { data: timeline } = await supabase
        .from("construction_site_timelines")
        .select("id")
        .eq("construction_site_id", siteId)
        .maybeSingle();

      if (timeline) {
        const { data: stages } = await supabase
          .from("construction_site_timeline_stages")
          .select("id, is_completed")
          .eq("timeline_id", timeline.id)
          .order("display_order");

        const currentIndex = stages?.findIndex(s => !s.is_completed) ?? 0;
        await supabase
          .from("construction_site_timelines")
          .update({ current_stage_index: currentIndex === -1 ? stages?.length || 0 : currentIndex })
          .eq("id", timeline.id);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["site-timeline", variables.siteId] });
      queryClient.invalidateQueries({ queryKey: ["stage-employees"] });
    },
    onError: () => {
      toast.error("Fehler beim Aktualisieren der Stufe");
    },
  });
};

// Create a new template
export const useCreateTemplate = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      description,
      categoryId,
      isDefault,
      stages,
    }: {
      name: string;
      description?: string;
      categoryId?: string | null;
      isDefault?: boolean;
      stages: Array<{ 
        name: string; 
        description?: string;
        visibleToManager?: boolean;
        todos?: Array<{ text: string }>;
        packingItems?: Array<{ text: string }>;
      }>;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.company_id) throw new Error("No company found");

      // If setting as default, unset other defaults for this category
      if (isDefault) {
        await supabase
          .from("timeline_templates")
          .update({ is_default: false })
          .eq("company_id", profile.company_id)
          .eq("category_id", categoryId || null);
      }

      const { data: template, error: templateError } = await supabase
        .from("timeline_templates")
        .insert({
          company_id: profile.company_id,
          name,
          description: description || null,
          category_id: categoryId || null,
          is_default: isDefault || false,
          created_by: user.id,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Create stages and get their IDs
      if (stages.length > 0) {
        const { data: insertedStages, error: stagesError } = await supabase
          .from("timeline_template_stages")
          .insert(
            stages.map((s, i) => ({
              template_id: template.id,
              name: s.name,
              description: s.description || null,
              display_order: i,
              visible_to_manager: s.visibleToManager ?? true,
            }))
          )
          .select("id");

        if (stagesError) throw stagesError;

        // Insert todos
        const todosToInsert = stages.flatMap((stage, i) => 
          (stage.todos || []).map((todo, todoIdx) => ({
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

        // Insert packing items
        const packingToInsert = stages.flatMap((stage, i) => 
          (stage.packingItems || []).map((item, itemIdx) => ({
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
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline-templates"] });
      queryClient.invalidateQueries({ queryKey: ["timeline-templates-for-select"] });
      toast.success("Zeitstrahl-Vorlage erstellt");
    },
    onError: () => {
      toast.error("Fehler beim Erstellen der Vorlage");
    },
  });
};
