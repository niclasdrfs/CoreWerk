import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Palette } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AppearanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AppearanceDialog = ({ open, onOpenChange }: AppearanceDialogProps) => {
  const { theme, setTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Erscheinungsbild
          </DialogTitle>
          <DialogDescription>Wählen Sie Ihr bevorzugtes Design</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(value) => {
              if (value) setTheme(value);
            }}
            className="flex flex-col gap-2 w-full"
          >
            <ToggleGroupItem 
              value="light" 
              aria-label="Hell" 
              className="w-full justify-start gap-3 px-4 py-3 h-auto"
            >
              <Sun className="w-5 h-5" />
              <div className="text-left">
                <p className="font-medium">Hell</p>
                <p className="text-xs text-muted-foreground">Helles Farbschema</p>
              </div>
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="dark" 
              aria-label="Dunkel" 
              className="w-full justify-start gap-3 px-4 py-3 h-auto"
            >
              <Moon className="w-5 h-5" />
              <div className="text-left">
                <p className="font-medium">Dunkel</p>
                <p className="text-xs text-muted-foreground">Dunkles Farbschema</p>
              </div>
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="system" 
              aria-label="System" 
              className="w-full justify-start gap-3 px-4 py-3 h-auto"
            >
              <Monitor className="w-5 h-5" />
              <div className="text-left">
                <p className="font-medium">System</p>
                <p className="text-xs text-muted-foreground">Automatisch an Gerät anpassen</p>
              </div>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </DialogContent>
    </Dialog>
  );
};
