import { useState } from "react";
import { Folder, TrendingUp, Check, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface FolderCardProps {
  name: string;
  count: number;
  onClick: () => void;
  margin?: number | null;
  categoryMargin?: number;
  onMarginChange?: (margin: number | null) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  isPartiallySelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
}

const FolderCard = ({ name, count, onClick, margin, categoryMargin = 1, onMarginChange, selectionMode, isSelected, isPartiallySelected, onSelectionChange }: FolderCardProps) => {
  const [showMargin, setShowMargin] = useState(false);
  const [bufferedMargin, setBufferedMargin] = useState<string>(margin != null ? margin.toString() : "");

  return (
    <div className="flex items-center gap-2 py-2.5 px-3 cursor-pointer hover:bg-muted/40 transition-colors group">
      {selectionMode && (
        <Checkbox
          checked={isSelected ? true : isPartiallySelected ? "indeterminate" : false}
          onCheckedChange={(checked) => onSelectionChange?.(!!checked)}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        />
      )}
      <div
        className="flex items-center gap-2 flex-1 min-w-0"
        onClick={onClick}
      >
        <Folder className="w-4 h-4 text-primary shrink-0" />
        <span className="font-medium text-sm truncate">{name}</span>
        {margin != null && (
          <span className="text-[10px] text-muted-foreground shrink-0">x{margin}</span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{count}</span>
      </div>

      {onMarginChange && !selectionMode && (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {showMargin ? (
            <>
              <span className="text-xs text-muted-foreground">x</span>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={bufferedMargin}
                placeholder={categoryMargin.toString()}
                onChange={(e) => setBufferedMargin(e.target.value)}
                className="w-14 h-6 text-xs"
              />
              <Button
                variant="default"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => {
                  if (bufferedMargin === "") {
                    onMarginChange(null);
                  } else {
                    const num = parseFloat(bufferedMargin);
                    if (num > 0) onMarginChange(num);
                  }
                  setShowMargin(false);
                }}
              >
                <Check className="w-3 h-3" />
              </Button>
              {margin != null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-6 px-1"
                  onClick={() => {
                    onMarginChange(null);
                    setBufferedMargin("");
                    setShowMargin(false);
                  }}
                >
                  ×
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 gap-1 px-1.5"
              onClick={() => {
                setBufferedMargin(margin != null ? margin.toString() : "");
                setShowMargin(true);
              }}
            >
              <TrendingUp className="w-3 h-3" />
              {margin != null ? `x${margin}` : "Marge"}
            </Button>
          )}
        </div>
      )}

      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" onClick={onClick} />
    </div>
  );
};

export default FolderCard;
