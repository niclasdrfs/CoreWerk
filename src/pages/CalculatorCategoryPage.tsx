import { useState, useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useTabNavigate } from "@/hooks/useTabNavigate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Package, Ruler, Square, Box, Hash, Search, ArrowUpDown, List, FolderTree, TrendingUp, ChevronRight, Folder, FolderOpen, Check, Trash2, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { CalculatorProductCard } from "@/components/calculator/CalculatorProductCard";
import { groupByWordIndex, getArticlesAtPath, type GroupEntry } from "@/lib/articleGrouping";
import FolderCard from "@/components/calculator/FolderCard";
import CategoryBreadcrumb from "@/components/calculator/CategoryBreadcrumb";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ownerAwarePath } from "@/lib/ownerRouting";

type UnitType = "piece" | "meter" | "square_meter" | "cubic_meter";

const unitLabels: Record<UnitType, { label: string; shortLabel: string; icon: React.ElementType }> = {
  piece: { label: "Stück", shortLabel: "Stk", icon: Hash },
  meter: { label: "Meter (m)", shortLabel: "m", icon: Ruler },
  square_meter: { label: "Quadratmeter (m²)", shortLabel: "m²", icon: Square },
  cubic_meter: { label: "Kubikmeter (m³)", shortLabel: "m³", icon: Box },
};

type SortOption = "name-asc" | "name-desc" | "article-number" | "price-asc" | "price-desc" | "date-desc" | "size-asc" | "size-desc";

const sortLabels: Record<SortOption, string> = {
  "name-asc": "Name (A-Z)",
  "name-desc": "Name (Z-A)",
  "size-asc": "Größe (klein → groß)",
  "size-desc": "Größe (groß → klein)",
  "article-number": "Artikelnummer",
  "price-asc": "Preis (aufsteigend)",
  "price-desc": "Preis (absteigend)",
  "date-desc": "Neueste zuerst",
};

const CalculatorCategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useTabNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductUnit, setNewProductUnit] = useState<UnitType>("meter");
  const [newProductBaseQuantity, setNewProductBaseQuantity] = useState("1");
  const [newProductArticleNumber, setNewProductArticleNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("name-asc");
  const [viewMode, setViewMode] = useState<"list" | "folder">("folder");
  const [folderPath, setFolderPath] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
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

  // Fetch category
  const { data: category, isLoading: categoryLoading } = useQuery({
    queryKey: ["calculator-category", slug, profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id || !slug) return null;
      const { data, error } = await supabase
        .from("calculator_categories")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id && !!slug,
  });

  // Fetch products with items
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["calculator-products", category?.id],
    queryFn: async () => {
      if (!category?.id) return [];
      const { data, error } = await supabase
        .from("calculator_products")
        .select(`
          *,
          calculator_product_items (*)
        `)
        .eq("category_id", category.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!category?.id,
  });

  // Fetch folder margins for this category
  const { data: folderMargins = [] } = useQuery({
    queryKey: ["calculator-folder-margins", category?.id],
    queryFn: async () => {
      if (!category?.id) return [];
      const { data, error } = await supabase
        .from("calculator_folder_margins")
        .select("*")
        .eq("category_id", category.id);
      if (error) throw error;
      return data;
    },
    enabled: !!category?.id,
  });

  // Helper: get folder margin for a given path
  const getFolderMarginForPath = (path: string[]): number | null => {
    if (path.length === 0) return null;
    for (let i = path.length; i > 0; i--) {
      const key = path.slice(0, i).join("/");
      const found = folderMargins.find((fm: any) => fm.folder_path === key);
      if (found) return found.margin_multiplier;
    }
    return null;
  };

  // Helper: get effective margin for a product
  const getEffectiveMarginForProduct = (product: any): number => {
    if (product.margin_multiplier != null) return product.margin_multiplier;
    const textWords = product.name.split(/\s+/).filter((w: string) => !/^[\d.,xX×*\-/]+$/.test(w) && !/^[A-Za-z]{0,2}\d+/.test(w));
    for (let i = textWords.length; i > 0; i--) {
      const key = textWords.slice(0, i).join("/");
      const found = folderMargins.find((fm: any) => fm.folder_path === key);
      if (found) return found.margin_multiplier;
    }
    return category?.default_margin_multiplier ?? 1;
  };

  // Upsert folder margin mutation
  const upsertFolderMarginMutation = useMutation({
    mutationFn: async ({ folderPathStr, margin }: { folderPathStr: string; margin: number | null }) => {
      if (!category?.id || !profile?.company_id) throw new Error("Keine Kategorie");
      if (margin === null) {
        await supabase
          .from("calculator_folder_margins")
          .delete()
          .eq("category_id", category.id)
          .eq("folder_path", folderPathStr);
      } else {
        const { error } = await supabase
          .from("calculator_folder_margins")
          .upsert({
            category_id: category.id,
            company_id: profile.company_id,
            folder_path: folderPathStr,
            margin_multiplier: margin,
          }, { onConflict: "category_id,folder_path" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-folder-margins"] });
    },
    onError: (error) => {
      console.error("Error updating folder margin:", error);
      toast.error("Fehler beim Aktualisieren der Ordner-Marge");
    },
  });

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p: any) =>
        p.name.toLowerCase().includes(q) ||
        (p.article_number && p.article_number.toLowerCase().includes(q)) ||
        (p.supplier && p.supplier.toLowerCase().includes(q))
      );
    }

    // Extract numeric size values from a product name for size sorting
    const extractSize = (name: string): number => {
      const numbers = name.match(/\d+([.,]\d+)?/g);
      if (!numbers) return 0;
      // Use the first number found as primary sort value
      return parseFloat(numbers[0].replace(",", "."));
    };

    // Sort
    const sorted = [...filtered].sort((a: any, b: any) => {
      switch (sortOption) {
        case "name-asc":
          return a.name.localeCompare(b.name, "de");
        case "name-desc":
          return b.name.localeCompare(a.name, "de");
        case "size-asc":
          return extractSize(a.name) - extractSize(b.name);
        case "size-desc":
          return extractSize(b.name) - extractSize(a.name);
        case "article-number":
          return (a.article_number || "zzz").localeCompare(b.article_number || "zzz");
        case "price-asc": {
          const priceA = (a.calculator_product_items || []).reduce((s: number, i: any) => s + Number(i.price), 0);
          const priceB = (b.calculator_product_items || []).reduce((s: number, i: any) => s + Number(i.price), 0);
          return priceA - priceB;
        }
        case "price-desc": {
          const priceA2 = (a.calculator_product_items || []).reduce((s: number, i: any) => s + Number(i.price), 0);
          const priceB2 = (b.calculator_product_items || []).reduce((s: number, i: any) => s + Number(i.price), 0);
          return priceB2 - priceA2;
        }
        case "date-desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    return sorted;
  }, [products, searchQuery, sortOption]);

  // Grouped items for folder view
  const groupedItems = useMemo((): GroupEntry[] => {
    if (viewMode !== "folder") return [];
    const articlesAtPath = getArticlesAtPath(filteredAndSortedProducts, folderPath);
    return groupByWordIndex(articlesAtPath, folderPath.length);
  }, [filteredAndSortedProducts, viewMode, folderPath]);

  // Selection helpers
  const getArticleIdsForFolder = (folderWord: string): string[] => {
    const path = [...folderPath, folderWord];
    return getArticlesAtPath(filteredAndSortedProducts, path).map((a: any) => a.id);
  };

  const toggleFolderSelection = (folderWord: string, selected: boolean) => {
    const ids = getArticleIdsForFolder(folderWord);
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => selected ? next.add(id) : next.delete(id));
      return next;
    });
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
  };

  const isFolderSelected = (folderWord: string): boolean => {
    const ids = getArticleIdsForFolder(folderWord);
    return ids.length > 0 && ids.every(id => selectedIds.has(id));
  };

  const isFolderPartiallySelected = (folderWord: string): boolean => {
    const ids = getArticleIdsForFolder(folderWord);
    return ids.some(id => selectedIds.has(id)) && !ids.every(id => selectedIds.has(id));
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete in chunks of 200
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await supabase
          .from("calculator_products")
          .delete()
          .in("id", chunk);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-products"] });
      queryClient.invalidateQueries({ queryKey: ["calculator-categories-with-count"] });
      toast.success(`${selectedIds.size} Produkt${selectedIds.size !== 1 ? "e" : ""} gelöscht`);
      exitSelectionMode();
      setShowBulkDeleteDialog(false);
    },
    onError: () => {
      toast.error("Fehler beim Löschen");
    },
  });

  // Reset folder path when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setFolderPath([]);
  };

  const handleBreadcrumbNavigate = (index: number) => {
    if (index < 0) {
      setFolderPath([]);
    } else {
      setFolderPath((prev) => prev.slice(0, index + 1));
    }
  };
  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async ({ name, unitType, baseQuantity, articleNumber }: { name: string; unitType: UnitType; baseQuantity: number; articleNumber?: string }) => {
      if (!profile?.company_id || !user || !category) throw new Error("Nicht authentifiziert");

      const insertData: any = {
        category_id: category.id,
        company_id: profile.company_id,
        name,
        unit_type: unitType,
        base_quantity: baseQuantity,
        created_by: user.id,
      };

      if (articleNumber?.trim()) {
        insertData.article_number = articleNumber.trim();
      }

      const { data, error } = await supabase
        .from("calculator_products")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-products"] });
      setNewProductName("");
      setNewProductUnit("meter");
      setNewProductBaseQuantity("1");
      setNewProductArticleNumber("");
      setIsDialogOpen(false);
      toast.success("Produkt erstellt");
    },
    onError: (error) => {
      console.error("Error creating product:", error);
      toast.error("Fehler beim Erstellen des Produkts");
    },
  });

  // Update category margin mutation
  const updateCategoryMarginMutation = useMutation({
    mutationFn: async (margin: number) => {
      if (!category) throw new Error("Keine Kategorie");
      const { error } = await supabase
        .from("calculator_categories")
        .update({ default_margin_multiplier: margin })
        .eq("id", category.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-category"] });
      queryClient.invalidateQueries({ queryKey: ["calculator-products"] });
    },
    onError: (error) => {
      console.error("Error updating category margin:", error);
      toast.error("Fehler beim Aktualisieren der Marge");
    },
  });

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProductName.trim()) {
      createProductMutation.mutate({
        name: newProductName.trim(),
        unitType: newProductUnit,
        baseQuantity: parseFloat(newProductBaseQuantity) || 1,
        articleNumber: newProductArticleNumber,
      });
    }
  };

  if (categoryLoading || productsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Kategorie nicht gefunden</p>
          <Button onClick={() => navigate(ownerAwarePath(location.pathname, "/calculator/parameters"))}>
            Zurück zu den Parametern
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-background">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(ownerAwarePath(location.pathname, "/calculator/parameters"))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">{category.name}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Sticky Toolbar */}
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border pb-3 pt-1 -mx-4 px-4">
            <div className="flex flex-col gap-2">
              {/* Row 1: Info + Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {products.length} Produkt{products.length !== 1 ? "e" : ""}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">x</span>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={category.default_margin_multiplier ?? 1}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (val > 0) updateCategoryMarginMutation.mutate(val);
                      }}
                      className="w-16 h-7 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant={selectionMode ? "default" : "outline"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                    title={selectionMode ? "Auswahl beenden" : "Auswählen"}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "outline" : "default"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => { setViewMode(viewMode === "list" ? "folder" : "list"); setFolderPath([]); exitSelectionMode(); }}
                    title={viewMode === "list" ? "Ordneransicht" : "Listenansicht"}
                  >
                    {viewMode === "list" ? <FolderTree className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                  </Button>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="h-9 gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Neues Produkt</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Neues Produkt erstellen</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateProduct} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="product-name">Name</Label>
                          <Input
                            id="product-name"
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                            placeholder="z.B. Fenster 2-flügelig..."
                            autoFocus
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="product-article-number">
                            Artikelnummer <span className="text-muted-foreground">(optional)</span>
                          </Label>
                          <Input
                            id="product-article-number"
                            value={newProductArticleNumber}
                            onChange={(e) => setNewProductArticleNumber(e.target.value)}
                            placeholder="z.B. 12345"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="product-unit">Einheit</Label>
                          <Select
                            value={newProductUnit}
                            onValueChange={(value: UnitType) => setNewProductUnit(value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(unitLabels).map(([value, { label, icon: Icon }]) => (
                                <SelectItem key={value} value={value}>
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    <span>{label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {newProductUnit !== "piece" && (
                          <div className="space-y-2">
                            <Label htmlFor="product-base-quantity">Basismenge</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="product-base-quantity"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={newProductBaseQuantity}
                                onChange={(e) => setNewProductBaseQuantity(e.target.value)}
                                className="w-24"
                              />
                              <span className="text-sm text-muted-foreground">
                                {unitLabels[newProductUnit].label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Für wie viele {unitLabels[newProductUnit].shortLabel} gilt der Gesamtpreis?
                            </p>
                          </div>
                        )}
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Abbrechen
                          </Button>
                          <Button type="submit" disabled={!newProductName.trim() || createProductMutation.isPending}>
                            Erstellen
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {/* Row 2: Search + Sort */}
              {products.length > 0 && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Suchen..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                    <SelectTrigger className="w-[160px] h-9">
                      <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(sortLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Breadcrumb */}
              {viewMode === "folder" && folderPath.length > 0 && category && (
                <CategoryBreadcrumb
                  categoryName={category.name}
                  path={folderPath}
                  onNavigate={handleBreadcrumbNavigate}
                />
              )}
            </div>
          </div>

          {/* Product List */}
          {products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Keine Produkte vorhanden.</p>
              <Button size="sm" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Erstes Produkt erstellen
              </Button>
            </div>
          ) : filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Keine Ergebnisse für „{searchQuery}"</p>
            </div>
          ) : viewMode === "folder" ? (
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/50">
              {groupedItems.map((entry, i) =>
                entry.type === "folder" ? (
                  <FolderCard
                    key={`folder-${entry.word}-${i}`}
                    name={entry.word}
                    count={entry.count}
                    onClick={() => setFolderPath((prev) => [...prev, entry.word])}
                    margin={(() => {
                      const pathKey = [...folderPath, entry.word].join("/");
                      const found = folderMargins.find((fm: any) => fm.folder_path === pathKey);
                      return found ? found.margin_multiplier : null;
                    })()}
                    categoryMargin={getFolderMarginForPath(folderPath) ?? category?.default_margin_multiplier ?? 1}
                    onMarginChange={(margin) => {
                      const pathKey = [...folderPath, entry.word].join("/");
                      upsertFolderMarginMutation.mutate({ folderPathStr: pathKey, margin });
                    }}
                    selectionMode={selectionMode}
                    isSelected={isFolderSelected(entry.word)}
                    isPartiallySelected={isFolderPartiallySelected(entry.word)}
                    onSelectionChange={(selected) => toggleFolderSelection(entry.word, selected)}
                  />
                ) : (
                  <div key={entry.product.id} className="flex items-center">
                    {selectionMode && (
                      <div className="pl-3 pr-1 py-2.5">
                        <Checkbox
                          checked={selectedIds.has(entry.product.id)}
                          onCheckedChange={() => toggleProductSelection(entry.product.id)}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CalculatorProductCard
                        product={entry.product}
                        unitLabel={unitLabels[entry.product.unit_type as UnitType]}
                        categoryMargin={getEffectiveMarginForProduct(entry.product)}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/50">
              {filteredAndSortedProducts.map((product: any) => (
                <div key={product.id} className="flex items-center">
                  {selectionMode && (
                    <div className="pl-3 pr-1 py-2.5">
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onCheckedChange={() => toggleProductSelection(product.id)}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CalculatorProductCard
                      product={product}
                      unitLabel={unitLabels[product.unit_type as UnitType]}
                      categoryMargin={getEffectiveMarginForProduct(product)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bulk Delete Bar */}
          {selectionMode && selectedIds.size > 0 && (
            <div className="sticky bottom-4 mx-auto w-fit bg-destructive text-destructive-foreground rounded-full px-4 py-2 shadow-lg flex items-center gap-3 z-30">
              <span className="text-sm font-medium">
                {selectedIds.size} ausgewählt
              </span>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 gap-1.5"
                onClick={() => setShowBulkDeleteDialog(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Löschen
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedIds.size} Produkt{selectedIds.size !== 1 ? "e" : ""} löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle ausgewählten Produkte werden dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Löschen..." : "Endgültig löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CalculatorCategoryPage;
