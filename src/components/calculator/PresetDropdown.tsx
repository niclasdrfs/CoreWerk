import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookmarkPlus, ChevronDown, Search, Package, MoreVertical, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { SelectedProduct } from "./QuoteCalculatorDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PresetProduct {
  productId: string;
  quantity: number;
  name: string;
  unitType: string;
}

interface Preset {
  id: string;
  name: string;
  products: PresetProduct[];
  created_at: string;
}

interface PresetDropdownProps {
  companyId: string | null;
  selectedProducts: SelectedProduct[];
  onLoadPreset: (products: PresetProduct[]) => void;
}

export const PresetDropdown = ({ companyId, selectedProducts, onLoadPreset }: PresetDropdownProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveName, setSaveName] = useState("");
  const [showSavePopover, setShowSavePopover] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [editName, setEditName] = useState("");

  const { data: presets = [] } = useQuery({
    queryKey: ["calculator-presets", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("calculator_presets")
        .select("*")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        products: (p.products as unknown as PresetProduct[]) || [],
      })) as Preset[];
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!companyId || !user) throw new Error("Nicht authentifiziert");
      const presetProducts: PresetProduct[] = selectedProducts.map(p => ({
        productId: p.productId,
        quantity: p.quantity,
        name: p.name,
        unitType: p.unitType,
      }));
      const { error } = await supabase
        .from("calculator_presets")
        .insert({
          company_id: companyId,
          created_by: user.id,
          name,
          products: presetProducts as unknown as any,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-presets"] });
      toast.success("Preset gespeichert");
      setSaveName("");
      setShowSavePopover(false);
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calculator_presets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-presets"] });
      toast.success("Preset gelöscht");
      setDeleteId(null);
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("calculator_presets").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-presets"] });
      toast.success("Preset umbenannt");
      setEditingPreset(null);
    },
    onError: () => toast.error("Fehler beim Umbenennen"),
  });

  const filteredPresets = presets.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLoadPreset = (preset: Preset) => {
    onLoadPreset(preset.products);
    setOpen(false);
    toast.success(`Preset "${preset.name}" geladen – Mengen können angepasst werden`);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Load Preset Dropdown */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 flex-1 justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>Preset laden</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Preset suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
            <ScrollArea className="max-h-[250px]">
              {filteredPresets.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {presets.length === 0 ? "Noch keine Presets vorhanden" : "Kein Preset gefunden"}
                </div>
              ) : (
                <div className="p-1">
                  {filteredPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center gap-2 rounded-md hover:bg-accent px-3 py-2 group"
                    >
                      <button
                        className="flex-1 text-left"
                        onClick={() => handleLoadPreset(preset)}
                      >
                        <div className="font-medium text-sm">{preset.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {preset.products.length} Produkt{preset.products.length !== 1 ? "e" : ""}
                        </div>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingPreset(preset); setEditName(preset.name); }}>
                            <Pencil className="w-3.5 h-3.5 mr-2" />
                            Umbenennen
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteId(preset.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Save as Preset */}
        <Popover open={showSavePopover} onOpenChange={setShowSavePopover}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              disabled={selectedProducts.length === 0}
              title="Aktuelle Auswahl als Preset speichern"
            >
              <BookmarkPlus className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-3">
              <p className="text-sm font-medium">Preset speichern</p>
              <Input
                placeholder="Preset-Name..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && saveName.trim()) saveMutation.mutate(saveName.trim());
                }}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowSavePopover(false)}>
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  disabled={!saveName.trim()}
                  onClick={() => saveMutation.mutate(saveName.trim())}
                >
                  Speichern
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preset löschen?</AlertDialogTitle>
            <AlertDialogDescription>Das Preset wird dauerhaft gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <AlertDialog open={!!editingPreset} onOpenChange={() => setEditingPreset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preset umbenennen</AlertDialogTitle>
          </AlertDialogHeader>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && editName.trim() && editingPreset) {
                renameMutation.mutate({ id: editingPreset.id, name: editName.trim() });
              }
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={!editName.trim()}
              onClick={() => editingPreset && renameMutation.mutate({ id: editingPreset.id, name: editName.trim() })}
            >
              Speichern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
