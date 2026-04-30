import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Calculator, Plus, Minus, Euro, Search, Folder, Save, User } from "lucide-react";
import { LaborEstimationCard } from "./LaborEstimationCard";

interface QuoteCalculatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingQuote?: SavedQuote | null;
  onSave: (quote: QuoteData) => void;
  onSaveAndAssign: (quote: QuoteData) => void;
}

type UnitType = "piece" | "meter" | "square_meter" | "cubic_meter";

const unitLabels: Record<UnitType, { label: string; shortLabel: string }> = {
  piece: { label: "Stück", shortLabel: "Stk" },
  meter: { label: "Meter", shortLabel: "m" },
  square_meter: { label: "Quadratmeter", shortLabel: "m²" },
  cubic_meter: { label: "Kubikmeter", shortLabel: "m³" },
};

export interface SelectedProduct {
  productId: string;
  quantity: number;
  pricePerUnit: number;
  sellingPricePerUnit?: number;
  name: string;
  unitType: UnitType;
  categoryName: string;
}

export interface QuoteData {
  id?: string;
  title: string;
  products: SelectedProduct[];
  totalPrice: number;
  customerId?: string;
}

export interface SavedQuote {
  id: string;
  title: string | null;
  total_price: number;
  products: SelectedProduct[];
  construction_site_id: string | null;
  created_at: string;
  updated_at: string;
}

export const QuoteCalculatorDialog = ({ 
  open, 
  onOpenChange, 
  editingQuote,
  onSave,
  onSaveAndAssign,
}: QuoteCalculatorDialogProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

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

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, company_name, customer_type")
        .eq("company_id", profile.company_id)
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Initialize from editing quote
  useMemo(() => {
    if (editingQuote && open) {
      setSelectedCustomerId("");
      setSelectedProducts(editingQuote.products || []);
    } else if (!open) {
      setSelectedCustomerId("");
      setSelectedProducts([]);
      setSearchQuery("");
    }
  }, [editingQuote, open]);

  // Fetch all categories with products
  const { data: categories = [] } = useQuery({
    queryKey: ["calculator-categories-with-products", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data: cats, error: catsError } = await supabase
        .from("calculator_categories")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: true });
      
      if (catsError) throw catsError;
      
      const { data: products, error: prodsError } = await supabase
        .from("calculator_products")
        .select(`
          *,
          calculator_product_items (*)
        `)
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: true });
      
      if (prodsError) throw prodsError;

      // Fetch all folder margins
      const { data: allFolderMargins } = await supabase
        .from("calculator_folder_margins")
        .select("*")
        .eq("company_id", profile.company_id);
      
      return cats.map(cat => ({
        ...cat,
        products: products?.filter(p => p.category_id === cat.id) || [],
        folderMargins: allFolderMargins?.filter(fm => fm.category_id === cat.id) || [],
      }));
    },
    enabled: !!profile?.company_id,
  });

  // Flatten all products for search
  const allProducts = useMemo(() => {
    return categories.flatMap(cat => 
      cat.products.map((p: any) => ({ ...p, categoryName: cat.name }))
    );
  }, [categories]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return allProducts.filter((p: any) => 
      p.name.toLowerCase().includes(query) ||
      p.categoryName.toLowerCase().includes(query) ||
      (p.article_number && p.article_number.toLowerCase().includes(query))
    );
  }, [allProducts, searchQuery]);

  const calculateProductPrice = (product: any) => {
    const items = product.calculator_product_items || [];
    const totalPrice = items.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
    const baseQuantity = product.base_quantity || 1;
    return totalPrice / baseQuantity;
  };

  const calculateSellingPrice = (product: any, categoryMargin: number, catFolderMargins: any[] = []) => {
    const ekPrice = calculateProductPrice(product);
    if (product.margin_multiplier != null) return ekPrice * product.margin_multiplier;
    // Check folder margins
    const textWords = product.name.split(/\s+/).filter((w: string) => !/^[\d.,xX×*\-/]+$/.test(w) && !/^[A-Za-z]{0,2}\d+/.test(w));
    for (let i = textWords.length; i > 0; i--) {
      const key = textWords.slice(0, i).join("/");
      const found = catFolderMargins.find((fm: any) => fm.folder_path === key);
      if (found) return ekPrice * found.margin_multiplier;
    }
    return ekPrice * categoryMargin;
  };

  const toggleProduct = (product: any, categoryName: string, categoryMargin: number, catFolderMargins: any[] = []) => {
    const exists = selectedProducts.find(p => p.productId === product.id);
    if (exists) {
      setSelectedProducts(prev => prev.filter(p => p.productId !== product.id));
    } else {
      const ekPrice = calculateProductPrice(product);
      const vkPrice = calculateSellingPrice(product, categoryMargin, catFolderMargins);
      setSelectedProducts(prev => [...prev, {
        productId: product.id,
        quantity: 1,
        pricePerUnit: ekPrice,
        sellingPricePerUnit: vkPrice,
        name: product.name,
        unitType: product.unit_type as UnitType,
        categoryName,
      }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setSelectedProducts(prev => prev.map(p => {
      if (p.productId === productId) {
        const newQty = Math.max(0.1, p.quantity + delta);
        return { ...p, quantity: newQty };
      }
      return p;
    }));
  };

  const setQuantity = (productId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSelectedProducts(prev => prev.map(p => {
      if (p.productId === productId) {
        return { ...p, quantity: Math.max(0, numValue) };
      }
      return p;
    }));
  };

  const totalEkPrice = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + (p.pricePerUnit * p.quantity), 0);
  }, [selectedProducts]);

  const totalPrice = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + ((p.sellingPricePerUnit ?? p.pricePerUnit) * p.quantity), 0);
  }, [selectedProducts]);

  // Get selected customer name for title
  const getQuoteTitle = () => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (customer) {
      return customer.company_name || customer.name;
    }
    return `Angebot vom ${new Date().toLocaleDateString("de-DE")}`;
  };

  const handleCancel = () => {
    setSelectedCustomerId("");
    setSelectedProducts([]);
    setSearchQuery("");
    onOpenChange(false);
  };

  const handleSave = () => {
    onSave({
      id: editingQuote?.id,
      title: getQuoteTitle(),
      products: selectedProducts,
      totalPrice,
      customerId: selectedCustomerId || undefined,
    });
    handleCancel();
  };

  const handleSaveAndAssign = () => {
    onSaveAndAssign({
      id: editingQuote?.id,
      title: getQuoteTitle(),
      products: selectedProducts,
      totalPrice,
      customerId: selectedCustomerId || undefined,
    });
    handleCancel();
  };

  const renderProductItem = (product: any, categoryName: string, categoryMargin: number = 1, catFolderMargins: any[] = []) => {
    const isSelected = selectedProducts.some(p => p.productId === product.id);
    const selected = selectedProducts.find(p => p.productId === product.id);
    const ekPrice = calculateProductPrice(product);
    const vkPrice = calculateSellingPrice(product, categoryMargin, catFolderMargins);
    const unitLabel = unitLabels[product.unit_type as UnitType];

    return (
      <div
        key={product.id}
        className={`
          p-3 rounded-lg border transition-all
          ${isSelected 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-muted-foreground/50"
          }
        `}
      >
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleProduct(product, categoryName, categoryMargin, catFolderMargins)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{product.name}</span>
                {product.article_number && (
                  <Badge variant="outline" className="text-xs font-mono shrink-0">
                    #{product.article_number}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {vkPrice !== ekPrice && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    EK {ekPrice.toFixed(2)} €
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  VK {vkPrice.toFixed(2)} € / {unitLabel.shortLabel}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        
        {isSelected && selected && (
          <div className="mt-3 pl-7 flex items-center gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => updateQuantity(product.id, -1)}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                min="0"
                value={selected.quantity}
                onChange={(e) => setQuantity(product.id, e.target.value)}
                className="w-20 h-8 text-center"
              />
              <span className="text-sm text-muted-foreground">
                {unitLabel.shortLabel}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => updateQuantity(product.id, 1)}
            >
              <Plus className="w-3 h-3" />
            </Button>
            <div className="ml-auto text-right">
              <span className="font-medium text-primary">
                = {(selected.quantity * vkPrice).toFixed(2)} € VK
              </span>
              {vkPrice !== ekPrice && (
                <span className="block text-xs text-muted-foreground">
                  EK: {(selected.quantity * ekPrice).toFixed(2)} €
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            {editingQuote ? "Angebot bearbeiten" : "Angebotsrechner"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Kunde auswählen
            </Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Kunde auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {customers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Keine Kunden vorhanden
                  </div>
                ) : (
                  customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name 
                        ? `${customer.company_name}${customer.name ? ` (${customer.name})` : ""}`
                        : customer.name
                      }
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Produkte suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Separator />

          {/* Product Selection */}
          <div className="flex-1 overflow-hidden">
            <Label className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4" />
              Produkte auswählen
            </Label>
            
            <ScrollArea className="h-[280px] pr-4">
              {/* Search Results */}
              {filteredProducts !== null ? (
                <div className="space-y-2">
                  {filteredProducts.length > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-2">
                        {filteredProducts.length} Ergebnis{filteredProducts.length !== 1 ? "se" : ""} für "{searchQuery}"
                      </p>
                      {filteredProducts.map((product: any) => {
                        const cat = categories.find((c: any) => c.id === product.category_id);
                        return renderProductItem(product, product.categoryName, cat?.default_margin_multiplier ?? 1, cat?.folderMargins ?? []);
                      })}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Keine Produkte gefunden für "{searchQuery}"
                    </p>
                  )}
                </div>
              ) : (
                /* Category Accordion View */
                <Accordion type="multiple" className="space-y-2">
                  {categories.map((category) => (
                    <AccordionItem 
                      key={category.id} 
                      value={category.id}
                      className="border rounded-lg px-3"
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{category.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {category.products.length}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {category.products.map((product: any) => 
                            renderProductItem(product, category.name, category.default_margin_multiplier ?? 1, category.folderMargins ?? [])
                          )}
                          {category.products.length === 0 && (
                            <p className="text-sm text-muted-foreground italic py-2">
                              Keine Produkte in dieser Kategorie
                            </p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                  {categories.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Keine Produkte vorhanden.</p>
                      <p className="text-sm">Füge zuerst Kategorien und Produkte hinzu.</p>
                    </div>
                  )}
                </Accordion>
              )}
            </ScrollArea>
          </div>

          {/* Labor Cost Estimation */}
          <LaborEstimationCard />

          <Separator />

          {/* Total */}
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedProducts.length} Produkt{selectedProducts.length !== 1 ? "e" : ""} ausgewählt
                </p>
              </div>
              <div className="text-right">
                {totalEkPrice !== totalPrice && (
                  <p className="text-sm text-muted-foreground">
                    EK: {totalEkPrice.toFixed(2)} €
                  </p>
                )}
                <p className="text-sm text-muted-foreground">VK Gesamtpreis</p>
                <p className="text-3xl font-bold text-primary flex items-center gap-1">
                  {totalPrice.toFixed(2)}
                  <Euro className="w-6 h-6" />
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 flex-wrap">
          <Button variant="outline" onClick={handleCancel}>
            Abbrechen
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleSave}
            disabled={selectedProducts.length === 0}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            Speichern
          </Button>
          <Button 
            onClick={handleSaveAndAssign}
            disabled={selectedProducts.length === 0}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            Speichern & Baustelle zuteilen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
