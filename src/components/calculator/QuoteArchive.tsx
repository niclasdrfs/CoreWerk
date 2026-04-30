import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  FileText, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Building2, 
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { SavedQuote, SelectedProduct } from "./QuoteCalculatorDialog";
import { AssignSiteDialog } from "./AssignSiteDialog";

interface QuoteArchiveProps {
  onEditQuote: (quote: SavedQuote) => void;
  filterAssigned?: boolean;
}

export const QuoteArchive = ({ onEditQuote, filterAssigned }: QuoteArchiveProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);
  const [assignQuote, setAssignQuote] = useState<SavedQuote | null>(null);

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

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["saved-quotes", profile?.company_id, filterAssigned],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("saved_quotes")
        .select(`
          *,
          construction_sites (
            id,
            customer_last_name,
            address
          )
        `)
        .eq("company_id", profile.company_id)
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      
      let filteredData = data;
      if (filterAssigned === true) {
        filteredData = data.filter(q => q.construction_site_id !== null);
      } else if (filterAssigned === false) {
        filteredData = data.filter(q => q.construction_site_id === null);
      }
      
      return filteredData.map(q => ({
        ...q,
        products: (q.products as unknown as SelectedProduct[]) || [],
      }));
    },
    enabled: !!profile?.company_id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from("saved_quotes")
        .delete()
        .eq("id", quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-quotes"] });
      toast.success("Angebot gelöscht");
      setDeleteQuoteId(null);
    },
    onError: () => {
      toast.error("Fehler beim Löschen");
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-0 rounded-lg border border-border overflow-hidden divide-y divide-border/50">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-muted/30" />
        ))}
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Keine Angebote vorhanden.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/50">
        {quotes.map((quote: any) => (
          <div
            key={quote.id}
            className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/40 transition-colors group"
          >
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {quote.title || "Unbenanntes Angebot"}
                </span>
                {quote.construction_sites && (
                  <Badge variant="default" className="gap-1 text-[10px] h-5 px-1.5">
                    <Building2 className="w-2.5 h-2.5" />
                    {quote.construction_sites.customer_last_name}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{formatDate(quote.updated_at)}</span>
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {quote.products.length}
                </span>
              </div>
            </div>
            <span className="text-sm font-semibold tabular-nums shrink-0">
              {Number(quote.total_price).toFixed(2)} €
            </span>
            {!quote.construction_site_id ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 px-2"
                  onClick={(e) => { e.stopPropagation(); onEditQuote(quote); }}
                >
                  <Pencil className="w-3 h-3" />
                  Bearbeiten
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 px-2"
                  onClick={(e) => { e.stopPropagation(); setAssignQuote(quote); }}
                >
                  <Building2 className="w-3 h-3" />
                  Zuteilen
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setDeleteQuoteId(quote.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditQuote(quote)}>
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setDeleteQuoteId(quote.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={!!deleteQuoteId} onOpenChange={() => setDeleteQuoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Angebot löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieses Angebot wird dauerhaft gelöscht und kann nicht wiederhergestellt werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteQuoteId && deleteMutation.mutate(deleteQuoteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AssignSiteDialog
        open={!!assignQuote}
        onOpenChange={() => setAssignQuote(null)}
        quote={assignQuote}
      />
    </>
  );
};
