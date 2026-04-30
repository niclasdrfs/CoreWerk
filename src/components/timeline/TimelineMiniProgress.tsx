import { cn } from "@/lib/utils";

interface TimelineMiniProgressProps {
  completedStages: number;
  totalStages: number;
  className?: string;
}

export const TimelineMiniProgress = ({
  completedStages,
  totalStages,
  className,
}: TimelineMiniProgressProps) => {
  if (totalStages === 0) return null;

  const getSegmentColor = (index: number) => {
    if (index >= completedStages) return "bg-muted";
    const percentage = (completedStages / totalStages) * 100;
    if (percentage === 100) return "bg-green-500";
    if (percentage < 33) return "bg-orange-500";
    if (percentage < 66) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className={cn("flex items-center gap-1.5 w-full", className)}>
      <div className="flex-1 flex gap-0.5">
        {Array.from({ length: totalStages }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 flex-1 rounded-sm transition-all duration-300",
              getSegmentColor(i)
            )}
          />
        ))}
      </div>
    </div>
  );
};
