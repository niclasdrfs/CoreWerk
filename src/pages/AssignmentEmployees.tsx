import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Users, MapPin, Phone, Plus, Trash2, Package, Undo2, X, ListTodo, ChevronDown, ChevronUp, HardHat, Clock, Pencil, Layers, User, Image as ImageIcon, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { EmployeeSidebar } from "@/components/EmployeeSidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useSiteTimeline, useUpdateStageCompletion } from "@/hooks/useTimelineData";
import { useStageTemplateItems, useImportStageTemplateItems } from "@/hooks/useStageTemplateItems";
import { InteractiveSiteDetailTimeline } from "@/components/timeline/InteractiveSiteDetailTimeline";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TimelineStageHeader } from "@/components/timeline/TimelineStageHeader";
import { StageDocumentUploadButton } from "@/components/timeline/StageDocumentUploadButton";
import { TimelineMiniProgress } from "@/components/timeline/TimelineMiniProgress";
import { StageImportDialog } from "@/components/timeline/StageImportDialog";
import { notifyEmployeeAssignment } from "@/lib/pushNotifications";

const CollapsibleTodoSection = ({ title, icon, items, maxVisible, renderItem }: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  maxVisible: number;
  renderItem: (item: any) => React.ReactNode;
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > maxVisible;
  const visibleItems = expanded ? items : items.slice(0, maxVisible);

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
        {icon}
        {title} ({items.length})
      </h4>
      <div className="space-y-2">
        {visibleItems.map(renderItem)}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 py-1 transition-colors"
        >
          {expanded ? (
            <>Weniger anzeigen <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>{items.length - maxVisible} weitere <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  );
};

const AssignmentEmployees = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    assignmentId
  } = useParams();
  const queryClient = useQueryClient();
  const [newTodoText, setNewTodoText] = useState("");
  const [newPackingItem, setNewPackingItem] = useState("");
  const todoInputRef = useRef<HTMLInputElement>(null);
  const packingInputRef = useRef<HTMLInputElement>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [showEmployeeCards, setShowEmployeeCards] = useState(true);
  const [showAllTodos, setShowAllTodos] = useState(false);
  const [showAllPackingItems, setShowAllPackingItems] = useState(false);
  const [showEmployeeSidebar, setShowEmployeeSidebar] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editDate, setEditDate] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Timeline is only shown for ober-montageleiter (not for employee or installation_manager)
  const showTimelineForRole = !location.pathname.includes("/employee") && !location.pathname.includes("/installation-manager");
  const [showTimeline, setShowTimeline] = useState(true);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [hasShownImportDialog, setHasShownImportDialog] = useState(false);

  // Fetch assignment details
  const {
    data: assignment
  } = useQuery({
    queryKey: ["daily-assignment", assignmentId],
    queryFn: async () => {
      if (!assignmentId) return null;
      const {
        data,
        error
      } = await supabase.from("daily_assignments").select(`
          *,
          construction_sites (
            id,
            customer_last_name,
            address,
            customer_phone,
            color,
            start_date,
            end_date
          )
        `).eq("id", assignmentId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!assignmentId
  });

  // Timeline data - filter to only manager-visible stages
  const siteId = assignment?.construction_site_id;
  const { data: rawTimeline } = useSiteTimeline(siteId);
  const timeline = useMemo(() => {
    if (!rawTimeline) return null;
    return {
      ...rawTimeline,
      stages: rawTimeline.stages.filter(s => s.visibleToManager),
    };
  }, [rawTimeline]);
  const updateStageCompletion = useUpdateStageCompletion();

  // Get current stage for template items
  const currentStage = useMemo(() => {
    if (!timeline || timeline.stages.length === 0) return null;
    return timeline.stages.find(s => !s.isCompleted) || timeline.stages[timeline.stages.length - 1];
  }, [timeline]);

  // Fetch template items for current stage
  const { data: templateItems } = useStageTemplateItems(
    timeline?.templateId,
    currentStage?.name
  );
  const importTemplateItems = useImportStageTemplateItems();

  // Check if there are template items to import
  const hasTemplateItems = useMemo(() => {
    return (templateItems?.todos?.length || 0) > 0 || (templateItems?.packingItems?.length || 0) > 0;
  }, [templateItems]);

  // Auto-show import dialog on first load if template items exist (only for ober-montageleiter)
  useEffect(() => {
    if (showTimelineForRole && hasTemplateItems && !hasShownImportDialog && assignmentId) {
      const timer = setTimeout(() => {
        setShowImportDialog(true);
        setHasShownImportDialog(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showTimelineForRole, hasTemplateItems, hasShownImportDialog, assignmentId]);

  // Handle import confirmation
  const handleImportConfirm = async (importTodos: boolean, importPacking: boolean) => {
    if (!assignmentId || !templateItems) return;
    await importTemplateItems.mutateAsync({
      assignmentId,
      todos: templateItems.todos,
      packingItems: templateItems.packingItems,
      importTodos,
      importPacking,
    });
  };

  const handleToggleStageComplete = (stageId: string, isCompleted: boolean) => {
    if (!siteId) return;
    updateStageCompletion.mutate({ 
      stageId, 
      isCompleted, 
      siteId,
      // Pass employee data for automatic assignment logging when completing
      employeeIds: isCompleted ? assignedEmployees.map(e => e.id) : undefined,
      dailyAssignmentId: isCompleted ? assignmentId : undefined,
      assignmentDate: isCompleted ? assignment?.assignment_date : undefined,
    });
  };

  // Fetch assigned employees for this assignment
  const {
    data: assignedEmployees = []
  } = useQuery({
    queryKey: ["assigned-employees", assignmentId],
    queryFn: async () => {
      if (!assignmentId) return [];
      const {
        data,
        error
      } = await supabase.from("employee_assignments").select(`
          id,
          employee_id,
          profiles:employee_id (
            id,
            full_name,
            email
          )
        `).eq("daily_assignment_id", assignmentId);
      if (error) throw error;
      return data?.map(a => ({
        id: a.employee_id,
        full_name: a.profiles?.full_name,
        email: a.profiles?.email
      })) || [];
    },
    enabled: !!assignmentId
  });

  // Fetch materials assigned to this assignment
  const {
    data: assignedMaterials = []
  } = useQuery({
    queryKey: ["assignment-materials", assignmentId],
    queryFn: async () => {
      if (!assignmentId) return [];
      const {
        data,
        error
      } = await supabase.from("assignment_materials").select("*, materials(*)").eq("daily_assignment_id", assignmentId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!assignmentId
  });

  // Fetch existing material todos
  const {
    data: materialTodos = []
  } = useQuery({
    queryKey: ["material-todos", assignmentId],
    queryFn: async () => {
      if (!assignmentId) return [];
      const {
        data,
        error
      } = await supabase.from("employee_material_todos").select("*").eq("daily_assignment_id", assignmentId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!assignmentId
  });

  // Fetch custom todos
  const {
    data: customTodos = []
  } = useQuery({
    queryKey: ["custom-todos", assignmentId],
    queryFn: async () => {
      if (!assignmentId) return [];
      const {
        data,
        error
      } = await supabase.from("employee_custom_todos").select("*").eq("daily_assignment_id", assignmentId).order("created_at", {
        ascending: true
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!assignmentId
  });

  // Fetch packing list
  const {
    data: packingList = []
  } = useQuery({
    queryKey: ["packing-list", assignmentId],
    queryFn: async () => {
      if (!assignmentId) return [];
      const {
        data,
        error
      } = await supabase.from("assignment_packing_list").select("*").eq("daily_assignment_id", assignmentId).order("created_at", {
        ascending: true
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!assignmentId
  });

  // Add packing list item mutation
  const addPackingItemMutation = useMutation({
    mutationFn: async (text: string) => {
      const {
        error
      } = await supabase.from("assignment_packing_list").insert({
        daily_assignment_id: assignmentId,
        text,
        is_checked: false
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["packing-list", assignmentId]
      });
      setNewPackingItem("");
      setTimeout(() => packingInputRef.current?.focus(), 0);
      toast.success("Eintrag hinzugefügt");
    },
    onError: error => {
      console.error("Error adding packing item:", error);
      toast.error("Fehler beim Hinzufügen");
    }
  });

  // Toggle packing list item mutation
  const togglePackingItemMutation = useMutation({
    mutationFn: async ({
      id,
      isChecked
    }: {
      id: string;
      isChecked: boolean;
    }) => {
      const {
        error
      } = await supabase.from("assignment_packing_list").update({
        is_checked: isChecked
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["packing-list", assignmentId]
      });
    },
    onError: error => {
      console.error("Error toggling packing item:", error);
      toast.error("Fehler beim Aktualisieren");
    }
  });

  // Delete packing list item mutation
  const deletePackingItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const {
        error
      } = await supabase.from("assignment_packing_list").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["packing-list", assignmentId]
      });
      toast.success("Eintrag gelöscht");
    },
    onError: error => {
      console.error("Error deleting packing item:", error);
      toast.error("Fehler beim Löschen");
    }
  });

  // Assign packing item to employee mutation
  const assignPackingItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      employeeId
    }: {
      itemId: string;
      employeeId: string;
    }) => {
      const {
        error
      } = await supabase.from("assignment_packing_list").update({
        employee_id: employeeId
      }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["packing-list", assignmentId]
      });
      toast.success("Eintrag zugewiesen");
    },
    onError: error => {
      console.error("Error assigning packing item:", error);
      toast.error("Fehler beim Zuweisen");
    }
  });

  // Unassign packing item mutation
  const unassignPackingItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const {
        error
      } = await supabase.from("assignment_packing_list").update({
        employee_id: null
      }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["packing-list", assignmentId]
      });
      toast.success("Zuweisung aufgehoben");
    },
    onError: error => {
      console.error("Error unassigning packing item:", error);
      toast.error("Fehler beim Aufheben");
    }
  });

  // Update assignment times mutation
  const updateAssignmentTimesMutation = useMutation({
    mutationFn: async ({
      startTime,
      endTime,
      date
    }: {
      startTime: string;
      endTime: string;
      date?: string;
    }) => {
      const updateData: any = {
        start_time: startTime,
        end_time: endTime
      };
      if (date) updateData.assignment_date = date;
      const {
        error
      } = await supabase.from("daily_assignments").update(updateData).eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["daily-assignment", assignmentId]
      });
      queryClient.invalidateQueries({
        queryKey: ["calendar-data"]
      });
      toast.success("Zeiten aktualisiert!");
      setIsEditingTime(false);
    },
    onError: error => {
      console.error("Error updating times:", error);
      toast.error("Fehler beim Aktualisieren");
    }
  });

  // Delete assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async () => {
      const {
        error
      } = await supabase.from("daily_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["calendar-data"]
      });
      toast.success("Zuweisung gelöscht!");
      navigate(`/installation-manager?date=${assignment?.assignment_date}`);
    },
    onError: error => {
      console.error("Error deleting assignment:", error);
      toast.error("Fehler beim Löschen");
    }
  });
  const handleAddPackingItem = () => {
    const text = newPackingItem.trim();
    if (!text) return;
    addPackingItemMutation.mutate(text);
  };

  // Handle employee card click for selection
  const handleEmployeeCardClick = (e: React.MouseEvent, employeeId: string) => {
    // Don't select if clicking on interactive elements
    if ((e.target as HTMLElement).closest('input, button, [role="checkbox"]')) {
      return;
    }
    setSelectedEmployeeId(prev => prev === employeeId ? null : employeeId);
  };

  // Handle packing item click for assignment
  const handlePackingItemClick = (e: React.MouseEvent, itemId: string) => {
    // Don't assign if clicking on checkbox or delete button
    if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) {
      return;
    }
    if (selectedEmployeeId) {
      assignPackingItemMutation.mutate({
        itemId,
        employeeId: selectedEmployeeId
      });
    }
  };

  // Helper to get unassigned packing items
  const getUnassignedPackingItems = () => {
    return packingList.filter(item => !item.employee_id);
  };

  // Helper to get packing items for an employee
  const getPackingItemsForEmployee = (employeeId: string) => {
    return packingList.filter(item => item.employee_id === employeeId);
  };

  // Get selected employee name for display
  const getSelectedEmployeeName = () => {
    const employee = assignedEmployees.find(e => e.id === selectedEmployeeId);
    return employee?.full_name || employee?.email || '';
  };

  // Toggle material todo mutation
  const toggleTodoMutation = useMutation({
    mutationFn: async ({
      assignmentMaterialId,
      employeeId,
      quantity,
      isAdding
    }: {
      assignmentMaterialId: string;
      employeeId: string;
      quantity: number;
      isAdding: boolean;
    }) => {
      if (isAdding) {
        const {
          error
        } = await supabase.from("employee_material_todos").insert({
          daily_assignment_id: assignmentId,
          employee_id: employeeId,
          assignment_material_id: assignmentMaterialId,
          quantity,
          is_completed: false
        });
        if (error) throw error;
      } else {
        const {
          error
        } = await supabase.from("employee_material_todos").delete().eq("daily_assignment_id", assignmentId).eq("employee_id", employeeId).eq("assignment_material_id", assignmentMaterialId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["material-todos", assignmentId]
      });
    },
    onError: error => {
      console.error("Error toggling todo:", error);
      toast.error("Fehler beim Aktualisieren der To-do-Liste");
    }
  });

  // Complete material todo mutation
  const completeTodoMutation = useMutation({
    mutationFn: async ({
      todoId,
      isCompleted
    }: {
      todoId: string;
      isCompleted: boolean;
    }) => {
      const {
        error
      } = await supabase.from("employee_material_todos").update({
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null
      }).eq("id", todoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["material-todos", assignmentId]
      });
    },
    onError: error => {
      console.error("Error completing todo:", error);
      toast.error("Fehler beim Aktualisieren");
    }
  });

  // Create custom todo mutation (central - no employee_id)
  const createCustomTodoMutation = useMutation({
    mutationFn: async (text: string) => {
      const {
        error
      } = await supabase.from("employee_custom_todos").insert({
        daily_assignment_id: assignmentId,
        text,
        is_completed: false
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["custom-todos", assignmentId]
      });
      setNewTodoText("");
      setTimeout(() => todoInputRef.current?.focus(), 0);
      toast.success("To-Do erstellt");
    },
    onError: error => {
      console.error("Error creating todo:", error);
      toast.error("Fehler beim Erstellen");
    }
  });

  // Assign todo to employee mutation
  const assignTodoMutation = useMutation({
    mutationFn: async ({
      todoId,
      employeeId
    }: {
      todoId: string;
      employeeId: string;
    }) => {
      const {
        error
      } = await supabase.from("employee_custom_todos").update({
        employee_id: employeeId
      }).eq("id", todoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["custom-todos", assignmentId]
      });
      toast.success("To-Do zugewiesen");
    },
    onError: error => {
      console.error("Error assigning todo:", error);
      toast.error("Fehler beim Zuweisen");
    }
  });

  // Unassign todo mutation
  const unassignTodoMutation = useMutation({
    mutationFn: async (todoId: string) => {
      const {
        error
      } = await supabase.from("employee_custom_todos").update({
        employee_id: null
      }).eq("id", todoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["custom-todos", assignmentId]
      });
      toast.success("Zuweisung aufgehoben");
    },
    onError: error => {
      console.error("Error unassigning todo:", error);
      toast.error("Fehler beim Aufheben");
    }
  });

  // Complete custom todo mutation
  const completeCustomTodoMutation = useMutation({
    mutationFn: async ({
      todoId,
      isCompleted
    }: {
      todoId: string;
      isCompleted: boolean;
    }) => {
      const {
        error
      } = await supabase.from("employee_custom_todos").update({
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null
      }).eq("id", todoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["custom-todos", assignmentId]
      });
    },
    onError: error => {
      console.error("Error completing todo:", error);
      toast.error("Fehler beim Aktualisieren");
    }
  });

  // Delete custom todo mutation
  const deleteCustomTodoMutation = useMutation({
    mutationFn: async (todoId: string) => {
      const {
        error
      } = await supabase.from("employee_custom_todos").delete().eq("id", todoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["custom-todos", assignmentId]
      });
      toast.success("To-Do gelöscht");
    },
    onError: error => {
      console.error("Error deleting todo:", error);
      toast.error("Fehler beim Löschen");
    }
  });
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };
  const formatTime = (timeString: string | null) => {
    if (!timeString) return "";
    return timeString.slice(0, 5);
  };

  // Helper to get material todos for a specific employee
  const getMaterialTodosForEmployee = (employeeId: string) => {
    return materialTodos.filter(t => t.employee_id === employeeId);
  };

  // Helper to get custom todos for a specific employee
  const getCustomTodosForEmployee = (employeeId: string) => {
    return customTodos.filter(t => t.employee_id === employeeId);
  };

  // Helper to get unassigned custom todos
  const getUnassignedTodos = () => {
    return customTodos.filter(t => !t.employee_id);
  };

  // Helper to check if a material is assigned to an employee
  const isMaterialAssignedToEmployee = (assignmentMaterialId: string, employeeId: string) => {
    return materialTodos.some(t => t.assignment_material_id === assignmentMaterialId && t.employee_id === employeeId);
  };
  const handleToggleMaterialTodo = (material: any, employeeId: string, checked: boolean) => {
    toggleTodoMutation.mutate({
      assignmentMaterialId: material.id,
      employeeId,
      quantity: material.quantity || 1,
      isAdding: checked
    });
  };
  const handleAddTodo = () => {
    const text = newTodoText.trim();
    if (!text) return;
    createCustomTodoMutation.mutate(text);
  };

  // Handle todo click for assignment
  const handleTodoClick = (e: React.MouseEvent, todoId: string) => {
    // Don't assign if clicking on checkbox or delete button
    if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) {
      return;
    }
    if (selectedEmployeeId) {
      assignTodoMutation.mutate({
        todoId,
        employeeId: selectedEmployeeId
      });
    }
  };
  return <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-card safe-top sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={() => {
            const dateParam = assignment?.assignment_date ? `?date=${assignment.assignment_date}` : "";
            const backPath = location.pathname.includes("/ober-montageleiter") ? "/ober-montageleiter" : location.pathname.includes("/employee") ? "/employee/workday" : "/installation-manager";
            navigate(`${backPath}${location.pathname.includes("/employee") ? "" : dateParam}`);
          }} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Assignment Header Card */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
              backgroundColor: assignment?.construction_sites?.color || 'hsl(var(--accent))'
            }}>
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground truncate">
                  {assignment?.construction_sites?.customer_last_name}
                </h1>
                {showTimelineForRole && timeline && timeline.stages.length > 0 && (
                  <TimelineMiniProgress 
                    completedStages={timeline.stages.filter(s => s.isCompleted).length}
                    totalStages={timeline.stages.length}
                  />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground">
                  {formatDate(assignment?.assignment_date)} • {formatTime(assignment?.start_time)} – {formatTime(assignment?.end_time)}
                </p>
                <Button variant="ghost" size="icon" onClick={() => {
                  setEditStartTime(assignment?.start_time?.slice(0, 5) || "08:00");
                  setEditEndTime(assignment?.end_time?.slice(0, 5) || "17:00");
                  setEditDate(assignment?.assignment_date || "");
                  setIsEditingTime(true);
                }} className="h-6 w-6">
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
              {(assignment?.construction_sites?.start_date || assignment?.construction_sites?.end_date) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bauzeit: {assignment?.construction_sites?.start_date ? new Date(assignment.construction_sites.start_date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"}
                  {" – "}
                  {assignment?.construction_sites?.end_date ? new Date(assignment.construction_sites.end_date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 text-sm">
            {assignment?.construction_sites?.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(assignment.construction_sites.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline text-xs">
                <MapPin className="w-3.5 h-3.5" />
                {assignment.construction_sites.address}
              </a>}
            {assignment?.construction_sites?.customer_phone && <a href={`tel:${assignment.construction_sites.customer_phone}`} className="flex items-center gap-1.5 text-primary hover:underline text-xs">
                <Phone className="w-3.5 h-3.5" />
                {assignment.construction_sites.customer_phone}
              </a>}
          </div>

          {/* Navigation buttons */}
          {siteId && (() => {
            const basePath = location.pathname.includes("/ober-montageleiter") ? "/ober-montageleiter" : location.pathname.includes("/employee") ? "/employee" : "/installation-manager";
            return (
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/site/${siteId}/kundeninfo`)} className="gap-1.5 rounded-lg h-9 text-xs justify-start">
                  <User className="w-3.5 h-3.5 text-primary" />
                  Kundeninfo
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/site/${siteId}/plaene`)} className="gap-1.5 rounded-lg h-9 text-xs justify-start">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                  Pläne & Bilder
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/site/${siteId}/schriftverkehr`)} className="gap-1.5 rounded-lg h-9 text-xs justify-start">
                  <MessageSquare className="w-3.5 h-3.5 text-violet-600" />
                  Schriftverkehr
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/site/${siteId}/kontakt`)} className="gap-1.5 rounded-lg h-9 text-xs justify-start">
                  <Phone className="w-3.5 h-3.5 text-sky-600" />
                  Kontakt
                </Button>
              </div>
            );
          })()}

          <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t">
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)} className="gap-2 rounded-lg h-8 text-xs">
              <Trash2 className="w-3.5 h-3.5" />
              Löschen
            </Button>
          </div>
        </div>

        {/* Selection mode hint */}
        {selectedEmployeeId && <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm">
              Klicke auf Einträge um sie <strong>{getSelectedEmployeeName()}</strong> zuzuweisen
            </span>
            <Button size="sm" variant="ghost" onClick={() => setSelectedEmployeeId(null)} className="gap-1">
              <X className="w-4 h-4" />
              Abbrechen
            </Button>
          </div>}

        {/* Two-column layout: To-Dos (left) & Packliste (right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* To-Dos */}
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <ListTodo className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="font-semibold">To-Dos</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {customTodos.filter(t => t.is_completed).length}/{customTodos.length}
              </span>
            </div>

            <div className="flex gap-2">
              <Input ref={todoInputRef} placeholder="Neues To-Do..." value={newTodoText} onChange={e => setNewTodoText(e.target.value)} onKeyDown={e => {
                if (e.key === "Enter") handleAddTodo();
              }} className="rounded-lg text-sm h-9" />
              <Button size="icon" variant="outline" onClick={handleAddTodo} disabled={!newTodoText.trim() || createCustomTodoMutation.isPending} className="rounded-lg h-9 w-9 shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-1.5">
              {(() => {
                const unassignedTodos = getUnassignedTodos();
                const visibleTodos = showAllTodos ? unassignedTodos : unassignedTodos.slice(0, 3);
                const hiddenCount = unassignedTodos.length - 3;
                return unassignedTodos.length > 0 ? <>
                  {visibleTodos.map(todo => (
                    <div
                      key={todo.id}
                      onClick={e => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        if (selectedEmployeeId) {
                          handleTodoClick(e, todo.id);
                        } else {
                          completeCustomTodoMutation.mutate({ todoId: todo.id, isCompleted: !todo.is_completed });
                        }
                      }}
                      className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors cursor-pointer ${
                        todo.is_completed ? 'bg-green-500/15' : 'hover:bg-muted/50'
                      } ${selectedEmployeeId ? 'hover:bg-primary/10' : ''}`}
                    >
                      <Checkbox checked={todo.is_completed || false} onCheckedChange={() => {}} className="pointer-events-none" />
                      <span className={`flex-1 text-sm ${todo.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                        {todo.text}
                      </span>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteCustomTodoMutation.mutate(todo.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {hiddenCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAllTodos(!showAllTodos)} className="w-full text-xs text-muted-foreground hover:text-foreground">
                      {showAllTodos ? <><ChevronUp className="w-3 h-3 mr-1" />Weniger</> : <>+{hiddenCount} weitere</>}
                    </Button>
                  )}
                </> : (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    {customTodos.length > 0 ? 'Alle To-Dos zugewiesen' : 'Noch keine To-Dos'}
                  </p>
                );
              })()}
            </div>
          </div>

          {/* Packliste */}
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                  <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="font-semibold">Packliste</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {packingList.filter(p => p.is_checked).length}/{packingList.length}
              </span>
            </div>

            <div className="flex gap-2">
              <Input ref={packingInputRef} placeholder="Neuen Eintrag..." value={newPackingItem} onChange={e => setNewPackingItem(e.target.value)} onKeyDown={e => {
                if (e.key === "Enter") handleAddPackingItem();
              }} className="rounded-lg text-sm h-9" />
              <Button size="icon" variant="outline" onClick={handleAddPackingItem} disabled={!newPackingItem.trim() || addPackingItemMutation.isPending} className="rounded-lg h-9 w-9 shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-1.5">
              {(() => {
                const unassignedItems = getUnassignedPackingItems();
                const visibleItems = showAllPackingItems ? unassignedItems : unassignedItems.slice(0, 3);
                const hiddenCount = unassignedItems.length - 3;
                return unassignedItems.length > 0 ? <>
                  {visibleItems.map(item => (
                    <div
                      key={item.id}
                      onClick={e => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        if (selectedEmployeeId) {
                          handlePackingItemClick(e, item.id);
                        } else {
                          togglePackingItemMutation.mutate({ id: item.id, isChecked: !item.is_checked });
                        }
                      }}
                      className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors cursor-pointer ${
                        item.is_checked ? 'bg-green-500/15' : 'hover:bg-muted/50'
                      } ${selectedEmployeeId ? 'hover:bg-primary/10' : ''}`}
                    >
                      <Checkbox checked={item.is_checked || false} onCheckedChange={() => {}} className="pointer-events-none" />
                      <span className={`flex-1 text-sm ${item.is_checked ? 'line-through text-muted-foreground' : ''}`}>
                        {item.text}
                      </span>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deletePackingItemMutation.mutate(item.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {hiddenCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAllPackingItems(!showAllPackingItems)} className="w-full text-xs text-muted-foreground hover:text-foreground">
                      {showAllPackingItems ? <><ChevronUp className="w-3 h-3 mr-1" />Weniger</> : <>+{hiddenCount} weitere</>}
                    </Button>
                  )}
                </> : (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    {packingList.length > 0 ? 'Alle Einträge zugewiesen' : 'Noch keine Einträge'}
                  </p>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Toggle Employee Cards */}
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setShowEmployeeCards(!showEmployeeCards)} className="gap-2 rounded-xl">
            {showEmployeeCards ? <>
                <ChevronUp className="w-4 h-4" />
                Mitarbeiter ausblenden
              </> : <>
                <ChevronDown className="w-4 h-4" />
                Mitarbeiter anzeigen ({assignedEmployees.length})
              </>}
          </Button>
        </div>

        {/* Employees Grid */}
        {showEmployeeCards && assignedEmployees.length > 0 && <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {assignedEmployees.map(employee => {
            const employeeMaterialTodos = getMaterialTodosForEmployee(employee.id);
            const employeeCustomTodos = getCustomTodosForEmployee(employee.id);
            const employeePackingItems = getPackingItemsForEmployee(employee.id);
            const totalTodos = employeeMaterialTodos.length + employeeCustomTodos.length + employeePackingItems.length;
            const completedCount = employeeMaterialTodos.filter(t => t.is_completed).length + employeeCustomTodos.filter(t => t.is_completed).length + employeePackingItems.filter(p => p.is_checked).length;
            return <div key={employee.id} onClick={e => handleEmployeeCardClick(e, employee.id)} className={`bg-card border rounded-xl p-4 flex flex-col transition-all cursor-pointer ${selectedEmployeeId === employee.id ? 'ring-2 ring-green-500 ring-offset-2 bg-green-500/15' : 'hover:bg-muted/50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">{employee.full_name || employee.email}</span>
                      {totalTodos > 0 && <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {completedCount}/{totalTodos}
                        </span>}
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="flex-1 space-y-4">
                          {/* To-Dos Section - collapsible after 2 */}
                          {employeeCustomTodos.length > 0 && <CollapsibleTodoSection
                            title="To-Dos"
                            icon={<ListTodo className="w-3 h-3" />}
                            items={employeeCustomTodos}
                            maxVisible={2}
                            renderItem={(todo) => (
                              <div key={todo.id} className={`p-3 rounded-lg border transition-colors cursor-pointer ${todo.is_completed ? 'bg-green-500/10 border-green-500/30' : 'bg-card border-border'}`}
                                onClick={(e) => {
                                  if ((e.target as HTMLElement).closest('button')) return;
                                  completeCustomTodoMutation.mutate({ todoId: todo.id, isCompleted: !todo.is_completed });
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <Checkbox checked={todo.is_completed} onCheckedChange={() => {}} className="mt-0.5 pointer-events-none" />
                                  <p className={`flex-1 text-sm ${todo.is_completed ? 'line-through text-muted-foreground' : ''}`}>{todo.text}</p>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => unassignTodoMutation.mutate(todo.id)} title="Zurück zur To-Do-Liste">
                                    <Undo2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          />}

                          {/* Packliste Section - collapsible after 2 */}
                          {employeePackingItems.length > 0 && <CollapsibleTodoSection
                            title="Packliste"
                            icon={<Package className="w-3 h-3" />}
                            items={employeePackingItems}
                            maxVisible={2}
                            renderItem={(item) => (
                              <div key={item.id} className={`p-3 rounded-lg border transition-colors cursor-pointer ${item.is_checked ? 'bg-green-500/10 border-green-500/30' : 'bg-card border-border'}`}
                                onClick={(e) => {
                                  if ((e.target as HTMLElement).closest('button')) return;
                                  togglePackingItemMutation.mutate({ id: item.id, isChecked: !item.is_checked });
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <Checkbox checked={item.is_checked || false} onCheckedChange={() => {}} className="mt-0.5 pointer-events-none" />
                                  <p className={`flex-1 text-sm ${item.is_checked ? 'line-through text-muted-foreground' : ''}`}>{item.text}</p>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => unassignPackingItemMutation.mutate(item.id)} title="Zurück zur Packliste">
                                    <Undo2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          />}

                          {/* Material Todos */}
                          {employeeMaterialTodos.length > 0 && <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                                Material
                              </h4>
                              <div className="space-y-2">
                                {employeeMaterialTodos.map(todo => {
                          const material = assignedMaterials.find(m => m.id === todo.assignment_material_id);
                          return <div key={todo.id} className={`p-3 rounded-lg border transition-colors cursor-pointer ${todo.is_completed ? 'bg-green-500/10 border-green-500/30' : 'bg-accent/30 border-accent/50'}`}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('button')) return;
                              completeTodoMutation.mutate({ todoId: todo.id, isCompleted: !todo.is_completed });
                            }}
                          >
                                      <div className="flex items-start gap-2">
                                        <Checkbox checked={todo.is_completed} onCheckedChange={() => {}} className="mt-0.5 pointer-events-none" />
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm font-medium ${todo.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                            📦 {material?.materials?.name || 'Material'}
                                            {todo.quantity > 1 && <span className="ml-1 text-xs text-muted-foreground">(×{todo.quantity})</span>}
                                          </p>
                                          {todo.notes && <p className="text-xs text-muted-foreground mt-1">{todo.notes}</p>}
                                        </div>
                                      </div>
                                    </div>;
                        })}
                              </div>
                            </div>}

                          {/* Add more materials */}
                          {assignedMaterials.length > employeeMaterialTodos.length && <div className="pt-2 border-t mt-3">
                              <p className="text-xs text-muted-foreground mb-2">Material hinzufügen:</p>
                              <div className="space-y-2">
                                {assignedMaterials.filter(m => !isMaterialAssignedToEmployee(m.id, employee.id)).map(material => <button key={material.id} onClick={() => handleToggleMaterialTodo(material, employee.id, true)} className="w-full text-left p-2 rounded border border-dashed border-muted-foreground/30 hover:border-primary hover:bg-accent/50 transition-colors text-sm flex items-center gap-2">
                                      <Plus className="w-4 h-4 text-muted-foreground" />
                                      <span className="truncate">{material.materials?.name}</span>
                                      {material.quantity > 1 && <span className="text-xs text-muted-foreground ml-auto">×{material.quantity}</span>}
                                    </button>)}
                              </div>
                            </div>}

                          {totalTodos === 0 && assignedMaterials.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">
                              Noch keine Aufgaben
                            </p>}
                        </div>
                    </div>
                  </div>;
          })}
            </div>

            {/* Helm Button to open sidebar */}
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={() => setShowEmployeeSidebar(true)} className="h-14 w-48 flex flex-col items-center justify-center gap-1 rounded-xl">
                <HardHat className="w-5 h-5" />
                <span className="text-xs">Mitarbeiter zuteilen</span>
              </Button>
            </div>
          </>}
        
        {assignedEmployees.length === 0 && showEmployeeCards && <>
            <div className="bg-card border rounded-xl p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">Keine Mitarbeiter zugeteilt</h2>
                <p className="text-muted-foreground text-sm">
                  Nutze den Helm-Button unten, um Mitarbeiter zuzuteilen.
                </p>
            </div>
            
            {/* Helm Button when no employees */}
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setShowEmployeeSidebar(true)} className="h-14 w-48 flex flex-col items-center justify-center gap-1 rounded-xl">
                <HardHat className="w-5 h-5" />
                <span className="text-xs">Mitarbeiter zuteilen</span>
              </Button>
            </div>
          </>}

        {/* Timeline Section */}
        {showTimelineForRole && timeline && timeline.stages.length > 0 && (
          <Collapsible open={showTimeline} onOpenChange={setShowTimeline}>
            <div className="bg-card border rounded-xl overflow-hidden">
              <CollapsibleTrigger className="w-full p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="font-semibold">Zeitstrahl</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {timeline.stages.filter(s => s.isCompleted).length}/{timeline.stages.length}
                    </span>
                    {showTimeline ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4">
                  <InteractiveSiteDetailTimeline
                    stages={timeline.stages}
                    currentStageIndex={timeline.currentStageIndex}
                    siteId={siteId!}
                    onToggleComplete={handleToggleStageComplete}
                    isUpdating={updateStageCompletion.isPending}
                    basePath={location.pathname.includes("/ober-montageleiter") ? "/ober-montageleiter" : location.pathname.includes("/employee") ? "/employee" : "/installation-manager"}
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

      </main>

      {/* Employee Sidebar Sheet */}
      {assignment && <Sheet open={showEmployeeSidebar} onOpenChange={setShowEmployeeSidebar}>
          <SheetContent side="right" className="w-80 p-0">
            <EmployeeSidebar selectedDay={new Date(assignment.assignment_date)} companyId={assignment.company_id} onEmployeeClick={async (employeeId) => {
          // Assign employee to this assignment
          const { error } = await supabase.from("employee_assignments").insert({
            daily_assignment_id: assignmentId,
            employee_id: employeeId
          });
          
          if (error) {
            console.error("Error assigning employee:", error);
            toast.error("Fehler beim Zuteilen");
          } else {
            toast.success("Mitarbeiter zugeteilt");
            queryClient.invalidateQueries({
              queryKey: ["assigned-employees", assignmentId]
            });
            queryClient.invalidateQueries({
              queryKey: ["day-employee-assignments"]
            });
            
            // Send push notification to the assigned employee
            const siteName = assignment.construction_sites?.customer_last_name || "Baustelle";
            await notifyEmployeeAssignment(employeeId, siteName, assignment.assignment_date);
          }
        }} onClose={() => setShowEmployeeSidebar(false)} hideCloseButton />
          </SheetContent>
        </Sheet>}

      {/* Time & Date Edit Dialog */}
      <Dialog open={isEditingTime} onOpenChange={setIsEditingTime}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Datum & Zeiten bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Datum</Label>
              <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Startzeit</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="08:00"
                  value={editStartTime}
                  onChange={e => {
                    let val = e.target.value.replace(/[^\d:]/g, '');
                    if (val.length === 2 && !val.includes(':') && editStartTime.length < val.length) val += ':';
                    if (val.length <= 5) setEditStartTime(val);
                  }}
                  maxLength={5}
                />
              </div>
              <div className="grid gap-2">
                <Label>Endzeit</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="17:00"
                  value={editEndTime}
                  onChange={e => {
                    let val = e.target.value.replace(/[^\d:]/g, '');
                    if (val.length === 2 && !val.includes(':') && editEndTime.length < val.length) val += ':';
                    if (val.length <= 5) setEditEndTime(val);
                  }}
                  maxLength={5}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingTime(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => updateAssignmentTimesMutation.mutate({
            startTime: editStartTime,
            endTime: editEndTime,
            date: editDate || undefined
          })} disabled={updateAssignmentTimesMutation.isPending || !editStartTime.match(/^\d{2}:\d{2}$/) || !editEndTime.match(/^\d{2}:\d{2}$/)}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zuweisung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Zuweisung und alle zugehörigen Daten werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAssignmentMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stage Template Import Dialog - only for ober-montageleiter */}
      {showTimelineForRole && currentStage && templateItems && (
        <StageImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          stageName={currentStage.name}
          todos={templateItems.todos}
          packingItems={templateItems.packingItems}
          onConfirm={handleImportConfirm}
          isLoading={importTemplateItems.isPending}
        />
      )}
    </div>;
};
export default AssignmentEmployees;