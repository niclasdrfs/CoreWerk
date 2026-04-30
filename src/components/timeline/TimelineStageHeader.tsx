import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Layers, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  isCompleted: boolean;
}

interface TimelineStageHeaderProps {
  stages: Stage[];
  currentStageIndex: number;
  hasTemplateItems?: boolean;
  onImportClick?: () => void;
}

export const TimelineStageHeader = ({ 
  stages, 
  currentStageIndex,
  hasTemplateItems,
  onImportClick,
}: TimelineStageHeaderProps) => {
  const currentStage = useMemo(() => {
    // Find the first uncompleted stage, or the last stage if all are done
    const firstIncomplete = stages.find(s => !s.isCompleted);
    if (firstIncomplete) return firstIncomplete;
    return stages[stages.length - 1];
  }, [stages]);

  const completedCount = stages.filter(s => s.isCompleted).length;
  const allCompleted = completedCount === stages.length;

  if (!currentStage || stages.length === 0) return null;

  // Generate gradient based on progress (matching TimelineMiniProgress)
  const percentage = (completedCount / stages.length) * 100;
  const getGradient = () => {
    if (percentage === 0) return "bg-muted";
    if (percentage === 100) return "bg-gradient-to-r from-green-500 to-green-400";
    if (percentage < 33) return "bg-gradient-to-r from-red-500 to-orange-500";
    if (percentage < 66) return "bg-gradient-to-r from-orange-500 to-yellow-500";
    return "bg-gradient-to-r from-yellow-500 to-green-500";
  };

  return (
    <div className="rounded-lg border border-accent/50 mb-4 overflow-hidden">
      {/* Progress bar at the top */}
      <div className="w-full h-1.5 bg-muted">
        <div
          className={cn("h-full transition-all duration-300", getGradient())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex items-center gap-3 p-3 bg-accent/30">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
          <Layers className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {allCompleted ? "Abgeschlossen" : "Aktueller Schritt"}
          </p>
          <p className="font-semibold text-foreground truncate">
            {currentStage.name}
          </p>
        </div>
        
        {/* Import button for template items */}
        {hasTemplateItems && onImportClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onImportClick}
            className="gap-1.5 shrink-0"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">Vorlagen</span>
          </Button>
        )}
      </div>
    </div>
  );
};
