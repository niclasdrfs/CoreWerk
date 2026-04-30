import { cn } from "@/lib/utils";
import { Check, Circle, Loader2 } from "lucide-react";
import { SiteTimelineStage } from "@/hooks/useTimelineData";
import { StageActionButtons } from "./StageActionButtons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CompletedByInfo {
  [stageId: string]: {
    name: string | null;
    completedAt: string | null;
  };
}

interface InteractiveSiteDetailTimelineProps {
  stages: SiteTimelineStage[];
  currentStageIndex: number;
  siteId: string;
  onToggleComplete?: (stageId: string, isCompleted: boolean) => void;
  isUpdating?: boolean;
  className?: string;
  showCompletedBy?: boolean;
  basePath?: string;
}

export const InteractiveSiteDetailTimeline = ({
  stages,
  currentStageIndex,
  siteId,
  onToggleComplete,
  isUpdating,
  className,
  showCompletedBy = false,
  basePath = "/owner",
}: InteractiveSiteDetailTimelineProps) => {
  // Fetch completed_by profile information when showCompletedBy is true
  const { data: completedByInfo = {} } = useQuery<CompletedByInfo>({
    queryKey: ["stage-completed-by", siteId, stages.map(s => s.id).join(",")],
    queryFn: async () => {
      const completedStages = stages.filter(s => s.completedBy);
      if (completedStages.length === 0) return {};

      const userIds = [...new Set(completedStages.map(s => s.completedBy).filter(Boolean))];
      
      const { data: profiles } = await supabase
        .from("profiles_limited" as any)
        .select("id, full_name")
        .in("id", userIds);

      const typedProfiles = (profiles || []) as unknown as { id: string; full_name: string | null }[];
      const profileMap = new Map(typedProfiles.map(p => [p.id, p.full_name]));
      
      const result: CompletedByInfo = {};
      completedStages.forEach(stage => {
        if (stage.completedBy) {
          result[stage.id] = {
            name: profileMap.get(stage.completedBy) || null,
            completedAt: stage.completedAt,
          };
        }
      });
      
      return result;
    },
    enabled: showCompletedBy && stages.some(s => s.completedBy),
  });
  const getStageColor = (index: number, total: number) => {
    const progress = index / (total - 1);
    
    if (progress < 0.33) {
      const localProgress = progress / 0.33;
      return `hsl(${0 + localProgress * 25}, ${72 + localProgress * 23}%, 51%)`;
    } else if (progress < 0.66) {
      const localProgress = (progress - 0.33) / 0.33;
      return `hsl(${25 + localProgress * 60}, ${95 - localProgress * 10}%, ${53 - localProgress * 5}%)`;
    } else {
      const localProgress = (progress - 0.66) / 0.34;
      return `hsl(${85 + localProgress * 57}, ${85 - localProgress * 14}%, ${48 - localProgress * 3}%)`;
    }
  };

  if (!stages.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Kein Zeitstrahl für diese Baustelle konfiguriert.</p>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {stages.map((stage, index) => {
        const isCompleted = stage.isCompleted;
        const isCurrent = index === currentStageIndex && !isCompleted;
        const isPending = !isCompleted && index > currentStageIndex;
        const stageColor = getStageColor(index, stages.length);
        const isLast = index === stages.length - 1;

        return (
          <div key={stage.id} className="relative flex gap-6">
            {/* Left side - for future info */}
            <div className="hidden md:flex flex-1 justify-end pr-6">
              <div className="text-right max-w-xs">
                {stage.completedAt && (
                  <p className="text-sm text-muted-foreground">
                    {new Date(stage.completedAt).toLocaleDateString("de-DE")}
                  </p>
                )}
              </div>
            </div>

            {/* Timeline line and node */}
            <div className="relative flex flex-col items-center">
              {/* Connecting line */}
              {!isLast && (
                <div 
                  className={cn(
                    "absolute top-8 w-1 transition-colors duration-300",
                    isCompleted ? "" : "opacity-30"
                  )}
                  style={{ 
                    height: "calc(100% - 2rem)",
                    background: isCompleted 
                      ? `linear-gradient(to bottom, ${stageColor}, ${getStageColor(index + 1, stages.length)})`
                      : "hsl(var(--muted-foreground) / 0.3)",
                  }}
                />
              )}
              
              {/* Node */}
              <div 
                className={cn(
                  "relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 cursor-pointer",
                  isCompleted && "shadow-lg",
                  isCurrent && "ring-4 ring-offset-2 ring-offset-background shadow-lg",
                  isPending && "bg-muted border-2 border-muted-foreground/30"
                )}
                style={{ 
                  backgroundColor: !isPending ? stageColor : undefined,
                  ...(isCurrent && { "--tw-ring-color": stageColor } as React.CSSProperties),
                }}
                onClick={() => onToggleComplete?.(stage.id, !isCompleted)}
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : isCompleted ? (
                  <Check className="w-4 h-4 text-white" />
                ) : isCurrent ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                )}
              </div>
            </div>

            {/* Right side - stage info */}
            <div className="flex-1 pb-12 pl-2">
              <div 
                className={cn(
                  "transition-opacity duration-300",
                  isPending && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <h3 
                    className={cn(
                      "font-semibold text-lg",
                      isCurrent && "text-foreground",
                      isCompleted && "text-foreground",
                      isPending && "text-muted-foreground"
                    )}
                  >
                    {stage.name}
                  </h3>
                  {onToggleComplete && (
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={(checked) => 
                        onToggleComplete(stage.id, checked === true)
                      }
                      className="h-5 w-5"
                    />
                  )}
                </div>
                {stage.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {stage.description}
                  </p>
                )}
                
                {/* Completed by info */}
                {showCompletedBy && isCompleted && completedByInfo[stage.id] && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Abgehakt von {completedByInfo[stage.id].name || "Unbekannt"} 
                    {completedByInfo[stage.id].completedAt && (
                      <> am {new Date(completedByInfo[stage.id].completedAt!).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit", 
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}</>
                    )}
                  </p>
                )}
                
                {/* Stage Action Buttons */}
                <StageActionButtons 
                  stageId={stage.id} 
                  siteId={siteId}
                  stageName={stage.name}
                  basePath={basePath}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
