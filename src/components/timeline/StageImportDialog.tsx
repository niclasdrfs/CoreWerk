import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ListTodo, Package, Loader2 } from "lucide-react";

interface StageImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName: string;
  todos: Array<{ id: string; text: string }>;
  packingItems: Array<{ id: string; text: string }>;
  onConfirm: (importTodos: boolean, importPacking: boolean) => Promise<void>;
  isLoading?: boolean;
}

export const StageImportDialog = ({
  open,
  onOpenChange,
  stageName,
  todos,
  packingItems,
  onConfirm,
  isLoading,
}: StageImportDialogProps) => {
  const [importTodos, setImportTodos] = useState(true);
  const [importPacking, setImportPacking] = useState(true);

  const handleConfirm = async () => {
    await onConfirm(importTodos, importPacking);
    onOpenChange(false);
  };

  const hasTodos = todos.length > 0;
  const hasPacking = packingItems.length > 0;

  if (!hasTodos && !hasPacking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vorlagen übernehmen?</DialogTitle>
          <DialogDescription>
            Für die Stufe "{stageName}" sind Vorlagen hinterlegt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasTodos && (
            <div 
              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setImportTodos(!importTodos)}
            >
              <Checkbox
                checked={importTodos}
                onCheckedChange={(checked) => setImportTodos(checked === true)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <ListTodo className="w-4 h-4 text-primary" />
                  {todos.length} To-Do{todos.length !== 1 ? 's' : ''}
                </div>
                <ul className="mt-1 text-sm text-muted-foreground space-y-0.5">
                  {todos.slice(0, 3).map((todo) => (
                    <li key={todo.id}>• {todo.text}</li>
                  ))}
                  {todos.length > 3 && (
                    <li className="text-xs italic">... und {todos.length - 3} weitere</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {hasPacking && (
            <div 
              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setImportPacking(!importPacking)}
            >
              <Checkbox
                checked={importPacking}
                onCheckedChange={(checked) => setImportPacking(checked === true)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <Package className="w-4 h-4 text-primary" />
                  {packingItems.length} Packlisten-Eintrag{packingItems.length !== 1 ? 'e' : ''}
                </div>
                <ul className="mt-1 text-sm text-muted-foreground space-y-0.5">
                  {packingItems.slice(0, 3).map((item) => (
                    <li key={item.id}>• {item.text}</li>
                  ))}
                  {packingItems.length > 3 && (
                    <li className="text-xs italic">... und {packingItems.length - 3} weitere</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Überspringen
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || (!importTodos && !importPacking)}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Wird importiert...
              </>
            ) : (
              "Übernehmen"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};