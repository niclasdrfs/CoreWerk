import { Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PendingIndicatorProps {
  className?: string;
}

export function PendingIndicator({ className }: PendingIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Clock className={`h-3.5 w-3.5 text-muted-foreground animate-pulse ${className || ""}`} />
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>Wird gesendet sobald Internet verfügbar</p>
      </TooltipContent>
    </Tooltip>
  );
}
