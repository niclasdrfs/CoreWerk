import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TemplateItem {
  id: string;
  text: string;
}

interface StageTemplateItems {
  todos: TemplateItem[];
  packingItems: TemplateItem[];
}

/**
 * Fetch template todos and packing items for a specific timeline stage.
 * This looks up the original template stage based on the site's timeline template_id
 * and matches by stage name.
 */
export const useStageTemplateItems = (
  siteTimelineTemplateId: string | null | undefined,
  stageName: string | undefined
) => {
  return useQuery({
    queryKey: ["stage-template-items", siteTimelineTemplateId, stageName],
    queryFn: async (): Promise<StageTemplateItems> => {
      if (!siteTimelineTemplateId || !stageName) {
        return { todos: [], packingItems: [] };
      }

      // Find the template stage by template_id and stage name
      const { data: templateStage, error: stageError } = await supabase
        .from("timeline_template_stages")
        .select("id")
        .eq("template_id", siteTimelineTemplateId)
        .eq("name", stageName)
        .maybeSingle();

      if (stageError || !templateStage) {
        return { todos: [], packingItems: [] };
      }

      // Fetch todos and packing items in parallel
      const [todosResult, packingResult] = await Promise.all([
        supabase
          .from("timeline_template_stage_todos")
          .select("id, text")
          .eq("stage_id", templateStage.id)
          .order("display_order"),
        supabase
          .from("timeline_template_stage_packing_items")
          .select("id, text")
          .eq("stage_id", templateStage.id)
          .order("display_order"),
      ]);

      return {
        todos: (todosResult.data || []).map(t => ({ id: t.id, text: t.text })),
        packingItems: (packingResult.data || []).map(p => ({ id: p.id, text: p.text })),
      };
    },
    enabled: !!siteTimelineTemplateId && !!stageName,
  });
};

/**
 * Mutation to import template todos and packing items into the assignment
 */
export const useImportStageTemplateItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      todos,
      packingItems,
      importTodos,
      importPacking,
    }: {
      assignmentId: string;
      todos: TemplateItem[];
      packingItems: TemplateItem[];
      importTodos: boolean;
      importPacking: boolean;
    }) => {
      // Import todos
      if (importTodos && todos.length > 0) {
        const todosToInsert = todos.map(t => ({
          daily_assignment_id: assignmentId,
          text: t.text,
          is_completed: false,
        }));

        const { error } = await supabase
          .from("employee_custom_todos")
          .insert(todosToInsert);
        
        if (error) throw error;
      }

      // Import packing items
      if (importPacking && packingItems.length > 0) {
        const packingToInsert = packingItems.map(p => ({
          daily_assignment_id: assignmentId,
          text: p.text,
          is_checked: false,
        }));

        const { error } = await supabase
          .from("assignment_packing_list")
          .insert(packingToInsert);
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["custom-todos", variables.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["packing-list", variables.assignmentId] });
      toast.success("Vorlagen wurden importiert");
    },
    onError: () => {
      toast.error("Fehler beim Importieren der Vorlagen");
    },
  });
};
