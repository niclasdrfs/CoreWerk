import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExperienceData } from "@/hooks/useExperienceData";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Package, Plus, Trash2, Clock, Euro, AlertTriangle, CheckCircle2, TrendingUp, Search, ShoppingCart, TriangleAlert, X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

interface SelectedProduct {
  id: string;
  calculatorProductId: string;
  name: string;
  unitType: string;
  quantity: number;
  ekPrice: number;
  vkPrice: number;
}

const UNIT_LABELS: Record<string, string> = {
  piece: "Stk", meter: "m", sqm: "m²", cbm: "m³", liter: "L",
  kg: "kg", hour: "Std", day: "Tag", set: "Set", pair: "Paar", running_meter: "lfm",
};

const confidenceConfig = {
  low: { label: "Wenig Daten", color: "text-amber-600 dark:text-amber-400", icon: AlertTriangle },
  medium: { label: "Mittel", color: "text-blue-600 dark:text-blue-400", icon: TrendingUp },
  high: { label: "Zuverlässig", color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const formatHours = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const ProductBuilderPage = () => {
  const { user } = useAuth();
  const { data: experienceData } = useExperienceData();

  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [laborHours, setLaborHours] = useState<Record<string, number>>({});
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [marginPercent, setMarginPercent] = useState<number>(15);
  const [manualVkPrice, setManualVkPrice] = useState<string>("");
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("piece");
  const [newProductQty, setNewProductQty] = useState<number>(1);
  const [newProductEk, setNewProductEk] = useState<number>(0);

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

  // Fetch configurator categories
  const { data: configuratorCategories = [] } = useQuery({
    queryKey: ["configurator-categories", profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_configurator_categories")
        .select("id, name, description, material_ek")
        .eq("company_id", profile!.company_id!)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  // Fetch calculator products (from CSV imports)
  const { data: catalogProducts = [] } = useQuery({
    queryKey: ["calculator-products-all", profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calculator_products")
        .select("id, name, unit_type, article_number, supplier, base_quantity, category_id")
        .eq("company_id", profile!.company_id!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  // Fetch calculator product items (prices)
  const productIds = catalogProducts.map((p) => p.id);
  const { data: productItems = [] } = useQuery({
    queryKey: ["calculator-product-items-all", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      const { data, error } = await supabase
        .from("calculator_product_items")
        .select("product_id, name, price")
        .in("product_id", productIds);
      if (error) throw error;
      return data;
    },
    enabled: productIds.length > 0,
  });

  // Build price map
  const productPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    productItems.forEach((item) => {
      map.set(item.product_id, (map.get(item.product_id) || 0) + item.price);
    });
    return map;
  }, [productItems]);

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return catalogProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.article_number?.toLowerCase().includes(q) ||
        p.supplier?.toLowerCase().includes(q)
    ).slice(0, 100);
  }, [catalogProducts, searchQuery]);

  // Experience data for selected category
  const experienceCategory = useMemo(() => {
    if (!selectedCategoryId || !experienceData) return null;
    // Map configurator category to construction site category by name
    const confCat = configuratorCategories.find((c) => c.id === selectedCategoryId);
    if (!confCat) return null;
    return experienceData.find(
      (e) => e.categoryName.toLowerCase() === confCat.name.toLowerCase()
    );
  }, [selectedCategoryId, experienceData, configuratorCategories]);

  // Set hourly rate from experience when category changes
  useMemo(() => {
    if (experienceCategory && hourlyRate === 0) {
      setHourlyRate(experienceCategory.avgHourlyRate);
    }
  }, [experienceCategory]);

  // Add product from catalog
  const addProduct = (catalogProduct: typeof catalogProducts[0]) => {
    const existing = selectedProducts.find(
      (p) => p.calculatorProductId === catalogProduct.id
    );
    if (existing) {
      toast.info("Produkt bereits hinzugefügt");
      return;
    }
    const ekPrice = productPriceMap.get(catalogProduct.id) || 0;
    setSelectedProducts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        calculatorProductId: catalogProduct.id,
        name: catalogProduct.name,
        unitType: catalogProduct.unit_type,
        quantity: catalogProduct.base_quantity || 1,
        ekPrice,
        vkPrice: 0,
      },
    ]);
  };

  // Remove product
  const removeProduct = (id: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Add manual product
  const addManualProduct = () => {
    const name = newProductName.trim();
    if (!name) {
      toast.error("Bitte Produktname eingeben");
      return;
    }
    setSelectedProducts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        calculatorProductId: "",
        name,
        unitType: newProductUnit,
        quantity: newProductQty,
        ekPrice: newProductEk,
        vkPrice: 0,
      },
    ]);
    setNewProductName("");
    setNewProductQty(1);
    setNewProductEk(0);
    setShowNewProduct(false);
    toast.success("Produkt hinzugefügt");
  };

  // Update product field
  const updateProduct = (id: string, field: keyof SelectedProduct, value: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Calculations
  const totalMaterialEk = selectedProducts.reduce(
    (sum, p) => sum + p.ekPrice * p.quantity, 0
  );
  const totalLaborHours = Object.values(laborHours).reduce((a, b) => a + b, 0);
  const totalLaborCost = totalLaborHours * hourlyRate;
  const subtotal = totalMaterialEk + totalLaborCost;
  const margin = subtotal * (marginPercent / 100);
  const totalQuotePrice = subtotal + margin;

  const selectedCatObj = configuratorCategories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="flex-1 min-h-screen bg-background">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold flex-1">Produkte anlegen</h1>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Step 1: Category Selection */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">1. Kategorie wählen</h2>
          </div>
          <Select
            value={selectedCategoryId}
            onValueChange={(v) => {
              setSelectedCategoryId(v);
              setLaborHours({});
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Kategorie auswählen..." />
            </SelectTrigger>
            <SelectContent>
              {configuratorCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCatObj?.description && (
            <p className="text-sm text-muted-foreground">{selectedCatObj.description}</p>
          )}
        </Card>

        {/* Step 2: Product Selection from Catalog */}
        {selectedCategoryId && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">2. Produkte auswählen</h2>
              <Badge variant="outline" className="ml-auto text-xs">
                aus CSV-Katalog
              </Badge>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Artikel suchen (Name, Artikelnr., Lieferant)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            {/* Hit count */}
            {searchQuery.trim() && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {filteredCatalog.length} von {catalogProducts.length} Artikel
                </Badge>
              </div>
            )}

            {/* Catalog results */}
            <div className="max-h-72 overflow-y-auto border border-border rounded-md divide-y divide-border">
              {!searchQuery.trim() ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  Suchbegriff eingeben, um den Katalog zu durchsuchen
                </p>
              ) : filteredCatalog.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground text-center">Keine Artikel gefunden</p>
              ) : (
                filteredCatalog.map((product) => {
                  const price = productPriceMap.get(product.id) || 0;
                  const alreadyAdded = selectedProducts.some(
                    (p) => p.calculatorProductId === product.id
                  );
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center gap-3 p-2.5 text-sm cursor-pointer transition-colors ${
                        alreadyAdded
                          ? "bg-primary/5 opacity-60"
                          : "hover:bg-accent/50"
                      }`}
                      onClick={() => !alreadyAdded && addProduct(product)}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{product.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {product.article_number && `#${product.article_number} · `}
                          {product.supplier || "–"}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {UNIT_LABELS[product.unit_type] || product.unit_type}
                      </Badge>
                      <span className="text-xs font-mono shrink-0">
                        {price > 0 ? formatCurrency(price) : "–"}
                      </span>
                      {!alreadyAdded && (
                        <Plus className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Manual product creation */}
            <div className="border border-dashed border-border rounded-md">
              {!showNewProduct ? (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-sm text-muted-foreground"
                  onClick={() => setShowNewProduct(true)}
                >
                  <Plus className="h-4 w-4" />
                  Neues Produkt manuell erstellen
                </Button>
              ) : (
                <div className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Neues Produkt</Label>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowNewProduct(false)}>
                      Abbrechen
                    </Button>
                  </div>
                  <Input
                    placeholder="Produktname *"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="h-9"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Select value={newProductUnit} onValueChange={setNewProductUnit}>
                      <SelectTrigger className="w-28 h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(UNIT_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={newProductQty}
                        onChange={(e) => setNewProductQty(parseFloat(e.target.value) || 0)}
                        className="h-9 text-xs pr-10"
                        placeholder="Menge"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">Menge</span>
                    </div>
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newProductEk}
                        onChange={(e) => setNewProductEk(parseFloat(e.target.value) || 0)}
                        className="h-9 text-xs pr-8"
                        placeholder="EK-Preis"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">€</span>
                    </div>
                  </div>
                  <Button size="sm" className="w-full" onClick={addManualProduct}>
                    <Plus className="h-4 w-4 mr-1" />
                    Produkt hinzufügen
                  </Button>
                </div>
              )}
            </div>

            {/* Selected products */}
            {selectedProducts.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-sm font-semibold">Ausgewählte Produkte</Label>
                {selectedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-2 p-2.5 rounded-md bg-accent/30"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {product.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={product.quantity}
                          onChange={(e) =>
                            updateProduct(product.id, "quantity", parseFloat(e.target.value) || 0)
                          }
                          className="w-20 h-8 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">
                          {UNIT_LABELS[product.unitType] || product.unitType}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={product.ekPrice}
                          onChange={(e) =>
                            updateProduct(product.id, "ekPrice", parseFloat(e.target.value) || 0)
                          }
                          className="w-24 h-8 text-xs"
                        />
                        <span className="text-[10px] text-muted-foreground">EK€</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeProduct(product.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-semibold">Material EK gesamt</span>
                  <span className="text-sm font-bold text-primary">
                    {formatCurrency(totalMaterialEk)}
                  </span>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Step 3: Labor Hours with Experience Values */}
        {selectedCategoryId && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">3. Arbeitsstunden</h2>
              <Badge variant="outline" className="ml-auto text-xs">
                Erfahrungswerte
              </Badge>
            </div>

            {/* Hourly rate */}
            <div className="flex items-center gap-3">
              <Label className="text-sm whitespace-nowrap">Stundensatz</Label>
              <div className="relative w-32">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={hourlyRate || ""}
                  onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                  className="h-9 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  €/Std
                </span>
              </div>
              {experienceCategory && (
                <span className="text-xs text-muted-foreground">
                  Empfohlen: {formatCurrency(experienceCategory.avgHourlyRate)}/Std
                </span>
              )}
            </div>

            {/* Experience-based labor parameters */}
            {experienceCategory ? (
              <div className="space-y-3">
                {experienceCategory.parameters.map((param) => {
                  const conf = confidenceConfig[param.confidence];
                  const ConfIcon = conf.icon;
                  return (
                    <div
                      key={param.parameterId}
                      className="flex items-center gap-3 p-3 rounded-md bg-accent/20"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{param.parameterName}</span>
                          <Badge variant="outline" className="text-[9px] h-4">
                            {param.parameterUnit}
                          </Badge>
                          <ConfIcon className={`w-3 h-3 ml-1 ${conf.color}`} />
                        </div>
                        {param.weightedAvgHoursPerUnit > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Empfohlen: Ø {formatHours(param.weightedAvgHoursPerUnit)} / {param.parameterUnit}
                            {param.totalDataPoints > 0 && (
                              <span> ({param.totalDataPoints} Datenpunkte)</span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="Std."
                          value={laborHours[param.parameterId] || ""}
                          onChange={(e) =>
                            setLaborHours((prev) => ({
                              ...prev,
                              [param.parameterId]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-24 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">Std</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Keine Erfahrungswerte für diese Kategorie verfügbar. Tragen Sie die geschätzten Stunden manuell ein.
                </p>
                <div className="flex items-center gap-3 p-3 rounded-md bg-accent/20">
                  <Label className="text-sm flex-1">Geschätzte Arbeitsstunden</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="0"
                    value={laborHours["manual"] || ""}
                    onChange={(e) =>
                      setLaborHours({ manual: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">Std</span>
                </div>
              </div>
            )}

            {totalLaborHours > 0 && (
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm font-semibold">Lohnkosten gesamt</span>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {totalLaborHours} Std × {formatCurrency(hourlyRate)}
                  </p>
                  <span className="text-sm font-bold text-primary">
                    {formatCurrency(totalLaborCost)}
                  </span>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Step 4: Quote Summary */}
        {selectedCategoryId && (totalMaterialEk > 0 || totalLaborHours > 0) && (
          <Card className="p-5 space-y-4 border-primary/30">
            <div className="flex items-center gap-2">
              <Euro className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">4. Angebotskalkulation</h2>
            </div>

            {/* Margin */}
            <div className="flex items-center gap-3">
              <Label className="text-sm whitespace-nowrap">Aufschlag</Label>
              <div className="relative w-24">
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(parseFloat(e.target.value) || 0)}
                  className="h-9 pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Material (EK)</span>
                <span>{formatCurrency(totalMaterialEk)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lohnkosten</span>
                <span>{formatCurrency(totalLaborCost)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-medium">Zwischensumme</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aufschlag ({marginPercent}%)</span>
                <span>{formatCurrency(margin)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-primary/30 pt-3">
                <span className="text-lg font-bold">Kalkulierter Preis</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(totalQuotePrice)}
                </span>
              </div>

              {/* Manual VK override */}
              <div className="flex items-center gap-3 pt-2">
                <Label className="text-sm whitespace-nowrap">Angebotspreis (VK)</Label>
                <div className="relative flex-1 max-w-[200px]">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={totalQuotePrice.toFixed(2)}
                    value={manualVkPrice}
                    onChange={(e) => setManualVkPrice(e.target.value)}
                    className="h-9 pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Leer = kalkulierter Preis
                </span>
              </div>
            </div>

            {/* Loss Warning */}
            {(() => {
              const finalVk = manualVkPrice ? parseFloat(manualVkPrice) : totalQuotePrice;
              const isLoss = finalVk < subtotal;
              const isLowMargin = finalVk >= subtotal && finalVk < subtotal * 1.05;
              
              if (isLoss) {
                return (
                  <Alert variant="destructive" className="border-destructive/50">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertTitle>Verlustwarnung!</AlertTitle>
                    <AlertDescription>
                      Der Angebotspreis ({formatCurrency(finalVk)}) liegt unter den Ist-Kosten ({formatCurrency(subtotal)}). 
                      Sie würden einen Verlust von <span className="font-bold">{formatCurrency(subtotal - finalVk)}</span> machen.
                    </AlertDescription>
                  </Alert>
                );
              }
              
              if (isLowMargin) {
                return (
                  <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 [&>svg]:text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Niedrige Marge</AlertTitle>
                    <AlertDescription>
                      Der Angebotspreis ({formatCurrency(finalVk)}) liegt nur {((finalVk / subtotal - 1) * 100).toFixed(1)}% über den Ist-Kosten. 
                      Bei unvorhergesehenen Kosten droht ein Verlust.
                    </AlertDescription>
                  </Alert>
                );
              }
              
              return null;
            })()}

            {/* Insights */}
            {(() => {
              const finalVk = manualVkPrice ? parseFloat(manualVkPrice) : totalQuotePrice;
              const actualMargin = finalVk - subtotal;
              const marginPct = finalVk > 0 ? (actualMargin / finalVk) * 100 : 0;
              
              return (
                <div className="rounded-lg bg-accent/10 p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Ist-Kosten Übersicht
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Reine Kosten (ohne Aufschlag)</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Angebotspreis</span>
                    <span className="font-medium">{formatCurrency(finalVk)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gewinn</span>
                    <span className={`font-medium ${actualMargin < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatCurrency(actualMargin)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Marge</span>
                    <span className={`font-medium ${marginPct < 0 ? "text-destructive" : ""}`}>
                      {formatCurrency(finalVk) !== "–" ? `${marginPct.toFixed(1)}%` : "–"}
                    </span>
                  </div>
                </div>
              );
            })()}
          </Card>
        )}
      </main>
    </div>
  );
};

export default ProductBuilderPage;
