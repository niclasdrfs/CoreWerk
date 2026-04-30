import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Minus, ShoppingCart, Trash2, X } from "lucide-react";

interface CartItem {
  id: string;
  name: string;
  article_number: string | null;
  unit_price: number;
  quantity: number;
}

interface MaterialPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (total: number, items: CartItem[]) => void;
}

export function MaterialPickerDialog({ open, onOpenChange, onSave }: MaterialPickerDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Get company_id
  const { data: profile } = useQuery({
    queryKey: ["rechner-profile", user?.id],
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

  // Fetch calculator products (articles with prices)
  const { data: products = [] } = useQuery({
    queryKey: ["rechner-catalog", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("calculator_products")
        .select("id, name, article_number, supplier, calculator_product_items(price)")
        .eq("company_id", profile.company_id)
        .order("name");
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        article_number: p.article_number,
        supplier: p.supplier,
        total_price: p.calculator_product_items?.reduce((sum: number, i: any) => sum + (i.price || 0), 0) || 0,
      }));
    },
    enabled: !!profile?.company_id && open,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 50);
    const q = search.toLowerCase();
    return products.filter((p: any) =>
      p.name.toLowerCase().includes(q) ||
      p.article_number?.toLowerCase().includes(q) ||
      p.supplier?.toLowerCase().includes(q)
    ).slice(0, 100);
  }, [products, search]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === product.id);
      if (existing) {
        return prev.map(c => c.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        article_number: product.article_number,
        unit_price: product.total_price,
        quantity: 1,
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newQty = c.quantity + delta;
      return newQty > 0 ? { ...c, quantity: newQty } : c;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  const cartTotal = useMemo(() =>
    cart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0),
    [cart]
  );

  const fmt = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSave = () => {
    onSave(cartTotal, cart);
    setCart([]);
    setSearch("");
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const cartItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Material aus Katalog auswählen
            {cartItemCount > 0 && (
              <Badge className="ml-2">{cartItemCount} Artikel</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">
          {/* Left: Product catalog */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Artikel suchen (Name, Artikelnr., Lieferant)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Badge variant="secondary" className="mb-2 w-fit text-xs">
              {filtered.length} von {products.length} Artikel
            </Badge>
            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="space-y-1 pr-3">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Keine Artikel gefunden
                  </p>
                ) : (
                  filtered.map((product: any) => {
                    const inCart = cart.find(c => c.id === product.id);
                    return (
                      <div
                        key={product.id}
                        className={`flex items-center justify-between p-2 rounded-md border text-sm hover:bg-accent/50 cursor-pointer transition-colors ${
                          inCart ? "border-primary/30 bg-primary/5" : "border-border"
                        }`}
                        onClick={() => addToCart(product)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{product.name}</div>
                          <div className="text-xs text-muted-foreground flex gap-2">
                            {product.article_number && <span>#{product.article_number}</span>}
                            {product.supplier && <span>· {product.supplier}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className="font-mono text-sm whitespace-nowrap">{fmt(product.total_price)} €</span>
                          {inCart ? (
                            <Badge variant="default" className="text-xs">{inCart.quantity}×</Badge>
                          ) : (
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right: Cart */}
          <div className="w-64 flex flex-col min-h-0 border-l pl-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Warenkorb
            </h3>
            {cart.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Klicke auf Artikel um sie hinzuzufügen
              </p>
            ) : (
              <ScrollArea className="flex-1 max-h-[45vh]">
                <div className="space-y-2 pr-2">
                  {cart.map((item) => (
                    <div key={item.id} className="border rounded-md p-2 text-sm space-y-1">
                      <div className="font-medium text-xs truncate">{item.name}</div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center font-mono text-xs">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">{fmt(item.unit_price * item.quantity)} €</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {cart.length > 0 && (
              <>
                <Separator className="my-2" />
                <div className="flex items-center justify-between font-semibold text-sm">
                  <span>Gesamt</span>
                  <span className="font-mono text-primary">{fmt(cartTotal)} €</span>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={cart.length === 0}>
            <ShoppingCart className="h-4 w-4 mr-1" />
            Speichern ({fmt(cartTotal)} €)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
