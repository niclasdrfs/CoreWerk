import { Mic, MicOff, Loader2, Volume2, Radio } from "lucide-react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const VoiceAssistantButton = () => {
  const { user } = useAuth();
  const { state, transcript, response, toggle } = useVoiceAssistant();

  if (!user) return null;

  const icon = {
    idle: <Mic className="h-5 w-5" />,
    wakeword: <Radio className="h-5 w-5" />,
    listening: <MicOff className="h-5 w-5" />,
    processing: <Loader2 className="h-5 w-5 animate-spin" />,
    speaking: <Volume2 className="h-5 w-5" />,
  }[state];

  const showOverlay = state !== "idle" && state !== "wakeword" && (transcript || response);

  return (
    <>
      {/* Overlay */}
      {showOverlay && (
        <div className="fixed bottom-24 right-4 z-[60] w-72 rounded-lg border bg-popover p-3 shadow-lg text-popover-foreground animate-in fade-in slide-in-from-bottom-2">
          {transcript && (
            <p className="text-xs text-muted-foreground mb-1">
              <span className="font-medium">Du:</span> {transcript}
            </p>
          )}
          {response && (
            <p className="text-sm">
              <span className="font-medium">Assistent:</span> {response}
            </p>
          )}
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={toggle}
        className={cn(
          "fixed bottom-20 right-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          state === "wakeword" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          state === "listening" && "animate-pulse bg-destructive hover:bg-destructive/90",
          state === "processing" && "bg-muted text-muted-foreground",
          state === "speaking" && "bg-accent text-accent-foreground"
        )}
        aria-label="Sprachassistent"
      >
        {icon}
        {state === "wakeword" && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />
        )}
      </button>
    </>
  );
};
