import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BarChart3, Euro, TrendingUp, Package, Clock, Users } from "lucide-react";

interface ProjectInsightsCardProps {
  siteId: string;
  totalHours: number;
  totalLaborCost: number;
  employeeCount: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

export const ProjectInsightsCard = ({
  siteId,
  totalHours,
  totalLaborCost,
  employeeCount,
}: ProjectInsightsCardProps) => {
  const { data: siteProducts = [] } = useQuery({
    queryKey: ["site-products", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_site_products")
        .select("*")
        .eq("construction_site_id", siteId);
      if (error) throw error;
      return data || [];
    },
  });

  const materialEk = siteProducts.reduce((s, p: any) => s + p.ek_price * p.quantity, 0);
  const materialVk = siteProducts.reduce((s, p: any) => s + p.vk_price * p.quantity, 0);
  const materialMargin = materialVk - materialEk;

  const totalIstKosten = totalLaborCost + materialEk;
  const totalVk = materialVk + totalLaborCost; // labor is at cost for now
  const totalMargin = materialMargin;

  // Group by phase
  const phaseBreakdown = siteProducts.reduce((acc: Record<string, { ek: number; vk: number }>, p: any) => {
    const key = p.phase || "allgemein";
    if (!acc[key]) acc[key] = { ek: 0, vk: 0 };
    acc[key].ek += p.ek_price * p.quantity;
    acc[key].vk += p.vk_price * p.quantity;
    return acc;
  }, {});

  if (totalHours === 0 && siteProducts.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Projekt-Insights</h3>
      </div>

      <div className="space-y-4">
        {/* Overview Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase">Lohnkosten</span>
            </div>
            <p className="text-lg font-bold text-foreground">{fmt(totalLaborCost)}</p>
            <p className="text-[10px] text-muted-foreground">
              {Math.round(totalHours)}h × {employeeCount} MA
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Package className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase">Material EK</span>
            </div>
            <p className="text-lg font-bold text-foreground">{fmt(materialEk)}</p>
            <p className="text-[10px] text-muted-foreground">{siteProducts.length} Positionen</p>
          </div>
        </div>

        <Separator />

        {/* Ist-Kosten vs. VK */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kostenübersicht</h4>

          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Lohnkosten (Ist)</span>
            <span className="font-medium">{fmt(totalLaborCost)}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Material EK (Ist)</span>
            <span className="font-medium">{fmt(materialEk)}</span>
          </div>
          <div className="flex justify-between text-sm py-1 border-t border-border pt-2">
            <span className="font-medium text-foreground">Gesamte Ist-Kosten</span>
            <span className="font-bold text-foreground">{fmt(totalIstKosten)}</span>
          </div>

          {materialVk > 0 && (
            <>
              <div className="flex justify-between text-sm py-1 mt-2">
                <span className="text-muted-foreground">Material VK</span>
                <span className="font-medium">{fmt(materialVk)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-muted-foreground">Material-Marge</span>
                <span className={`font-medium ${materialMargin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                  {fmt(materialMargin)} ({materialEk > 0 ? ((materialMargin / materialEk) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </>
          )}
        </div>

        {/* Phase breakdown */}
        {Object.keys(phaseBreakdown).length > 1 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nach Phase</h4>
              {Object.entries(phaseBreakdown).map(([phase, costs]) => (
                <div key={phase} className="flex justify-between text-sm py-1">
                  <span className="text-muted-foreground capitalize">{phase}</span>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground/60">EK: {fmt(costs.ek)}</span>
                    <span className="font-medium">{fmt(costs.vk)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
