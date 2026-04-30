import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BarChart3, Euro, Clock, Package, TrendingUp, MapPin } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const formatHours = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

interface SiteInsight {
  siteId: string;
  siteName: string;
  status: string;
  categoryName: string | null;
  totalHours: number;
  laborCost: number;
  materialEk: number;
  materialVk: number;
  totalIstKosten: number;
  materialMargin: number;
  productCount: number;
}

const AccountingInsightsView = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["owner-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: insights, isLoading } = useQuery({
    queryKey: ["accounting-insights", profile?.company_id],
    queryFn: async (): Promise<SiteInsight[]> => {
      if (!profile?.company_id) return [];

      // Fetch sites
      const { data: sites } = await supabase
        .from("construction_sites")
        .select("id, customer_last_name, status, category_id, construction_site_categories(name)")
        .eq("company_id", profile.company_id)
        .in("status", ["active", "archived"]);

      if (!sites?.length) return [];

      // Fetch all site products
      const { data: allProducts } = await supabase
        .from("construction_site_products")
        .select("*")
        .eq("company_id", profile.company_id);

      // Fetch hours data
      const siteIds = sites.map((s) => s.id);
      const { data: assignments } = await supabase
        .from("daily_assignments")
        .select("id, construction_site_id, start_time, end_time")
        .in("construction_site_id", siteIds);

      const assignmentIds = assignments?.map((a) => a.id) || [];
      const { data: empAssignments } = await supabase
        .from("employee_assignments")
        .select("employee_id, daily_assignment_id")
        .in("daily_assignment_id", assignmentIds.length > 0 ? assignmentIds : ["none"]);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, hourly_wage, calculated_hourly_wage")
        .eq("company_id", profile.company_id);

      const wageMap = new Map(
        profiles?.map((p) => [p.id, p.calculated_hourly_wage || p.hourly_wage || 0]) || []
      );

      // Calculate per-site hours & labor cost
      const siteHoursMap = new Map<string, number>();
      const siteLaborMap = new Map<string, number>();

      empAssignments?.forEach((ea) => {
        const a = assignments?.find((x) => x.id === ea.daily_assignment_id);
        if (!a) return;
        const sp = a.start_time?.split(":").map(Number) || [8, 0];
        const ep = a.end_time?.split(":").map(Number) || [17, 0];
        const hrs = ep[0] - sp[0] + (ep[1] - sp[1]) / 60;
        const sid = a.construction_site_id;
        siteHoursMap.set(sid, (siteHoursMap.get(sid) || 0) + hrs);
        const w = wageMap.get(ea.employee_id) || 0;
        siteLaborMap.set(sid, (siteLaborMap.get(sid) || 0) + hrs * w);
      });

      return sites.map((site) => {
        const prods = allProducts?.filter((p) => p.construction_site_id === site.id) || [];
        const materialEk = prods.reduce((s, p: any) => s + p.ek_price * p.quantity, 0);
        const materialVk = prods.reduce((s, p: any) => s + p.vk_price * p.quantity, 0);
        const laborCost = siteLaborMap.get(site.id) || 0;
        const cat = site.construction_site_categories as { name: string } | null;

        return {
          siteId: site.id,
          siteName: site.customer_last_name,
          status: site.status,
          categoryName: cat?.name || null,
          totalHours: siteHoursMap.get(site.id) || 0,
          laborCost,
          materialEk,
          materialVk,
          totalIstKosten: laborCost + materialEk,
          materialMargin: materialVk - materialEk,
          productCount: prods.length,
        };
      })
        .filter((s) => s.totalHours > 0 || s.productCount > 0)
        .sort((a, b) => b.totalIstKosten - a.totalIstKosten);
    },
    enabled: !!profile?.company_id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!insights?.length) {
    return (
      <Card className="p-8 text-center">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <h3 className="text-lg font-semibold mb-1">Noch keine Daten</h3>
        <p className="text-sm text-muted-foreground">
          Sobald Baustellen Stunden oder Produkte haben, erscheinen hier die Ist-Kosten.
        </p>
      </Card>
    );
  }

  const totalLabor = insights.reduce((s, i) => s + i.laborCost, 0);
  const totalMatEk = insights.reduce((s, i) => s + i.materialEk, 0);
  const totalMatVk = insights.reduce((s, i) => s + i.materialVk, 0);
  const totalIst = insights.reduce((s, i) => s + i.totalIstKosten, 0);
  const totalMargin = insights.reduce((s, i) => s + i.materialMargin, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Ist-Kosten Insights</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tatsächliche Kosten pro Baustelle — Lohn + Material ohne Aufschlag
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase">Lohnkosten ges.</span>
          </div>
          <p className="text-xl font-bold">{fmt(totalLabor)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Package className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase">Material EK ges.</span>
          </div>
          <p className="text-xl font-bold">{fmt(totalMatEk)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Euro className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase">Ist-Kosten ges.</span>
          </div>
          <p className="text-xl font-bold">{fmt(totalIst)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase">Material-Marge</span>
          </div>
          <p className={`text-xl font-bold ${totalMargin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {fmt(totalMargin)}
          </p>
        </Card>
      </div>

      {/* Per-site breakdown */}
      <Accordion type="multiple" className="space-y-2">
        {insights.map((site) => (
          <AccordionItem key={site.siteId} value={site.siteId} className="border rounded-xl overflow-hidden">
            <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30">
              <div className="flex items-center justify-between w-full pr-2">
                <div className="flex items-center gap-3 text-left">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <span className="font-semibold">{site.siteName}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {site.categoryName && (
                        <Badge variant="outline" className="text-[10px] h-4">{site.categoryName}</Badge>
                      )}
                      <Badge variant={site.status === "archived" ? "secondary" : "default"} className="text-[10px] h-4">
                        {site.status === "archived" ? "Abgeschlossen" : "Aktiv"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <span className="font-bold text-foreground">{fmt(site.totalIstKosten)}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lohnkosten ({formatHours(site.totalHours)})</span>
                  <span className="font-medium">{fmt(site.laborCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Material EK ({site.productCount} Pos.)</span>
                  <span className="font-medium">{fmt(site.materialEk)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-medium">
                  <span>Ist-Kosten</span>
                  <span>{fmt(site.totalIstKosten)}</span>
                </div>
                {site.materialVk > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Material VK</span>
                    <span>{fmt(site.materialVk)}</span>
                  </div>
                )}
                {site.materialMargin !== 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Material-Marge</span>
                    <span className={site.materialMargin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                      {fmt(site.materialMargin)}
                    </span>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default AccountingInsightsView;
