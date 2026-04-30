import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { GripVertical, Trash2, Plus, ListTodo, Package, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

interface StageFormCardProps {
  stage: TemplateStage;
  index: number;
  totalStages: number;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onRemove: () => void;
  onAddTodo: (text: string) => void;
  onRemoveTodo: (todoIndex: number) => void;
  onAddPackingItem: (text: string) => void;
  onRemovePackingItem: (itemIndex: number) => void;
}

export const StageFormCard = ({
  stage,
  index,
  totalStages,
  onNameChange,
  onDescriptionChange,
  onRemove,
  onAddTodo,
  onRemoveTodo,
  onAddPackingItem,
  onRemovePackingItem,
}: StageFormCardProps) => {
  const [newTodo, setNewTodo] = useState("");
  const [newPackingItem, setNewPackingItem] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAddTodo = () => {
    if (newTodo.trim()) {
      onAddTodo(newTodo.trim());
      setNewTodo("");
    }
  };

  const handleAddPackingItem = () => {
    if (newPackingItem.trim()) {
      onAddPackingItem(newPackingItem.trim());
      setNewPackingItem("");
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 text-muted-foreground pt-2">
          <GripVertical className="w-4 h-4" />
          <span className="text-sm font-medium">{index + 1}.</span>
        </div>
        <div className="flex-1 space-y-2">
          <Input
            placeholder="Name der Stufe"
            value={stage.name}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <Textarea
            placeholder="Beschreibung (optional)"
            value={stage.description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="min-h-[60px]"
          />

          {/* Expandable To-Dos and Packing Items */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                <span className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4" />
                  To-Dos ({stage.todos.length}) & Packliste ({stage.packingItems.length})
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              {/* To-Dos */}
              <div className="space-y-2">
                <label className="text-xs font-medium flex items-center gap-1">
                  <ListTodo className="w-3 h-3" />
                  To-Dos für diese Stufe
                </label>
                {stage.todos.map((todo, todoIdx) => (
                  <div key={todoIdx} className="flex items-center gap-2">
                    <span className="flex-1 text-sm p-2 bg-muted rounded">{todo.text}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => onRemoveTodo(todoIdx)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Neues To-Do..."
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
                    className="text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={handleAddTodo}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Packing Items */}
              <div className="space-y-2">
                <label className="text-xs font-medium flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  Packliste für diese Stufe
                </label>
                {stage.packingItems.map((item, itemIdx) => (
                  <div key={itemIdx} className="flex items-center gap-2">
                    <span className="flex-1 text-sm p-2 bg-muted rounded">{item.text}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => onRemovePackingItem(itemIdx)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Neuer Eintrag..."
                    value={newPackingItem}
                    onChange={(e) => setNewPackingItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddPackingItem()}
                    className="text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={handleAddPackingItem}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        {totalStages > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  );
};
