import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SiteDataPoint {
  siteId: string;
  siteName: string;
  status: string;
  parameterValue: number;
  totalHours: number;
  hoursPerUnit: number;
  laborCost: number;
  materialEk: number;
  materialVk: number;
  totalCost: number;
  isOutlier: boolean;
}

interface ParameterStats {
  parameterId: string;
  parameterName: string;
  parameterUnit: string;
  dataPoints: SiteDataPoint[];
  weightedAvgHoursPerUnit: number;
  simpleAvgHoursPerUnit: number;
  medianHoursPerUnit: number;
  minHoursPerUnit: number;
  maxHoursPerUnit: number;
  confidence: "low" | "medium" | "high";
  totalDataPoints: number;
}

export interface CategoryExperience {
  categoryId: string;
  categoryName: string;
  parameters: ParameterStats[];
  avgHourlyRate: number;
}

function calculateWeightedAvg(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  // Most recent gets highest weight
  const totalWeight = values.reduce((sum, _, i) => sum + (i + 1), 0);
  return values.reduce((sum, val, i) => sum + val * ((i + 1) / totalWeight), 0);
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const useExperienceData = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["owner-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  return useQuery({
    queryKey: ["experience-data", profile?.company_id],
    queryFn: async (): Promise<CategoryExperience[]> => {
      if (!profile?.company_id) return [];

      // 1. Get all categories
      const { data: categories } = await supabase
        .from("construction_site_categories")
        .select("id, name")
        .eq("company_id", profile.company_id);

      if (!categories?.length) return [];

      // 2. Get all category parameters
      const { data: params } = await supabase
        .from("category_parameters")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("display_order");

      if (!params?.length) return [];

      // 3. Get all sites with categories
      const { data: sites } = await supabase
        .from("construction_sites")
        .select("id, customer_last_name, category_id, status")
        .eq("company_id", profile.company_id)
        .not("category_id", "is", null);

      if (!sites?.length) return [];

      // 4. Get all site parameter values
      const { data: siteParams } = await supabase
        .from("construction_site_parameters")
        .select("*");

      // 4b. Get all site products for material costs
      const { data: siteProductsData } = await supabase
        .from("construction_site_products")
        .select("construction_site_id, ek_price, vk_price, quantity")
        .eq("company_id", profile.company_id);

      // 5. Get hours per site (via daily_assignments + employee_assignments)
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

      // 6. Get employee wages
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, hourly_wage, calculated_hourly_wage")
        .eq("company_id", profile.company_id);

      const wageMap = new Map(
        profiles?.map((p) => [p.id, p.calculated_hourly_wage || p.hourly_wage || 0]) || []
      );

      // Calculate total hours per site
      const siteHoursMap = new Map<string, number>();
      const siteLaborCostMap = new Map<string, number>();

      empAssignments?.forEach((ea) => {
        const assignment = assignments?.find((a) => a.id === ea.daily_assignment_id);
        if (!assignment) return;

        const startParts = assignment.start_time?.split(":").map(Number) || [8, 0];
        const endParts = assignment.end_time?.split(":").map(Number) || [17, 0];
        const hours = endParts[0] - startParts[0] + (endParts[1] - startParts[1]) / 60;

        const siteId = assignment.construction_site_id;
        siteHoursMap.set(siteId, (siteHoursMap.get(siteId) || 0) + hours);

        const wage = wageMap.get(ea.employee_id) || 0;
        siteLaborCostMap.set(siteId, (siteLaborCostMap.get(siteId) || 0) + hours * wage);
      });

      // Calculate material costs per site
      const siteMaterialEkMap = new Map<string, number>();
      const siteMaterialVkMap = new Map<string, number>();
      siteProductsData?.forEach((sp: any) => {
        const sid = sp.construction_site_id;
        siteMaterialEkMap.set(sid, (siteMaterialEkMap.get(sid) || 0) + sp.ek_price * sp.quantity);
        siteMaterialVkMap.set(sid, (siteMaterialVkMap.get(sid) || 0) + sp.vk_price * sp.quantity);
      });

      // Calculate avg hourly rate
      const allWages = profiles?.map((p) => p.calculated_hourly_wage || p.hourly_wage).filter(Boolean) as number[];
      const avgHourlyRate = allWages.length > 0 ? allWages.reduce((a, b) => a + b, 0) / allWages.length : 0;

      // Build experience per category
      return categories.map((cat) => {
        const catParams = params.filter((p) => p.category_id === cat.id);
        const catSites = sites.filter((s) => s.category_id === cat.id);

        const parameterStats: ParameterStats[] = catParams.map((param) => {
          const dataPoints: SiteDataPoint[] = [];

          catSites.forEach((site) => {
            const siteParam = siteParams?.find(
              (sp) => sp.construction_site_id === site.id && sp.parameter_id === param.id
            );
            const totalHours = siteHoursMap.get(site.id) || 0;
            const laborCost = siteLaborCostMap.get(site.id) || 0;

            if (siteParam && siteParam.value > 0 && totalHours > 0) {
              const materialEk = siteMaterialEkMap.get(site.id) || 0;
              const materialVk = siteMaterialVkMap.get(site.id) || 0;
              dataPoints.push({
                siteId: site.id,
                siteName: site.customer_last_name,
                status: site.status,
                parameterValue: Number(siteParam.value),
                totalHours,
                hoursPerUnit: totalHours / Number(siteParam.value),
                laborCost,
                materialEk,
                materialVk,
                totalCost: laborCost + materialEk,
                isOutlier: siteParam.is_outlier || false,
              });
            }
          });

          // Sort by creation (oldest first for weighted avg)
          const activePoints = dataPoints.filter((dp) => !dp.isOutlier);
          const hpuValues = activePoints.map((dp) => dp.hoursPerUnit);

          return {
            parameterId: param.id,
            parameterName: param.name,
            parameterUnit: param.unit,
            dataPoints,
            weightedAvgHoursPerUnit: calculateWeightedAvg(hpuValues),
            simpleAvgHoursPerUnit: hpuValues.length > 0 ? hpuValues.reduce((a, b) => a + b, 0) / hpuValues.length : 0,
            medianHoursPerUnit: calculateMedian(hpuValues),
            minHoursPerUnit: hpuValues.length > 0 ? Math.min(...hpuValues) : 0,
            maxHoursPerUnit: hpuValues.length > 0 ? Math.max(...hpuValues) : 0,
            confidence: hpuValues.length >= 10 ? "high" : hpuValues.length >= 4 ? "medium" : "low",
            totalDataPoints: hpuValues.length,
          };
        });

        return {
          categoryId: cat.id,
          categoryName: cat.name,
          parameters: parameterStats,
          avgHourlyRate,
        };
      }).filter((cat) => cat.parameters.some((p) => p.totalDataPoints > 0));
    },
    enabled: !!profile?.company_id,
  });
};
