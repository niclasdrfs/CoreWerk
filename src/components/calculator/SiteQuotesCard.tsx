import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Euro, 
  Calendar, 
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { SelectedProduct } from "./QuoteCalculatorDialog";

interface SiteQuotesCardProps {
  siteId: string;
}

export const SiteQuotesCard = ({ siteId }: SiteQuotesCardProps) => {
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["site-quotes", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_quotes")
        .select("*")
        .eq("construction_site_id", siteId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data.map(q => ({
        ...q,
        products: (q.products as unknown as SelectedProduct[]) || [],
      }));
    },
    enabled: !!siteId,
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
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-muted rounded w-1/3" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  if (quotes.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Kalkulationen
          <Badge variant="secondary" className="ml-auto">
            {quotes.length}
          </Badge>
        </h3>
      </div>
      <div className="divide-y divide-border">
        {quotes.map((quote) => (
          <div key={quote.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">
                  {quote.title || "Kalkulation"}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(quote.created_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {quote.products.length} Produkt{quote.products.length !== 1 ? "e" : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-primary flex items-center gap-1">
                  {Number(quote.total_price).toFixed(2)}
                  <Euro className="w-4 h-4" />
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setExpandedQuoteId(
                    expandedQuoteId === quote.id ? null : quote.id
                  )}
                >
                  {expandedQuoteId === quote.id ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Expanded Details */}
            {expandedQuoteId === quote.id && quote.products.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  {quote.products.map((product, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="truncate">{product.name}</span>
                        <span className="text-muted-foreground ml-2">
                          ({product.categoryName})
                        </span>
                      </div>
                      <div className="text-right text-muted-foreground">
                        {product.quantity} × {product.pricePerUnit.toFixed(2)} € = 
                        <span className="font-medium text-foreground ml-1">
                          {(product.quantity * product.pricePerUnit).toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
