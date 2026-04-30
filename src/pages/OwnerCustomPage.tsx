import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CalculatorLandingPage from "./CalculatorLandingPage";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { FileText } from "lucide-react";

const OwnerCustomPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  // Get user's company ID
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

  // Fetch the page by slug
  const { data: page, isLoading } = useQuery({
    queryKey: ["owner-custom-page", slug, profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id || !slug) return null;
      const { data, error } = await supabase
        .from("owner_custom_pages")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id && !!slug,
  });

  // Special handling for Kalkulator page
  if (slug === "kalkulator") {
    return <CalculatorLandingPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Seite nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-background">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold">{page.name}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                {page.name}
              </h1>
              <p className="text-lg text-muted-foreground">
                Benutzerdefinierte Seite
              </p>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-8">
            <p className="text-muted-foreground text-center">
              Diese Seite ist leer. Inhalte können später hinzugefügt werden.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OwnerCustomPage;
