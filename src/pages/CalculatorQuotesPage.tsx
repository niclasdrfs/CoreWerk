import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuoteArchive } from "@/components/calculator/QuoteArchive";
import { QuoteCalculatorDialog, SavedQuote, QuoteData } from "@/components/calculator/QuoteCalculatorDialog";
import { AssignSiteDialog } from "@/components/calculator/AssignSiteDialog";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { FileText } from "lucide-react";

const CalculatorQuotesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get("filter") || "unassigned";
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<SavedQuote | null>(null);
  const [pendingQuote, setPendingQuote] = useState<QuoteData | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);

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

  const handleEditQuote = (quote: SavedQuote) => {
    setEditingQuote(quote);
    setIsQuoteDialogOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setIsQuoteDialogOpen(open);
    if (!open) {
      setEditingQuote(null);
    }
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ filter: value });
  };

  return (
    <div className="flex-1 min-h-screen bg-background">
      <header className="border-b border-emerald-500/20 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold flex-1">Angebote</h1>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={filter} onValueChange={handleTabChange} className="max-w-3xl mx-auto space-y-4">
          {/* Sticky Toolbar */}
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border pb-3 pt-1 -mx-4 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground">Angebote</span>
              </div>
              <TabsList className="grid grid-cols-2 h-9">
                <TabsTrigger value="unassigned" className="text-xs px-3">Offen</TabsTrigger>
                <TabsTrigger value="assigned" className="text-xs px-3">Zugeteilt</TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="unassigned" className="mt-0">
            <QuoteArchive 
              onEditQuote={handleEditQuote} 
              filterAssigned={false}
            />
          </TabsContent>
          
          <TabsContent value="assigned" className="mt-0">
            <QuoteArchive 
              onEditQuote={handleEditQuote} 
              filterAssigned={true}
            />
          </TabsContent>
        </Tabs>
      </main>

      <QuoteCalculatorDialog 
        open={isQuoteDialogOpen} 
        onOpenChange={handleCloseDialog}
        editingQuote={editingQuote}
        onSave={handleSave}
        onSaveAndAssign={handleSaveAndAssign}
      />

      <AssignSiteDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        quote={pendingQuote}
        isNewQuote={true}
        onSaveWithSite={handleSaveWithSite}
      />
    </div>
  );
};

export default CalculatorQuotesPage;
