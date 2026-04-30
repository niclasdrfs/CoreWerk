import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Package, Plus, Pencil, Trash2, Search, Euro, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

const UNIT_OPTIONS = [
  { value: "piece", label: "Stück", short: "Stk" },
  { value: "meter", label: "Meter", short: "m" },
  { value: "square_meter", label: "Quadratmeter", short: "m²" },
  { value: "cubic_meter", label: "Kubikmeter", short: "m³" },
  { value: "liter", label: "Liter", short: "L" },
  { value: "lfm", label: "Laufmeter", short: "lfm" },
  { value: "kg", label: "Kilogramm", short: "kg" },
  { value: "hour", label: "Stunden", short: "Std" },
  { value: "day", label: "Tage", short: "Tag" },
  { value: "km", label: "Kilometer", short: "km" },
  { value: "pauschale", label: "Pauschal", short: "psch" },
];

const PHASE_OPTIONS = [
  { value: "allgemein", label: "Allgemein" },
  { value: "aufmass", label: "Aufmaß" },
  { value: "konstruktion", label: "Konstruktion" },
  { value: "herstellung", label: "Herstellung" },
  { value: "beschichtung", label: "Beschichtung/Verzinkung" },
  { value: "montage", label: "Montage" },
  { value: "anfahrt", label: "Anfahrt" },
  { value: "material", label: "Material" },
  { value: "fremdleistung", label: "Fremdleistung" },
];

const getUnitShort = (unitType: string) =>
  UNIT_OPTIONS.find((u) => u.value === unitType)?.short || unitType;

const getPhaseLabel = (phase: string) =>
  PHASE_OPTIONS.find((p) => p.value === phase)?.label || phase;

interface SiteProductsCardProps {
  siteId: string;
}

export const SiteProductsCard = ({ siteId }: SiteProductsCardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState("piece");
  const [quantity, setQuantity] = useState("1");
  const [ekPrice, setEkPrice] = useState("0");
  const [vkPrice, setVkPrice] = useState("0");
  const [phase, setPhase] = useState("allgemein");
  const [notes, setNotes] = useState("");

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

  const { data: siteProducts = [], isLoading } = useQuery({
    queryKey: ["site-products", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_site_products")
        .select("*")
        .eq("construction_site_id", siteId)
        .order("phase", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });

  // Catalog products for picker
  const { data: catalogProducts = [] } = useQuery({
    queryKey: ["catalog-products-for-site", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data: products } = await supabase
        .from("calculator_products")
        .select("*, calculator_product_items(*), calculator_categories!inner(name, default_margin_multiplier)")
        .eq("company_id", profile.company_id)
        .order("name");
      return products || [];
    },
    enabled: !!profile?.company_id && showCatalogPicker,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company");
      const payload = {
        construction_site_id: siteId,
        company_id: profile.company_id,
        name: name.trim(),
        unit_type: unitType,
        quantity: parseFloat(quantity) || 1,
        ek_price: parseFloat(ekPrice) || 0,
        vk_price: parseFloat(vkPrice) || 0,
        phase,
        notes: notes.trim() || null,
      };
      if (editingProduct) {
        const { error } = await supabase
          .from("construction_site_products")
          .update(payload)
          .eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("construction_site_products")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-products", siteId] });
      toast.success(editingProduct ? "Produkt aktualisiert" : "Produkt hinzugefügt");
      closeDialog();
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("construction_site_products")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-products", siteId] });
      toast.success("Produkt entfernt");
    },
  });

  const openNewDialog = () => {
    setEditingProduct(null);
    setName("");
    setUnitType("piece");
    setQuantity("1");
    setEkPrice("0");
    setVkPrice("0");
    setPhase("allgemein");
    setNotes("");
    setDialogOpen(true);
  };

  const openEditDialog = (product: any) => {
    setEditingProduct(product);
    setName(product.name);
    setUnitType(product.unit_type);
    setQuantity(String(product.quantity));
    setEkPrice(String(product.ek_price));
    setVkPrice(String(product.vk_price));
    setPhase(product.phase);
    setNotes(product.notes || "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingProduct(null);
  };

  const importFromCatalog = (product: any) => {
    const items = product.calculator_product_items || [];
    const totalEk = items.reduce((sum: number, i: any) => sum + (i.price || 0), 0);
    const ekPerUnit = totalEk / (product.base_quantity || 1);
    const margin = product.margin_multiplier ?? product.calculator_categories?.default_margin_multiplier ?? 1;
    const vkPerUnit = ekPerUnit * margin;

    setName(product.name);
    setUnitType(product.unit_type || "piece");
    setQuantity("1");
    setEkPrice(ekPerUnit.toFixed(2));
    setVkPrice(vkPerUnit.toFixed(2));
    setShowCatalogPicker(false);
    setCatalogSearch("");
  };

  const filteredCatalog = catalogProducts.filter((p: any) =>
    catalogSearch.trim() === "" ||
    p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    (p.article_number && p.article_number.toLowerCase().includes(catalogSearch.toLowerCase()))
  );

  // Group site products by phase
  const groupedProducts = siteProducts.reduce((acc: Record<string, any[]>, p: any) => {
    const key = p.phase || "allgemein";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const totalEk = siteProducts.reduce((s: number, p: any) => s + p.ek_price * p.quantity, 0);
  const totalVk = siteProducts.reduce((s: number, p: any) => s + p.vk_price * p.quantity, 0);
  const margin = totalVk - totalEk;

  const fmt = (n: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

  return (
    <>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Produkte & Material</h3>
            <Badge variant="secondary" className="text-xs">{siteProducts.length}</Badge>
          </div>
          <Button size="sm" onClick={openNewDialog} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Hinzufügen
          </Button>
        </div>

        {siteProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Noch keine Produkte zugewiesen. Fügen Sie Produkte manuell oder aus dem Katalog hinzu.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedProducts).map(([phaseKey, products]) => (
              <div key={phaseKey}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {getPhaseLabel(phaseKey)}
                </p>
                <div className="space-y-1">
                  {(products as any[]).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 py-2 px-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                            {getUnitShort(p.unit_type)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>{p.quantity} × {fmt(p.vk_price)}</span>
                          <span className="font-medium text-foreground">{fmt(p.vk_price * p.quantity)}</span>
                          {p.ek_price !== p.vk_price && (
                            <span className="text-muted-foreground/60">EK: {fmt(p.ek_price * p.quantity)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(p)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Produkt entfernen?</AlertDialogTitle>
                              <AlertDialogDescription>"{p.name}" wird von dieser Baustelle entfernt.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)} className="bg-destructive text-destructive-foreground">
                                Entfernen
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="border-t border-border pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Material EK gesamt</span>
                <span className="font-medium">{fmt(totalEk)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Material VK gesamt</span>
                <span className="font-semibold text-foreground">{fmt(totalVk)}</span>
              </div>
              {margin > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Marge</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmt(margin)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Produkt bearbeiten" : "Produkt hinzufügen"}</DialogTitle>
          </DialogHeader>

          {!editingProduct && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 w-full"
              onClick={() => setShowCatalogPicker(true)}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Aus Katalog importieren
            </Button>
          )}

          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. IPE 200 Stahlträger" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Einheit</Label>
                <Select value={unitType} onValueChange={setUnitType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label} ({u.short})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Menge</Label>
                <Input type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>EK-Preis / Einheit</Label>
                <div className="relative">
                  <Input type="number" step="0.01" min="0" value={ekPrice} onChange={(e) => setEkPrice(e.target.value)} className="pr-8" />
                  <Euro className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
              <div>
                <Label>VK-Preis / Einheit</Label>
                <div className="relative">
                  <Input type="number" step="0.01" min="0" value={vkPrice} onChange={(e) => setVkPrice(e.target.value)} className="pr-8" />
                  <Euro className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div>
              <Label>Phase</Label>
              <Select value={phase} onValueChange={setPhase}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PHASE_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Summary */}
            {parseFloat(quantity) > 0 && parseFloat(vkPrice) > 0 && (
              <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EK gesamt</span>
                  <span>{fmt((parseFloat(ekPrice) || 0) * (parseFloat(quantity) || 0))}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">VK gesamt</span>
                  <span>{fmt((parseFloat(vkPrice) || 0) * (parseFloat(quantity) || 0))}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Abbrechen</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
              {editingProduct ? "Speichern" : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Catalog Picker Dialog */}
      <Dialog open={showCatalogPicker} onOpenChange={setShowCatalogPicker}>
        <DialogContent className="sm:max-w-lg max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>Aus Katalog importieren</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name oder Artikelnummer..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="overflow-y-auto max-h-[50vh] space-y-1">
            {filteredCatalog.slice(0, 50).map((p: any) => {
              const items = p.calculator_product_items || [];
              const totalEk = items.reduce((s: number, i: any) => s + (i.price || 0), 0);
              const ekPerUnit = totalEk / (p.base_quantity || 1);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => importFromCatalog(p)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{p.name}</span>
                    {p.article_number && (
                      <span className="text-[10px] text-muted-foreground font-mono">#{p.article_number}</span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground shrink-0">{fmt(ekPerUnit)}</span>
                </div>
              );
            })}
            {filteredCatalog.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Keine Produkte gefunden</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
