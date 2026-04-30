import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Package, Plus, Minus, Euro, Search, Folder, FolderOpen, Save, User, ArrowUpDown, Filter, Check, Pencil, Trash2, ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";
import { SavedQuote, SelectedProduct, QuoteData } from "./QuoteCalculatorDialog";
import { PresetDropdown } from "./PresetDropdown";
import { LaborEstimationCard } from "./LaborEstimationCard";
import { groupByWordIndex, GroupEntry } from "@/lib/articleGrouping";

type UnitType = "piece" | "meter" | "square_meter" | "cubic_meter";

const unitLabels: Record<UnitType, { label: string; shortLabel: string }> = {
  piece: { label: "Stück", shortLabel: "Stk" },
  meter: { label: "Meter", shortLabel: "m" },
  square_meter: { label: "Quadratmeter", shortLabel: "m²" },
  cubic_meter: { label: "Kubikmeter", shortLabel: "m³" },
};

type SortOption = "name" | "price_asc" | "price_desc" | "size";

interface QuoteCalculatorInlineProps {
  editingQuote?: SavedQuote | null;
  onSave: (quote: QuoteData) => void;
  onSaveAndAssign: (quote: QuoteData) => void;
  onReset?: () => void;
}

export const QuoteCalculatorInline = ({
  editingQuote,
  onSave,
  onSaveAndAssign,
  onReset,
}: QuoteCalculatorInlineProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [bufferedQuantity, setBufferedQuantity] = useState<string>("1");

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

  useEffect(() => {
    if (editingQuote) {
      setSelectedCustomerId("");
      setSelectedProducts(editingQuote.products || []);
    }
  }, [editingQuote]);

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
        .select(`*, calculator_product_items (*)`)
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: true });
      if (prodsError) throw prodsError;

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

  const allProducts = useMemo(() => {
    return categories.flatMap(cat =>
      cat.products.map((p: any) => ({ ...p, categoryName: cat.name, categoryId: cat.id }))
    );
  }, [categories]);

  // Sort helper
  const sortProducts = (products: any[]) => {
    const sorted = [...products];
    switch (sortBy) {
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name, "de"));
      case "price_asc":
        return sorted.sort((a, b) => calculateProductPrice(a) - calculateProductPrice(b));
      case "price_desc":
        return sorted.sort((a, b) => calculateProductPrice(b) - calculateProductPrice(a));
      case "size": {
        const extractNum = (name: string) => {
          const match = name.match(/(\d+[.,]?\d*)/);
          return match ? parseFloat(match[1].replace(",", ".")) : 0;
        };
        return sorted.sort((a, b) => extractNum(a.name) - extractNum(b.name));
      }
      default:
        return sorted;
    }
  };

  // Filtered + sorted products
  const displayProducts = useMemo(() => {
    let products = allProducts;

    // Apply category filter
    if (filterCategory !== "all") {
      products = products.filter(p => p.categoryId === filterCategory);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      products = products.filter((p: any) =>
        p.name.toLowerCase().includes(query) ||
        p.categoryName.toLowerCase().includes(query) ||
        (p.article_number && p.article_number.toLowerCase().includes(query))
      );
    }

    return sortProducts(products);
  }, [allProducts, searchQuery, filterCategory, sortBy]);

  const isSearchOrFilterActive = searchQuery.trim() !== "" || filterCategory !== "all";

  const calculateProductPrice = (product: any) => {
    const items = product.calculator_product_items || [];
    const totalPrice = items.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
    return totalPrice / (product.base_quantity || 1);
  };

  const calculateSellingPrice = (product: any, categoryMargin: number, catFolderMargins: any[] = []) => {
    const ekPrice = calculateProductPrice(product);
    if (product.margin_multiplier != null) return ekPrice * product.margin_multiplier;
    const textWords = product.name.split(/\s+/).filter((w: string) => !/^[\d.,xX×*\-/]+$/.test(w) && !/^[A-Za-z]{0,2}\d+/.test(w));
    for (let i = textWords.length; i > 0; i--) {
      const key = textWords.slice(0, i).join("/");
      const found = catFolderMargins.find((fm: any) => fm.folder_path === key);
      if (found) return ekPrice * found.margin_multiplier;
    }
    return ekPrice * categoryMargin;
  };

  const toggleProduct = (product: any, categoryName: string, categoryMargin: number, catFolderMargins: any[] = []) => {
    // If already editing this product, cancel editing and remove
    if (editingProductId === product.id) {
      setSelectedProducts(prev => prev.filter(p => p.productId !== product.id));
      setEditingProductId(null);
      return;
    }
    // If already confirmed (in selected list but not editing), ignore checkbox click
    const exists = selectedProducts.find(p => p.productId === product.id);
    if (exists) return;
    
    // Start editing mode for new product
    setEditingProductId(product.id);
    setBufferedQuantity("1");
  };

  const confirmProductSelection = (product: any, categoryName: string, categoryMargin: number, catFolderMargins: any[] = []) => {
    const qty = parseFloat(bufferedQuantity) || 1;
    const ekPrice = calculateProductPrice(product);
    const vkPrice = calculateSellingPrice(product, categoryMargin, catFolderMargins);
    // Check if already in list (re-editing from table)
    const exists = selectedProducts.find(p => p.productId === product.id);
    if (exists) {
      setSelectedProducts(prev => prev.map(p => {
        if (p.productId === product.id) {
          return { ...p, quantity: Math.max(0.1, qty) };
        }
        return p;
      }));
    } else {
      setSelectedProducts(prev => [...prev, {
        productId: product.id,
        quantity: Math.max(0.1, qty),
        pricePerUnit: ekPrice,
        sellingPricePerUnit: vkPrice,
        name: product.name,
        unitType: product.unit_type as UnitType,
        categoryName,
      }]);
    }
    setEditingProductId(null);
  };

  const editProductFromTable = (productId: string) => {
    const selected = selectedProducts.find(p => p.productId === productId);
    if (!selected) return;
    setEditingProductId(productId);
    setBufferedQuantity(String(selected.quantity));
    // Scroll to the product element
    setTimeout(() => {
      const el = document.getElementById(`product-${productId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const removeProductFromTable = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
    if (editingProductId === productId) setEditingProductId(null);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setSelectedProducts(prev => prev.map(p => {
      if (p.productId === productId) {
        return { ...p, quantity: Math.max(0.1, p.quantity + delta) };
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

  const getQuoteTitle = () => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (customer) return customer.company_name || customer.name;
    return `Angebot vom ${new Date().toLocaleDateString("de-DE")}`;
  };

  const handleReset = () => {
    setSelectedCustomerId("");
    setSelectedProducts([]);
    setSearchQuery("");
    setFilterCategory("all");
    setSortBy("name");
    setOpenCategories(new Set());
    setOpenFolders(new Set());
    setEditingProductId(null);
    onReset?.();
  };

  const handleSave = () => {
    onSave({
      id: editingQuote?.id,
      title: getQuoteTitle(),
      products: selectedProducts,
      totalPrice,
      customerId: selectedCustomerId || undefined,
    });
    handleReset();
  };

  const handleSaveAndAssign = () => {
    onSaveAndAssign({
      id: editingQuote?.id,
      title: getQuoteTitle(),
      products: selectedProducts,
      totalPrice,
      customerId: selectedCustomerId || undefined,
    });
    handleReset();
  };

  // Load preset: merge with existing selection, overriding quantities for already-selected products
  const handleLoadPreset = (presetProducts: { productId: string; quantity: number; name: string; unitType: string }[]) => {
    setSelectedProducts(prev => {
      const merged = [...prev];
      for (const pp of presetProducts) {
        const existingIdx = merged.findIndex(p => p.productId === pp.productId);
        // Find the full product data to calculate prices
        const fullProduct = allProducts.find((p: any) => p.id === pp.productId);
        if (existingIdx >= 0) {
          merged[existingIdx] = { ...merged[existingIdx], quantity: pp.quantity };
        } else if (fullProduct) {
          const cat = categories.find((c: any) => c.id === fullProduct.categoryId);
          const ekPrice = calculateProductPrice(fullProduct);
          const vkPrice = calculateSellingPrice(fullProduct, cat?.default_margin_multiplier ?? 1, cat?.folderMargins ?? []);
          merged.push({
            productId: pp.productId,
            quantity: pp.quantity,
            pricePerUnit: ekPrice,
            sellingPricePerUnit: vkPrice,
            name: pp.name,
            unitType: pp.unitType as UnitType,
            categoryName: fullProduct.categoryName,
          });
        }
      }
      return merged;
    });
  };

  // Track open categories/folders
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleFolder = (key: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const renderProductRow = (product: any, categoryName: string, categoryMargin: number = 1, catFolderMargins: any[] = []) => {
    const isConfirmed = selectedProducts.some(p => p.productId === product.id);
    const isEditing = editingProductId === product.id;
    const vkPrice = calculateSellingPrice(product, categoryMargin, catFolderMargins);
    const unitLabel = unitLabels[product.unit_type as UnitType];

    return (
      <div key={product.id} id={`product-${product.id}`}>
        <div
          className={`flex items-center gap-2 py-2 px-3 transition-colors cursor-pointer ${
            isEditing ? "bg-primary/5" : isConfirmed ? "bg-muted/30" : "hover:bg-muted/30"
          }`}
          onClick={() => {
            if (!isEditing && !isConfirmed) {
              toggleProduct(product, categoryName, categoryMargin, catFolderMargins);
            }
          }}
        >
          <Checkbox
            checked={isEditing}
            onCheckedChange={() => toggleProduct(product, categoryName, categoryMargin, catFolderMargins)}
            className="shrink-0"
          />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm truncate">{product.name}</span>
            {product.article_number && (
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{product.article_number}</span>
            )}
            {isConfirmed && !isEditing && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">✓</Badge>
            )}
          </div>
          <span className="text-sm tabular-nums text-muted-foreground shrink-0">
            {vkPrice.toFixed(2)} €/{unitLabel.shortLabel}
          </span>
        </div>
        {isEditing && (
          <div className="flex items-center gap-2 py-1.5 px-3 pl-9 bg-primary/5 border-t border-primary/10">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
              const q = parseFloat(bufferedQuantity) || 1;
              setBufferedQuantity(String(Math.max(0.1, q - 1)));
            }}>
              <Minus className="w-3 h-3" />
            </Button>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={bufferedQuantity}
              onChange={(e) => setBufferedQuantity(e.target.value)}
              className="w-16 h-7 text-center text-sm"
            />
            <span className="text-xs text-muted-foreground">{unitLabel.shortLabel}</span>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
              const q = parseFloat(bufferedQuantity) || 0;
              setBufferedQuantity(String(q + 1));
            }}>
              <Plus className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 gap-1 ml-auto text-xs"
              onClick={() => confirmProductSelection(product, categoryName, categoryMargin, catFolderMargins)}
            >
              <Check className="w-3 h-3" />
              Bestätigen
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderGroupEntries = (entries: GroupEntry[], categoryName: string, categoryMargin: number, catFolderMargins: any[], depth: number): React.ReactNode => {
    return entries.map((entry, idx) => {
      if (entry.type === "article") {
        return renderProductRow(entry.product, categoryName, categoryMargin, catFolderMargins);
      }
      const folderKey = `${categoryName}-${depth}-${entry.word}`;
      const isOpen = openFolders.has(folderKey);
      const subEntries = groupByWordIndex(entry.articles, depth);
      const hasSubFolders = subEntries.some(e => e.type === "folder");
      return (
        <div key={`folder-${depth}-${entry.word}-${idx}`}>
          <div
            className="flex items-center gap-2 py-1.5 px-3 cursor-pointer hover:bg-muted/30 transition-colors"
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
            onClick={() => toggleFolder(folderKey)}
          >
            {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
            <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{entry.word}</span>
            <span className="text-xs text-muted-foreground">({entry.count})</span>
          </div>
          {isOpen && (
            <div>
              {hasSubFolders
                ? renderGroupEntries(subEntries, categoryName, categoryMargin, catFolderMargins, depth + 1)
                : sortProducts(entry.articles).map((product: any) =>
                    renderProductRow(product, categoryName, categoryMargin, catFolderMargins)
                  )
              }
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* Sticky Toolbar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border pb-3 pt-1 -mx-4 px-4">
        <div className="flex flex-col gap-2">
          {/* Row 1: Customer + Preset */}
          <div className="flex gap-2">
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="h-9 flex-1">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <SelectValue placeholder="Kunde..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                {customers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">Keine Kunden</div>
                ) : (
                  customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name
                        ? `${customer.company_name}${customer.name ? ` (${customer.name})` : ""}`
                        : customer.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <PresetDropdown
              companyId={profile?.company_id ?? null}
              selectedProducts={selectedProducts}
              onLoadPreset={handleLoadPreset}
            />
          </div>
          {/* Row 2: Search + Filter + Sort */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                  <Filter className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="end">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Kategorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Kategorien</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="end">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sortierung" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                    <SelectItem value="price_asc">Preis ↑</SelectItem>
                    <SelectItem value="price_desc">Preis ↓</SelectItem>
                    <SelectItem value="size">Größe</SelectItem>
                  </SelectContent>
                </Select>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/50">
        {isSearchOrFilterActive ? (
          <>
            {displayProducts.length > 0 ? (
              displayProducts.map((product: any) => {
                const cat = categories.find((c: any) => c.id === product.category_id);
                return renderProductRow(product, product.categoryName, cat?.default_margin_multiplier ?? 1, cat?.folderMargins ?? []);
              })
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">Keine Produkte gefunden</p>
            )}
          </>
        ) : (
          <>
            {categories.map((category) => {
              const isOpen = openCategories.has(category.id);
              const entries = groupByWordIndex(category.products, 0);
              return (
                <div key={category.id}>
                  <div
                    className={`flex items-center gap-2 py-2.5 px-3 cursor-pointer hover:bg-muted/40 transition-colors ${isOpen ? "border-l-4 border-l-primary bg-muted/20" : "border-l-4 border-l-transparent"}`}
                    onClick={() => toggleCategory(category.id)}
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    {isOpen ? <FolderOpen className="w-4 h-4 text-primary shrink-0" /> : <Folder className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className="font-medium text-sm flex-1">{category.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{category.products.length}</span>
                  </div>
                  {isOpen && category.products.length > 0 && (
                    <div className="border-l-4 border-l-primary/30">
                      {renderGroupEntries(entries, category.name, category.default_margin_multiplier ?? 1, category.folderMargins ?? [], 1)}
                    </div>
                  )}
                  {isOpen && category.products.length === 0 && (
                    <div className="py-3 px-6 text-sm text-muted-foreground italic border-l-4 border-l-primary/30">
                      Keine Produkte
                    </div>
                  )}
                </div>
              );
            })}
            {categories.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine Produkte vorhanden.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Selected Products Summary Table */}
      {selectedProducts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Ausgewählte Produkte ({selectedProducts.length})
          </p>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left py-1.5 px-2 font-medium">Produkt</th>
                  <th className="text-right py-1.5 px-2 font-medium w-16">Menge</th>
                  <th className="text-right py-1.5 px-2 font-medium w-20">Einzel</th>
                  <th className="text-right py-1.5 px-2 font-medium w-20">Gesamt</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {selectedProducts.map((p) => {
                  const vk = p.sellingPricePerUnit ?? p.pricePerUnit;
                  const unit = unitLabels[p.unitType as UnitType];
                  return (
                    <tr key={p.productId} className="hover:bg-muted/30">
                      <td className="py-1 px-2 truncate max-w-[200px]">{p.name}</td>
                      <td className="py-1 px-2 text-right tabular-nums">
                        {p.quantity} {unit?.shortLabel}
                      </td>
                      <td className="py-1 px-2 text-right tabular-nums">{vk.toFixed(2)} €</td>
                      <td className="py-1 px-2 text-right tabular-nums font-medium">
                        {(p.quantity * vk).toFixed(2)} €
                      </td>
                      <td className="py-1 px-1 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => editProductFromTable(p.productId)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeProductFromTable(p.productId)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Labor Cost Estimation */}
      <LaborEstimationCard />

      <Separator />

      {/* Loss Warning */}
      {totalEkPrice > 0 && totalPrice < totalEkPrice && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Verlustwarnung!</p>
            <p className="text-sm text-destructive/80">
              Der VK-Preis ({totalPrice.toFixed(2)} €) liegt unter dem EK-Preis ({totalEkPrice.toFixed(2)} €). 
              Möglicher Verlust: <span className="font-bold">{(totalEkPrice - totalPrice).toFixed(2)} €</span>
            </p>
          </div>
        </div>
      )}

      {totalEkPrice > 0 && totalPrice >= totalEkPrice && totalPrice < totalEkPrice * 1.05 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Niedrige Marge</p>
            <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
              Der VK-Preis liegt nur {((totalPrice / totalEkPrice - 1) * 100).toFixed(1)}% über dem EK-Preis. 
              Bei unvorhergesehenen Kosten droht ein Verlust.
            </p>
          </div>
        </div>
      )}

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
              <p className="text-sm text-muted-foreground">EK: {totalEkPrice.toFixed(2)} €</p>
            )}
            <p className="text-sm text-muted-foreground">VK Gesamtpreis</p>
            <p className="text-3xl font-bold text-primary flex items-center gap-1">
              {totalPrice.toFixed(2)}
              <Euro className="w-6 h-6" />
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 flex-wrap">
        <Button variant="outline" onClick={handleReset}>
          Zurücksetzen
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
    </div>
  );
};
