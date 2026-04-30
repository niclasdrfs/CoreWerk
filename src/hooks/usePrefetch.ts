import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { preloadRoutes } from "@/utils/routePreload";

export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchConstructionSites = useCallback(async (companyId: string) => {
    // Preload route component
    preloadRoutes.ownerSiteDetail();

    await queryClient.prefetchQuery({
      queryKey: ["construction-sites", "active", companyId],
      queryFn: async () => {
        const { data } = await supabase
          .from("construction_sites")
          .select(`
            *,
            customer:customers(name),
            category:construction_site_categories(id, name)
          `)
          .eq("company_id", companyId)
          .eq("status", "active")
          .order("created_at", { ascending: false });
        return data || [];
      },
      staleTime: 1000 * 60 * 2,
    });
  }, [queryClient]);

  const prefetchCustomers = useCallback(async (companyId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ["customers", companyId],
      queryFn: async () => {
        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("company_id", companyId)
          .order("name");
        return data || [];
      },
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  const prefetchEmployees = useCallback(async (companyId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ["employees", companyId],
      queryFn: async () => {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("company_id", companyId)
          .order("full_name");
        return data || [];
      },
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  const prefetchCategories = useCallback(async (companyId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ["construction-site-categories", companyId],
      queryFn: async () => {
        const { data } = await supabase
          .from("construction_site_categories")
          .select("*")
          .eq("company_id", companyId)
          .order("name");
        return data || [];
      },
      staleTime: 1000 * 60 * 10,
    });
  }, [queryClient]);

  const prefetchSiteDetail = useCallback(async (siteId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ["construction-site", siteId],
      queryFn: async () => {
        const { data } = await supabase
          .from("construction_sites")
          .select(`
            *,
            customer:customers(*),
            category:construction_site_categories(*)
          `)
          .eq("id", siteId)
          .single();
        return data;
      },
      staleTime: 1000 * 60 * 2,
    });
  }, [queryClient]);

  const prefetchSiteTimeline = useCallback(async (siteId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ["site-timeline", siteId],
      queryFn: async () => {
        const { data } = await supabase
          .from("construction_site_timelines")
          .select(`
            *,
            stages:construction_site_timeline_stages(*)
          `)
          .eq("construction_site_id", siteId)
          .single();
        return data;
      },
      staleTime: 1000 * 60 * 2,
    });
  }, [queryClient]);

  const prefetchTimelineTemplates = useCallback(async (companyId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ["timeline-templates", companyId],
      queryFn: async () => {
        const { data } = await supabase
          .from("timeline_templates")
          .select(`
            *,
            category:construction_site_categories(id, name),
            stages:timeline_template_stages(*)
          `)
          .eq("company_id", companyId)
          .order("name");
        return data || [];
      },
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  const prefetchCustomPages = useCallback(async (companyId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ["owner-custom-pages", companyId],
      queryFn: async () => {
        const { data } = await supabase
          .from("owner_custom_pages")
          .select("*")
          .eq("company_id", companyId)
          .order("display_order");
        return data || [];
      },
      staleTime: 1000 * 60 * 10,
    });
  }, [queryClient]);

  // Prefetch ALL common data at once for instant navigation
  const prefetchAllData = useCallback(async (companyId: string) => {
    await Promise.all([
      prefetchConstructionSites(companyId),
      prefetchCustomers(companyId),
      prefetchEmployees(companyId),
      prefetchCategories(companyId),
      prefetchTimelineTemplates(companyId),
      prefetchCustomPages(companyId),
    ]);
  }, [prefetchConstructionSites, prefetchCustomers, prefetchEmployees, prefetchCategories, prefetchTimelineTemplates, prefetchCustomPages]);

  return {
    prefetchConstructionSites,
    prefetchCustomers,
    prefetchEmployees,
    prefetchCategories,
    prefetchSiteDetail,
    prefetchSiteTimeline,
    prefetchTimelineTemplates,
    prefetchCustomPages,
    prefetchAllData,
  };
}
