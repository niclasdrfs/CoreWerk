import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Building2, Plus, User } from "lucide-react";
import { toast } from "sonner";
import { SavedQuote, QuoteData } from "./QuoteCalculatorDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AssignSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: SavedQuote | QuoteData | null;
  isNewQuote?: boolean;
  onSaveWithSite?: (siteId: string) => void;
  selectedCustomerId?: string;
}

export const AssignSiteDialog = ({ 
  open, 
  onOpenChange, 
  quote,
  isNewQuote = false,
  onSaveWithSite,
  selectedCustomerId,
}: AssignSiteDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");

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

  // Fetch construction sites
  const { data: sites = [] } = useQuery({
    queryKey: ["construction-sites", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("construction_sites")
        .select("id, customer_last_name, address, status")
        .eq("company_id", profile.company_id)
        .in("status", ["pending", "active", "future"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id && open,
  });

  // Fetch selected customer data
  const { data: selectedCustomer } = useQuery({
    queryKey: ["customer", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return null;
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", selectedCustomerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomerId && open,
  });

  // Create new site from customer data
  const createSiteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer || !profile?.company_id || !user?.id) {
        throw new Error("Kundendaten nicht verfügbar");
      }

      const customerName = selectedCustomer.company_name || selectedCustomer.name;
      
      const { data: newSite, error } = await supabase
        .from("construction_sites")
        .insert({
          customer_last_name: customerName,
          address: selectedCustomer.address || null,
          customer_phone: selectedCustomer.phone || null,
          customer_id: selectedCustomer.id,
          company_id: profile.company_id,
          created_by: user.id,
          status: "future", // New sites start as pending (ausstehend)
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error creating site:", error);
        throw error;
      }
      return newSite;
    },
    onSuccess: async (newSite) => {
      queryClient.invalidateQueries({ queryKey: ["construction-sites"] });
      queryClient.invalidateQueries({ queryKey: ["owner-pending-sites"] });
      
      if (isNewQuote && onSaveWithSite) {
        onSaveWithSite(newSite.id);
        toast.success("Baustelle erstellt und Angebot zugewiesen");
      } else if (quote && 'id' in quote && quote.id) {
        // Assign existing quote to new site
        const { error: updateError } = await supabase
          .from("saved_quotes")
          .update({ construction_site_id: newSite.id })
          .eq("id", quote.id);
        
        if (updateError) {
          console.error("Error assigning quote:", updateError);
        }
        
        queryClient.invalidateQueries({ queryKey: ["saved-quotes"] });
        queryClient.invalidateQueries({ queryKey: ["site-quotes"] });
        toast.success("Baustelle erstellt und Angebot zugewiesen");
      }
      
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error creating site:", error);
      toast.error("Fehler beim Erstellen der Baustelle");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (siteId: string) => {
      if (!quote || !('id' in quote) || !quote.id) {
        throw new Error("Kein Angebot ausgewählt");
      }
      const { error } = await supabase
        .from("saved_quotes")
        .update({ construction_site_id: siteId })
        .eq("id", quote.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["site-quotes"] });
      toast.success("Angebot wurde der Baustelle zugewiesen");
      setSelectedSiteId("");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Fehler beim Zuweisen");
    },
  });

  const handleAssignExisting = () => {
    if (!selectedSiteId) return;
    
    if (isNewQuote && onSaveWithSite) {
      onSaveWithSite(selectedSiteId);
      setSelectedSiteId("");
      onOpenChange(false);
    } else {
      assignMutation.mutate(selectedSiteId);
    }
  };

  const handleCreateNew = () => {
    createSiteMutation.mutate();
  };

  const isPending = assignMutation.isPending || createSiteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Baustelle zuteilen
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "existing" | "new")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Bestehende Baustelle</TabsTrigger>
            <TabsTrigger value="new" disabled={!selectedCustomer}>
              <Plus className="w-4 h-4 mr-1" />
              Neue Baustelle
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="pt-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Baustelle auswählen</Label>
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Baustelle wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{site.customer_last_name}</span>
                          {site.address && (
                            <span className="text-muted-foreground text-sm">
                              — {site.address}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    {sites.length === 0 && (
                      <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                        Keine aktiven Baustellen vorhanden
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleAssignExisting}
                  disabled={!selectedSiteId || isPending}
                >
                  {isNewQuote ? "Speichern & Zuteilen" : "Zuteilen"}
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>

          <TabsContent value="new" className="pt-4">
            <div className="space-y-4">
              {selectedCustomer ? (
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {selectedCustomer.company_name || selectedCustomer.name}
                      </p>
                      {selectedCustomer.company_name && selectedCustomer.name && (
                        <p className="text-sm text-muted-foreground">{selectedCustomer.name}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm space-y-1 text-muted-foreground">
                    {selectedCustomer.address && (
                      <p>📍 {selectedCustomer.address}</p>
                    )}
                    {selectedCustomer.phone && (
                      <p>📞 {selectedCustomer.phone}</p>
                    )}
                    {selectedCustomer.email && (
                      <p>✉️ {selectedCustomer.email}</p>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                    Eine neue Baustelle wird mit diesen Kundendaten erstellt.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-lg border bg-muted/30 text-center text-muted-foreground">
                  <p>Bitte wählen Sie zuerst einen Kunden im Angebotsrechner aus.</p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleCreateNew}
                  disabled={!selectedCustomer || isPending}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Baustelle erstellen & Zuteilen
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
