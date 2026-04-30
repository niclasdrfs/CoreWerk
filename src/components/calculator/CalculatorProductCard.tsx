import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChevronDown, Plus, Trash2, Euro, MoreVertical, Pencil, Hash, TrendingUp, Check } from "lucide-react";
import { toast } from "sonner";

interface ProductItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  display_order: number;
}

interface Product {
  id: string;
  name: string;
  unit_type: string;
  base_quantity: number;
  article_number?: string | null;
  supplier?: string | null;
  margin_multiplier?: number | null;
  calculator_product_items: ProductItem[];
}

interface CalculatorProductCardProps {
  product: Product;
  unitLabel: { label: string; shortLabel: string; icon: React.ElementType };
  categoryMargin?: number;
}

export const CalculatorProductCard = ({
  product,
  unitLabel,
  categoryMargin = 1,
}: CalculatorProductCardProps) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newProductName, setNewProductName] = useState(product.name);
  const [newArticleNumber, setNewArticleNumber] = useState(product.article_number || "");
  const [bufferedMargin, setBufferedMargin] = useState<string>(product.margin_multiplier != null ? product.margin_multiplier.toString() : "");
  const [showMarginInput, setShowMarginInput] = useState(false);

  const items = product.calculator_product_items || [];
  const totalPrice = items.reduce((sum, item) => sum + Number(item.price), 0);
  const pricePerUnit = product.base_quantity > 0 ? totalPrice / product.base_quantity : totalPrice;
  const effectiveMargin = product.margin_multiplier ?? categoryMargin;
  const vkPerUnit = pricePerUnit * effectiveMargin;
  const Icon = unitLabel.icon;

  // Update margin mutation
  const updateMarginMutation = useMutation({
    mutationFn: async (margin: number | null) => {
      const { error } = await supabase
        .from("calculator_products")
        .update({ margin_multiplier: margin })
        .eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-products"] });
    },
    onError: (error) => {
      console.error("Error updating margin:", error);
      toast.error("Fehler beim Aktualisieren der Marge");
    },
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async ({ name, price }: { name: string; price: number }) => {
      const { data, error } = await supabase
        .from("calculator_product_items")
        .insert({
          product_id: product.id,
          name,
          price,
          display_order: items.length,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-products"] });
      setNewItemName("");
      setNewItemPrice("");
      toast.success("Posten hinzugefügt");
    },
    onError: (error) => {
      console.error("Error adding item:", error);
      toast.error("Fehler beim Hinzufügen");
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("calculator_product_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-products"] });
      toast.success("Posten gelöscht");
    },
    onError: (error) => {
      console.error("Error deleting item:", error);
      toast.error("Fehler beim Löschen");
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      name,
      price,
    }: {
      itemId: string;
      name: string;
      price: number;
    }) => {
      const { error } = await supabase
        .from("calculator_product_items")
        .update({ name, price })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-products"] });
    },
    onError: (error) => {
      console.error("Error updating item:", error);
      toast.error("Fehler beim Aktualisieren");
    },
  });

  // Update product base quantity
  const updateBaseQuantityMutation = useMutation({
    mutationFn: async (baseQuantity: number) => {
      const { error } = await supabase
        .from("calculator_products")
        .update({ base_quantity: baseQuantity })
        .eq("id", product.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-products"] });
    },
    onError: (error) => {
      console.error("Error updating base quantity:", error);
      toast.error("Fehler beim Aktualisieren");
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("calculator_products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-products"] });
      toast.success("Produkt gelöscht");
    },
    onError: (error) => {
      console.error("Error deleting product:", error);
      toast.error("Fehler beim Löschen");
    },
  });

  // Rename product mutation
  const renameProductMutation = useMutation({
    mutationFn: async ({ name, articleNumber }: { name: string; articleNumber?: string }) => {
      const updateData: any = { name };
      if (articleNumber !== undefined) {
        updateData.article_number = articleNumber.trim() || null;
      }
      const { error } = await supabase
        .from("calculator_products")
        .update(updateData)
        .eq("id", product.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-products"] });
      setShowRenameDialog(false);
      toast.success("Produkt aktualisiert");
    },
    onError: (error) => {
      console.error("Error renaming product:", error);
      toast.error("Fehler beim Aktualisieren");
    },
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemName.trim() && newItemPrice) {
      addItemMutation.mutate({
        name: newItemName.trim(),
        price: parseFloat(newItemPrice),
      });
    }
  };

  const handleUpdateItem = (item: ProductItem, field: "name" | "price", value: string) => {
    const newName = field === "name" ? value : item.name;
    const newPrice = field === "price" ? parseFloat(value) || 0 : item.price;

    updateItemMutation.mutate({
      itemId: item.id,
      name: newName,
      price: newPrice,
    });
  };

  const handleBaseQuantityChange = (value: string) => {
    const quantity = parseFloat(value) || 1;
    if (quantity > 0) {
      updateBaseQuantityMutation.mutate(quantity);
    }
  };

  const handleRenameProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProductName.trim()) {
      renameProductMutation.mutate({ name: newProductName.trim(), articleNumber: newArticleNumber });
    }
  };

  return (
    <>
      <div>
        {/* Compact product row */}
        <div
          className={`flex items-center gap-2 py-2 px-3 cursor-pointer transition-colors ${isOpen ? "bg-muted/30" : "hover:bg-muted/30"}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-medium truncate">{product.name}</span>
            {product.article_number && (
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{product.article_number}</span>
            )}
            <span className="text-[10px] text-muted-foreground shrink-0">{items.length} Posten</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">
              EK {pricePerUnit.toFixed(2)} €
            </span>
            <span className="text-sm font-medium tabular-nums text-primary">
              {vkPerUnit.toFixed(2)} €
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setNewProductName(product.name);
                  setShowRenameDialog(true);
                }}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Umbenennen
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </div>

        {/* Expanded detail area */}
        {isOpen && (
          <div className="border-l-4 border-l-primary/30 ml-3 pl-3 py-2 space-y-2">
            {/* Margin + Base qty row */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <TrendingUp className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Marge:</span>
              {showMarginInput ? (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">x</span>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={bufferedMargin}
                      placeholder={categoryMargin.toString()}
                      onChange={(e) => setBufferedMargin(e.target.value)}
                      className="w-16 h-6 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-6 gap-1 text-xs px-2"
                    onClick={() => {
                      if (bufferedMargin === "") {
                        updateMarginMutation.mutate(null);
                      } else {
                        const num = parseFloat(bufferedMargin);
                        if (num > 0) updateMarginMutation.mutate(num);
                      }
                      setShowMarginInput(false);
                    }}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                  {product.margin_multiplier !== null && product.margin_multiplier !== undefined && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-6 px-1.5"
                      onClick={() => {
                        updateMarginMutation.mutate(null);
                        setBufferedMargin("");
                        setShowMarginInput(false);
                      }}
                    >
                      Reset
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 gap-1 px-2"
                  onClick={() => {
                    setBufferedMargin(product.margin_multiplier != null ? product.margin_multiplier.toString() : "");
                    setShowMarginInput(true);
                  }}
                >
                  x{effectiveMargin}
                  <Pencil className="w-2.5 h-2.5" />
                </Button>
              )}
              {product.unit_type !== "piece" && (
                <>
                  <span className="text-muted-foreground ml-2">für</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={product.base_quantity}
                    onChange={(e) => handleBaseQuantityChange(e.target.value)}
                    className="w-14 h-6 text-xs"
                  />
                  <span className="text-muted-foreground">{unitLabel.shortLabel}</span>
                </>
              )}
              <span className="ml-auto text-muted-foreground">
                EK {pricePerUnit.toFixed(2)} → VK {vkPerUnit.toFixed(2)} €
              </span>
            </div>

            {/* Items list */}
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={(e) => handleUpdateItem(item, "name", e.target.value)}
                  className="flex-1 h-7 text-xs"
                  placeholder="Posten"
                />
                <div className="relative w-24">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.price}
                    onChange={(e) => handleUpdateItem(item, "price", e.target.value)}
                    className="h-7 text-xs pr-6"
                    placeholder="0.00"
                  />
                  <Euro className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => deleteItemMutation.mutate(item.id)}
                  disabled={deleteItemMutation.isPending}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-[10px] text-muted-foreground italic">Noch keine Posten</p>
            )}

            {/* Add item */}
            <form onSubmit={handleAddItem} className="flex items-center gap-2">
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Neuer Posten..."
                className="flex-1 h-7 text-xs"
              />
              <div className="relative w-24">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="0.00"
                  className="h-7 text-xs pr-6"
                />
                <Euro className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              </div>
              <Button
                type="submit"
                size="icon"
                className="h-6 w-6"
                disabled={!newItemName.trim() || !newItemPrice || addItemMutation.isPending}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Produkt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie "{product.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProductMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produkt umbenennen</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameProduct} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Name</Label>
              <Input
                id="product-name"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-article-number">
                Artikelnummer <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="product-article-number"
                value={newArticleNumber}
                onChange={(e) => setNewArticleNumber(e.target.value)}
                placeholder="z.B. 12345"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRenameDialog(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={!newProductName.trim() || renameProductMutation.isPending}
              >
                Speichern
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
