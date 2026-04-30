import { cn } from "@/lib/utils";

interface SiteProgressTimelineProps {
  /** Progress value from 0 to 100 */
  progress?: number;
  /** Current stage index (0-based) */
  currentStage?: number;
  /** Total number of stages */
  totalStages?: number;
  className?: string;
}

/**
 * Compact horizontal timeline for construction site cards.
 * Shows a gradient from red (start) to orange (middle) to green (end).
 */
export const SiteProgressTimeline = ({
  progress = 0,
  currentStage,
  totalStages = 5,
  className,
}: SiteProgressTimelineProps) => {
  // Calculate progress from stage if provided
  const calculatedProgress = currentStage !== undefined 
    ? ((currentStage + 1) / totalStages) * 100 
    : progress;

  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(100, Math.max(0, calculatedProgress));

  return (
    <div className={cn("w-full", className)}>
      {/* Timeline bar */}
      <div className="relative h-2 rounded-full overflow-hidden bg-muted">
        {/* Gradient background */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(to right, hsl(0, 72%, 51%), hsl(25, 95%, 53%), hsl(142, 71%, 45%))",
          }}
        />
        
        {/* Cover for unfilled portion */}
        <div 
          className="absolute top-0 right-0 h-full bg-muted transition-all duration-500 ease-out"
          style={{ width: `${100 - clampedProgress}%` }}
        />
        
        {/* Progress marker */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-background border-2 shadow-md transition-all duration-500 ease-out"
          style={{ 
            left: `calc(${clampedProgress}% - 7px)`,
            borderColor: clampedProgress < 33 
              ? "hsl(0, 72%, 51%)" 
              : clampedProgress < 66 
                ? "hsl(25, 95%, 53%)" 
                : "hsl(142, 71%, 45%)",
          }}
        />
      </div>
    </div>
  );
};
