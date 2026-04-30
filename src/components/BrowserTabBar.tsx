import { useState, useRef, useCallback } from "react";
import { X, Plus, Columns2, ExternalLink } from "lucide-react";
import { useBrowserTabs } from "@/contexts/BrowserTabsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function BrowserTabBar({ basePath }: { basePath: string }) {
  const isMobile = useIsMobile();
  const { tabs, activeTabId, splitTabId, openTab, closeTab, switchTab, splitTab, unsplit } = useBrowserTabs();
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [showDropZone, setShowDropZone] = useState(false);
  const dragStartY = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    // Don't allow dragging the active tab into split (it's already showing)
    if (tabId === activeTabId && !splitTabId) return;
    setDraggingTabId(tabId);
    dragStartY.current = e.clientY;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tabId);
  }, [activeTabId, splitTabId]);

  const handleDragEnd = useCallback(() => {
    setDraggingTabId(null);
    setShowDropZone(false);
  }, []);

  if (isMobile) return null;

  return (
    <>
      <div
        ref={barRef}
        className="flex items-end bg-muted/30 border-b border-border px-1 pt-1 select-none overflow-x-auto"
        style={{ minHeight: 38 }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isSplit = tab.id === splitTabId;
          const isDragging = tab.id === draggingTabId;
          return (
            <div
              key={tab.id}
              draggable={tabs.length > 1}
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragEnd={handleDragEnd}
              onClick={() => switchTab(tab.id)}
              className={cn(
                "group relative flex items-center gap-1 px-3 py-1.5 text-sm cursor-pointer transition-colors max-w-[220px] min-w-[100px]",
                "rounded-t-md border border-b-0",
                isDragging && "opacity-40",
                isActive
                  ? "bg-background border-border text-foreground shadow-sm z-10 -mb-px"
                  : isSplit
                  ? "bg-accent/50 border-border/50 text-foreground z-10 -mb-px"
                  : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <span className="truncate flex-1 text-xs font-medium">{tab.title}</span>
              <div className="flex items-center gap-0.5 shrink-0">
                {isSplit ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); unsplit(); }}
                    className="rounded-sm p-0.5 transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                    title="Split-Ansicht beenden"
                  >
                    <Columns2 className="h-3 w-3" />
                  </button>
                ) : !isActive && !splitTabId ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); splitTab(tab.id); }}
                    className={cn(
                      "rounded-sm p-0.5 transition-colors hover:bg-accent text-muted-foreground hover:text-foreground",
                      "opacity-0 group-hover:opacity-100"
                    )}
                    title="Neben aktivem Tab anzeigen"
                  >
                    <Columns2 className="h-3 w-3" />
                  </button>
                ) : null}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const fullPath = tab.path.startsWith(basePath)
                      ? tab.path
                      : basePath + (tab.path === "/" ? "" : tab.path);
                    window.open(fullPath, "_blank");
                  }}
                  className={cn(
                    "rounded-sm p-0.5 transition-colors hover:bg-accent text-muted-foreground hover:text-foreground",
                    isActive ? "" : "opacity-0 group-hover:opacity-100"
                  )}
                  title="In neuem Fenster öffnen"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    className={cn(
                      "rounded-sm p-0.5 transition-colors",
                      isActive
                        ? "hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                        : "opacity-0 group-hover:opacity-100 hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <button
          onClick={() => openTab(basePath)}
          className="flex items-center justify-center h-7 w-7 ml-0.5 mb-0.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          title="Neuer Tab"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Drop zone overlay — appears when dragging a tab downward */}
      {draggingTabId && (
        <SplitDropZone
          tabId={draggingTabId}
          activeTabId={activeTabId}
          splitTab={splitTab}
          onDone={() => { setDraggingTabId(null); setShowDropZone(false); }}
        />
      )}
    </>
  );
}

/** Full-area drop zone that appears when a tab is being dragged */
function SplitDropZone({
  tabId,
  activeTabId,
  splitTab,
  onDone,
}: {
  tabId: string;
  activeTabId: string | null;
  splitTab: (id: string) => void;
  onDone: () => void;
}) {
  const [over, setOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedTabId = e.dataTransfer.getData("text/plain");
    if (droppedTabId && droppedTabId !== activeTabId) {
      splitTab(droppedTabId);
    }
    onDone();
  }, [activeTabId, splitTab, onDone]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "absolute inset-0 top-[38px] z-50 flex items-center justify-center transition-all duration-200 pointer-events-auto",
        over
          ? "bg-primary/10 border-2 border-dashed border-primary/40"
          : "bg-transparent"
      )}
    >
      {over && (
        <div className="bg-background/90 backdrop-blur-sm border border-border rounded-lg px-6 py-4 shadow-lg flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
          <Columns2 className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-foreground">Split-Ansicht öffnen</span>
        </div>
      )}
    </div>
  );
}
