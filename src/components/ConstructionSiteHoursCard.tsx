import { useState, lazy, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { MapPin, ChevronRight, Pencil } from "lucide-react";
import { SiteCategoryDropdown } from "./SiteCategoryDropdown";
import { useTabNavigate } from "@/hooks/useTabNavigate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteProgressTimeline } from "./SiteProgressTimeline";
import type { BatchTimelineData } from "@/hooks/useTimelineData";

// Lazy load the edit dialog to reduce initial bundle size
const ConstructionSiteEditDialog = lazy(() =>
  import("./ConstructionSiteEditDialog").then((m) => ({
    default: m.ConstructionSiteEditDialog,
  }))
);

interface EmployeeHours {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  totalHours: number;
  assignmentCount: number;
  hourlyWage: number | null;
  calculatedWage: number | null;
}

interface ConstructionSiteHoursCardProps {
  siteName: string;
  siteColor: string | null;
  employees: EmployeeHours[];
  totalHours: number;
  siteId?: string;
  onArchive?: (siteId: string) => void;
  onActivate?: (siteId: string) => void;
  onDelete?: (siteId: string) => void;
  isArchived?: boolean;
  isPending?: boolean;
  categoryId?: string | null;
  categoryName?: string | null;
  address?: string | null;
  phone?: string | null;
  notes?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  // New: Timeline data passed from parent (batch query)
  timelineData?: BatchTimelineData;
}

export const ConstructionSiteHoursCard = ({
  siteName,
  siteColor,
  siteId,
  isArchived = false,
  isPending = false,
  categoryId,
  categoryName,
  address,
  phone,
  notes,
  startDate,
  endDate,
  status,
  timelineData,
}: ConstructionSiteHoursCardProps) => {
  const navigate = useTabNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleClick = () => {
    if (siteId) {
      navigate(`/owner/site/${siteId}`);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditDialogOpen(true);
  };

  const handleCategoryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const siteData = siteId
    ? {
        id: siteId,
        customer_last_name: siteName,
        address: address || null,
        customer_phone: phone || null,
        color: siteColor,
        status:
          status || (isArchived ? "archived" : isPending ? "future" : "active"),
        notes: notes || null,
        start_date: startDate || null,
        end_date: endDate || null,
        category_id: categoryId || null,
      }
    : null;

  return (
    <>
      <Card
        className="p-4 cursor-pointer hover:bg-accent/5 transition-colors group"
        onClick={handleClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: siteColor
                  ? `${siteColor}20`
                  : "hsl(var(--primary) / 0.1)",
              }}
            >
              <MapPin
                className="w-5 h-5"
                style={{ color: siteColor || "hsl(var(--primary))" }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate">
                  {siteName}
                </h3>
                {siteId && (
                  <div onClick={handleCategoryClick}>
                    <SiteCategoryDropdown
                      siteId={siteId}
                      currentCategoryId={categoryId || null}
                      currentCategoryName={categoryName}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {isPending && (
                  <Badge variant="secondary" className="text-xs">
                    Ausstehend
                  </Badge>
                )}
                {isArchived && (
                  <Badge variant="outline" className="text-xs">
                    Archiviert
                  </Badge>
                )}
              </div>

            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleEditClick}
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </Button>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </div>
      </Card>

      {editDialogOpen && siteData && (
        <Suspense fallback={null}>
          <ConstructionSiteEditDialog
            site={siteData}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            mode="edit"
          />
        </Suspense>
      )}
    </>
  );
};
