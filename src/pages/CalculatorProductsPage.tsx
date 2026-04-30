import { useState, useCallback } from "react";
import { Package, Plus, ChevronLeft, Pencil, Trash2, GripVertical } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ConfiguratorCategoryDialog } from "@/components/configurator/ConfiguratorCategoryDialog";
import { ConfiguratorBlockDialog } from "@/components/configurator/ConfiguratorBlockDialog";

const BLOCK_TYPE_LABELS: Record<string, string> = {
  article: "Artikelzuweisung",
  yes_no: "Ja/Nein-Option",
  labor: "Arbeitsstunden",
  travel: "Anfahrtskosten",
  selection: "Auswahl",
  fixed_cost: "Festkosten",
};

const BLOCK_TYPE_COLORS: Record<string, string> = {
  article: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  yes_no: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  labor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  travel: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  selection: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  fixed_cost: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
};

const CalculatorProductsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<any>(null);

  // Fetch company_id from profile
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const companyId = profile?.company_id;

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["configurator-categories", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_configurator_categories")
        .select("*, product_configurator_blocks(count)")
        .eq("company_id", companyId!)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch blocks for selected category
  const { data: blocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: ["configurator-blocks", selectedCategoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_configurator_blocks")
        .select("*")
        .eq("category_id", selectedCategoryId!)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCategoryId,
  });

  // Delete category
  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_configurator_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurator-categories"] });
      toast.success("Kategorie gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  // Delete block
  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_configurator_blocks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurator-blocks"] });
      toast.success("Baustein gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const selectedCategory = categories.find((c: any) => c.id === selectedCategoryId);

  // Block editor view
  if (selectedCategoryId && selectedCategory) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button
          onClick={() => setSelectedCategoryId(null)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zur Übersicht
        </button>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{selectedCategory.name}</h1>
            {selectedCategory.description && (
              <p className="text-muted-foreground text-sm mt-1">{selectedCategory.description}</p>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingBlock(null);
              setBlockDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Baustein
          </Button>
        </div>

        <MaterialEkField category={selectedCategory} />
        <SubItemsList categoryId={selectedCategoryId} companyId={companyId!} />

        {blocksLoading ? (
          <p className="text-muted-foreground text-sm">Laden...</p>
        ) : blocks.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Noch keine Bausteine vorhanden.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setEditingBlock(null);
                setBlockDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Ersten Baustein erstellen
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {blocks.map((block: any) => (
              <BlockCard
                key={block.id}
                block={block}
                onEdit={() => {
                  setEditingBlock(block);
                  setBlockDialogOpen(true);
                }}
                onDelete={() => deleteBlock.mutate(block.id)}
                companyId={companyId!}
              />
            ))}
          </div>
        )}

        <ConfiguratorBlockDialog
          open={blockDialogOpen}
          onOpenChange={setBlockDialogOpen}
          categoryId={selectedCategoryId}
          companyId={companyId!}
          block={editingBlock}
        />
      </div>
    );
  }

  // Categories list view
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-teal-600 dark:text-teal-400" />
          <h1 className="text-2xl font-bold">Produkte</h1>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingCategory(null);
            setCategoryDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Kategorie
        </Button>
      </div>

      <p className="text-muted-foreground mb-6">
        Erstellen Sie Produkt-Kategorien und konfigurieren Sie Bausteine für individuelle Preiskalkulation.
      </p>

      {categoriesLoading ? (
        <p className="text-muted-foreground text-sm">Laden...</p>
      ) : categories.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Noch keine Kategorien vorhanden.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setEditingCategory(null);
              setCategoryDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Erste Kategorie erstellen
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((cat: any) => {
            const blockCount = cat.product_configurator_blocks?.[0]?.count || 0;
            return (
              <Card
                key={cat.id}
                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedCategoryId(cat.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{cat.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {blockCount} {blockCount === 1 ? "Baustein" : "Bausteine"}
                    </Badge>
                  </div>
                  {cat.description && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{cat.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCategory(cat);
                      setCategoryDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCategory.mutate(cat.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfiguratorCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        companyId={companyId!}
        userId={user?.id!}
        category={editingCategory}
      />
    </div>
  );
};

// Material EK fixed field
function MaterialEkField({ category }: { category: any }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<string>(String(category.material_ek ?? 0));
  const [saved, setSaved] = useState(true);

  const mutation = useMutation({
    mutationFn: async (ek: number) => {
      const { error } = await supabase
        .from("product_configurator_categories")
        .update({ material_ek: ek })
        .eq("id", category.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurator-categories"] });
      setSaved(true);
      toast.success("Material EK gespeichert");
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const handleBlur = () => {
    const num = parseFloat(value) || 0;
    if (num !== (category.material_ek ?? 0)) {
      mutation.mutate(num);
    }
  };

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center gap-4">
        <Label htmlFor="material-ek" className="font-medium whitespace-nowrap">
          Material EK
        </Label>
        <div className="relative flex-1 max-w-[200px]">
          <Input
            id="material-ek"
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBlur();
            }}
            className="pr-8"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
        </div>
        {!saved && (
          <span className="text-xs text-muted-foreground">Nicht gespeichert</span>
        )}
      </div>
    </Card>
  );
}

// Subcategories (Unterkategorien) with name + price/meter
function SubItemsList({ categoryId, companyId }: { categoryId: string; companyId: string }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["configurator-sub-items", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_configurator_sub_items")
        .select("*")
        .eq("category_id", categoryId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("product_configurator_sub_items")
        .insert({
          category_id: categoryId,
          company_id: companyId,
          name: newName.trim(),
          price_per_meter: parseFloat(newPrice) || 0,
          display_order: items.length,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurator-sub-items", categoryId] });
      setNewName("");
      setNewPrice("");
      toast.success("Unterkategorie hinzugefügt");
    },
    onError: () => toast.error("Fehler beim Hinzufügen"),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, name, price_per_meter, meters }: { id: string; name: string; price_per_meter: number; meters: number }) => {
      const { error } = await supabase
        .from("product_configurator_sub_items")
        .update({ name, price_per_meter, meters })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurator-sub-items", categoryId] });
      toast.success("Gespeichert");
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_configurator_sub_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurator-sub-items", categoryId] });
      toast.success("Unterkategorie gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  return (
    <Card className="p-4 mb-6">
      <Label className="font-medium mb-3 block">Unterkategorien (Preis/Meter)</Label>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laden...</p>
      ) : (
        <div className="space-y-2 mb-3">
          {items.map((item: any) => (
            <SubItemRow
              key={item.id}
              item={item}
              onSave={(name, price, meters) => updateItem.mutate({ id: item.id, name, price_per_meter: price, meters })}
              onDelete={() => deleteItem.mutate(item.id)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          placeholder="Name eingeben..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1"
        />
        <div className="relative w-[130px] shrink-0">
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            className="pr-10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">€/m</span>
        </div>
        <Button
          size="sm"
          onClick={() => addItem.mutate()}
          disabled={!newName.trim() || addItem.isPending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function SubItemRow({ item, onSave, onDelete }: { item: any; onSave: (name: string, price: number, meters: number) => void; onDelete: () => void }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price_per_meter));
  const [meters, setMeters] = useState(String(item.meters ?? 0));
  const dirty = name !== item.name || parseFloat(price) !== item.price_per_meter || parseFloat(meters) !== (item.meters ?? 0);

  const handleSave = () => {
    if (dirty) onSave(name, parseFloat(price) || 0, parseFloat(meters) || 0);
  };

  const total = (parseFloat(price) || 0) * (parseFloat(meters) || 0);

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        className="flex-1"
      />
      <div className="relative w-[120px] shrink-0">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">€/m</span>
      </div>
      <div className="relative w-[100px] shrink-0">
        <Input
          type="number"
          step="0.1"
          min="0"
          value={meters}
          onChange={(e) => setMeters(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="pr-6"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">m</span>
      </div>
      <span className="w-[80px] shrink-0 text-right text-sm font-medium tabular-nums">
        {total.toFixed(2)} €
      </span>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

const UNIT_OPTIONS = [
  { value: "meter", label: "Meter (m)", suffix: "m" },
  { value: "work_hours", label: "Arbeitsstunden", suffix: "Std." },
  { value: "eur_per_hour", label: "€/Stunde", suffix: "Std." },
  { value: "eur_per_day", label: "€/Tag", suffix: "Tage" },
];

function BlockCard({ block, onEdit, onDelete, companyId }: { block: any; onEdit: () => void; onDelete: () => void; companyId: string }) {
  const queryClient = useQueryClient();
  const config = block.config || {};
  const [unit, setUnit] = useState(config.unit || "");
  const [quantity, setQuantity] = useState<number>(config.quantity || 0);
  const [rate, setRate] = useState<number>(config.rate || 0);

  const updateBlockConfig = useMutation({
    mutationFn: async (newConfig: any) => {
      const { error } = await supabase
        .from("product_configurator_blocks")
        .update({ config: { ...config, ...newConfig } })
        .eq("id", block.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurator-blocks"] });
    },
  });

  const handleUnitChange = (v: string) => {
    setUnit(v);
    updateBlockConfig.mutate({ unit: v, quantity, rate });
  };

  const handleBlur = () => {
    updateBlockConfig.mutate({ unit, quantity, rate });
  };

  const total = quantity * rate;
  const unitInfo = UNIT_OPTIONS.find((u) => u.value === unit);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{block.name}</span>
            <Badge variant="secondary" className={BLOCK_TYPE_COLORS[block.block_type] || ""}>
              {BLOCK_TYPE_LABELS[block.block_type] || block.block_type}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Select value={unit} onValueChange={handleUnitChange}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Einheit…" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {UNIT_OPTIONS.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={rate || ""}
            onChange={(e) => setRate(Number(e.target.value))}
            onBlur={handleBlur}
            placeholder="Satz"
            className="w-20 h-8 text-xs"
          />
          <span className="text-xs text-muted-foreground">€{unitInfo ? `/${unitInfo.suffix}` : ""}</span>
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={quantity || ""}
            onChange={(e) => setQuantity(Number(e.target.value))}
            onBlur={handleBlur}
            placeholder="Menge"
            className="w-20 h-8 text-xs"
          />
          <span className="text-xs text-muted-foreground">{unitInfo?.suffix || ""}</span>
        </div>
        <div className="ml-auto font-semibold text-sm">
          = {total.toFixed(2)} €
        </div>
      </div>
    </Card>
  );
}

export default CalculatorProductsPage;
