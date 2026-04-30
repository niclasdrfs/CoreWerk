import { useQuery } from "@tanstack/react-query";
import { useTabNavigate } from "@/hooks/useTabNavigate";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, Calendar, CheckCircle, ChevronRight, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface CustomerHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}

interface ConstructionSite {
  id: string;
  customer_last_name: string;
  address: string | null;
  status: string;
  created_at: string;
  start_date: string | null;
  end_date: string | null;
  color: string | null;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  active: { 
    label: "Aktiv", 
    icon: <Clock className="w-3 h-3" />, 
    color: "bg-green-500" 
  },
  future: { 
    label: "Ausstehend", 
    icon: <Calendar className="w-3 h-3" />, 
    color: "bg-amber-500" 
  },
  archived: { 
    label: "Abgeschlossen", 
    icon: <CheckCircle className="w-3 h-3" />, 
    color: "bg-muted-foreground" 
  },
};

export const CustomerHistoryDialog = ({
  open,
  onOpenChange,
  customerId,
  customerName,
}: CustomerHistoryDialogProps) => {
  const navigate = useTabNavigate();
  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["customer-history", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_sites")
        .select("id, customer_last_name, address, status, created_at, start_date, end_date, color")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ConstructionSite[];
    },
    enabled: open && !!customerId,
  });

  // Sort sites by date (most recent first)
  const sortedSites = [...sites].sort((a, b) => {
    const dateA = a.start_date || a.created_at;
    const dateB = b.start_date || b.created_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const handleSiteClick = (siteId: string) => {
    onOpenChange(false);
    navigate(`/owner/site/${siteId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Kunden-Historie: {customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : sortedSites.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Keine Baustellen für diesen Kunden gefunden.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

              {/* Timeline items */}
              <div className="space-y-4">
                {sortedSites.map((site, index) => {
                  const config = statusConfig[site.status] || statusConfig.active;
                  const displayDate = site.start_date || site.created_at;
                  
                  return (
                    <div key={site.id} className="relative pl-10">
                      {/* Timeline dot */}
                      <div 
                        className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 border-background ${config.color}`}
                        style={site.color ? { backgroundColor: site.color } : undefined}
                      />

                      {/* Content card */}
                      <button
                        onClick={() => handleSiteClick(site.id)}
                        className="w-full text-left p-4 rounded-lg border bg-card hover:bg-accent/10 hover:border-accent/30 transition-colors group/card"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium text-foreground group-hover/card:text-primary transition-colors">
                            {site.customer_last_name}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="secondary" 
                              className="shrink-0 gap-1 text-xs"
                            >
                              {config.icon}
                              {config.label}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/card:text-primary transition-colors" />
                          </div>
                        </div>

                        {site.address && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{site.address}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {format(new Date(displayDate), "dd. MMMM yyyy", { locale: de })}
                            {site.end_date && site.status === "archived" && (
                              <> – {format(new Date(site.end_date), "dd. MMMM yyyy", { locale: de })}</>
                            )}
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        {sortedSites.length > 0 && (
          <div className="pt-4 border-t mt-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Gesamt: {sortedSites.length} Baustelle{sortedSites.length !== 1 ? "n" : ""}</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {sortedSites.filter(s => s.status === "active").length} aktiv
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  {sortedSites.filter(s => s.status === "future").length} ausstehend
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  {sortedSites.filter(s => s.status === "archived").length} archiviert
                </span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
