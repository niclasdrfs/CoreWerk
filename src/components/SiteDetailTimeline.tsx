import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface TimelineStage {
  id: string;
  name: string;
  description?: string;
  isCompleted?: boolean;
  isCurrent?: boolean;
}

interface SiteDetailTimelineProps {
  stages: TimelineStage[];
  className?: string;
}

/**
 * Detailed vertical timeline for the construction site detail page.
 * Shows all stages with a gradient from red (top) to green (bottom).
 */
export const SiteDetailTimeline = ({
  stages,
  className,
}: SiteDetailTimelineProps) => {
  const getStageColor = (index: number, total: number) => {
    const progress = index / (total - 1);
    
    if (progress < 0.33) {
      // Red to orange transition
      const localProgress = progress / 0.33;
      return `hsl(${0 + localProgress * 25}, ${72 + localProgress * 23}%, 51%)`;
    } else if (progress < 0.66) {
      // Orange to yellow-green transition  
      const localProgress = (progress - 0.33) / 0.33;
      return `hsl(${25 + localProgress * 60}, ${95 - localProgress * 10}%, ${53 - localProgress * 5}%)`;
    } else {
      // Yellow-green to green transition
      const localProgress = (progress - 0.66) / 0.34;
      return `hsl(${85 + localProgress * 57}, ${85 - localProgress * 14}%, ${48 - localProgress * 3}%)`;
    }
  };

  const currentIndex = stages.findIndex(s => s.isCurrent);
  const effectiveCurrentIndex = currentIndex === -1 
    ? stages.filter(s => s.isCompleted).length 
    : currentIndex;

  return (
    <div className={cn("relative", className)}>
      {stages.map((stage, index) => {
        const isCompleted = stage.isCompleted || index < effectiveCurrentIndex;
        const isCurrent = stage.isCurrent || index === effectiveCurrentIndex;
        const isPending = !isCompleted && !isCurrent;
        const stageColor = getStageColor(index, stages.length);
        const isLast = index === stages.length - 1;

        return (
          <div key={stage.id} className="relative flex gap-6">
            {/* Left side - for future info */}
            <div className="hidden md:flex flex-1 justify-end pr-6">
              {/* Placeholder for left-side info */}
              <div className="text-right max-w-xs">
                {/* Info will be added here later */}
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
                  "relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                  isCompleted && "shadow-lg",
                  isCurrent && "ring-4 ring-offset-2 ring-offset-background shadow-lg",
                  isPending && "bg-muted border-2 border-muted-foreground/30"
                )}
                style={{ 
                  backgroundColor: !isPending ? stageColor : undefined,
                  ...(isCurrent && { "--tw-ring-color": stageColor } as React.CSSProperties),
                }}
              >
                {isCompleted ? (
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
                {stage.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {stage.description}
                  </p>
                )}
                
                {/* Placeholder for additional info */}
                <div className="mt-4">
                  {/* Info cards will be added here later */}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Default stages for construction sites - will be customizable later
export const DEFAULT_CONSTRUCTION_STAGES: TimelineStage[] = [
  { id: "planning", name: "Planung", description: "Projektplanung und Vorbereitung" },
  { id: "preparation", name: "Vorbereitung", description: "Materialbestellung und Bauvorbereitung" },
  { id: "foundation", name: "Grundarbeiten", description: "Fundamentarbeiten und Rohbau" },
  { id: "construction", name: "Bauphase", description: "Hauptbauarbeiten" },
  { id: "finishing", name: "Fertigstellung", description: "Feinarbeiten und Endkontrolle" },
  { id: "handover", name: "Übergabe", description: "Projektabschluss und Übergabe" },
];
