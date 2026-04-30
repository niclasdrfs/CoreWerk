import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { QuoteCalculatorInline } from "@/components/calculator/QuoteCalculatorInline";
import { QuoteData, SavedQuote } from "@/components/calculator/QuoteCalculatorDialog";
import { AssignSiteDialog } from "@/components/calculator/AssignSiteDialog";
import { toast } from "sonner";
import { Calculator } from "lucide-react";

const CalculatorLandingPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingQuote, setEditingQuote] = useState<SavedQuote | null>(null);
  const [pendingQuote, setPendingQuote] = useState<QuoteData | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);

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

  const saveMutation = useMutation({
    mutationFn: async ({ quote, siteId }: { quote: QuoteData; siteId?: string }) => {
      if (!profile?.company_id || !user) throw new Error("Nicht authentifiziert");

      const quoteData = {
        company_id: profile.company_id,
        created_by: user.id,
        title: quote.title,
        total_price: quote.totalPrice,
        products: quote.products as unknown as any,
        construction_site_id: siteId || null,
      };

      if (quote.id) {
        const { error } = await supabase
          .from("saved_quotes")
          .update({
            title: quote.title,
            total_price: quote.totalPrice,
            products: quote.products as unknown as any,
            construction_site_id: siteId || null,
          })
          .eq("id", quote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("saved_quotes")
          .insert(quoteData);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["saved-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["site-quotes"] });
      toast.success(
        variables.siteId
          ? "Angebot gespeichert und Baustelle zugewiesen"
          : "Angebot gespeichert"
      );
    },
    onError: () => {
      toast.error("Fehler beim Speichern");
    },
  });

  const handleSave = (quote: QuoteData) => {
    saveMutation.mutate({ quote });
  };

  const handleSaveAndAssign = (quote: QuoteData) => {
    setPendingQuote(quote);
    setShowAssignDialog(true);
  };

  const handleSaveWithSite = (siteId: string) => {
    if (pendingQuote) {
      saveMutation.mutate({ quote: pendingQuote, siteId });
      setPendingQuote(null);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-background">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold flex-1">Angebotsrechner</h1>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <QuoteCalculatorInline
            editingQuote={editingQuote}
            onSave={handleSave}
            onSaveAndAssign={handleSaveAndAssign}
            onReset={() => setEditingQuote(null)}
          />
        </div>
      </main>

      <AssignSiteDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        quote={pendingQuote}
        isNewQuote={true}
        onSaveWithSite={handleSaveWithSite}
        selectedCustomerId={pendingQuote?.customerId}
      />
    </div>
  );
};

export default CalculatorLandingPage;
