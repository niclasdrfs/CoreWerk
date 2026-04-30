import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTabNavigate } from "@/hooks/useTabNavigate";
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
import { ArrowLeft, Plus, FolderOpen, MoreVertical, Pencil, Trash2, Settings2, Package, Upload, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { DataImportDialog } from "@/components/calculator/DataImportDialog";
import { Checkbox } from "@/components/ui/checkbox";

const CalculatorParametersPage = () => {
  const { user } = useAuth();
  const navigate = useTabNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [renameCategoryName, setRenameCategoryName] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
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

  // Fetch categories with product count
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["calculator-categories-with-count", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data: cats, error } = await supabase
        .from("calculator_categories")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Get product counts
      const { data: products } = await supabase
        .from("calculator_products")
        .select("category_id")
        .eq("company_id", profile.company_id);

      const productCounts = products?.reduce((acc: Record<string, number>, p) => {
        acc[p.category_id] = (acc[p.category_id] || 0) + 1;
        return acc;
      }, {}) || {};

      return cats.map(cat => ({
        ...cat,
        productCount: productCounts[cat.id] || 0,
      }));
    },
    enabled: !!profile?.company_id,
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!profile?.company_id || !user) throw new Error("Nicht authentifiziert");
      
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]+/g, "-")
        .replace(/^-|-$/g, "");

      const { data, error } = await supabase
        .from("calculator_categories")
        .insert({
          company_id: profile.company_id,
          name,
          slug,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["calculator-categories-with-count"],
        refetchType: 'all'
      });
      setNewCategoryName("");
      setIsDialogOpen(false);
      toast.success("Kategorie erstellt");
    },
    onError: (error) => {
      console.error("Error creating category:", error);
      toast.error("Fehler beim Erstellen der Kategorie");
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from("calculator_categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["calculator-categories-with-count"],
        refetchType: 'all'
      });
      setShowDeleteDialog(false);
      setSelectedCategory(null);
      toast.success("Kategorie gelöscht");
    },
    onError: (error) => {
      console.error("Error deleting category:", error);
      toast.error("Fehler beim Löschen der Kategorie");
    },
  });

  // Rename category mutation
  const renameCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]+/g, "-")
        .replace(/^-|-$/g, "");

      const { error } = await supabase
        .from("calculator_categories")
        .update({ name, slug })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["calculator-categories-with-count"],
        refetchType: 'all'
      });
      setShowRenameDialog(false);
      setSelectedCategory(null);
      toast.success("Kategorie umbenannt");
    },
    onError: (error) => {
      console.error("Error renaming category:", error);
      toast.error("Fehler beim Umbenennen der Kategorie");
    },
  });

  // Bulk delete categories mutation
  const bulkDeleteCategoriesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await supabase
          .from("calculator_categories")
          .delete()
          .in("id", chunk);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculator-categories-with-count"], refetchType: 'all' });
      toast.success(`${selectedCategoryIds.size} Kategorie${selectedCategoryIds.size !== 1 ? "n" : ""} gelöscht`);
      exitSelectionMode();
      setShowBulkDeleteDialog(false);
    },
    onError: () => {
      toast.error("Fehler beim Löschen");
    },
  });

  const toggleCategorySelection = (id: string) => {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedCategoryIds(new Set());
  };

  const selectAll = useCallback(() => {
    setSelectedCategoryIds(new Set(categories.map((c) => c.id)));
  }, [categories]);

  // Ctrl+A / Cmd+A to select all in selection mode
  useEffect(() => {
    if (!selectionMode) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectionMode, selectAll]);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      createCategoryMutation.mutate(newCategoryName.trim());
    }
  };

  const handleRenameCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategory && renameCategoryName.trim()) {
      renameCategoryMutation.mutate({
        id: selectedCategory.id,
        name: renameCategoryName.trim(),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-background">
      <header className="border-b border-amber-500/20 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold flex-1">Artikel hinzufügen</h1>
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Sticky Toolbar */}
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border pb-3 pt-1 -mx-4 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground">
                  {categories.length} Kategorie{categories.length !== 1 ? "n" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {categories.length > 0 && (
                  <Button
                    variant={selectionMode ? "default" : "outline"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                    title={selectionMode ? "Auswahl beenden" : "Auswählen"}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                  </Button>
                )}
                {selectionMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={selectAll}
                  >
                    Alles auswählen
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setShowImportDialog(true)}>
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Importieren</span>
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-9 gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Neue Kategorie</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Neue Kategorie erstellen</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateCategory} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="category-name">Name</Label>
                        <Input
                          id="category-name"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="z.B. Fenster, Türen, Fassade..."
                          autoFocus
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Abbrechen
                        </Button>
                        <Button type="submit" disabled={!newCategoryName.trim() || createCategoryMutation.isPending}>
                          Erstellen
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Categories List */}
          {categories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Keine Kategorien vorhanden.</p>
              <Button size="sm" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Erste Kategorie erstellen
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/50">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-3 py-2.5 px-3 cursor-pointer hover:bg-muted/40 transition-colors group"
                  onClick={() => {
                    if (selectionMode) {
                      toggleCategorySelection(category.id);
                    } else {
                      navigate(`/owner/calculator/${category.slug}`);
                    }
                  }}
                >
                  {selectionMode && (
                    <Checkbox
                      checked={selectedCategoryIds.has(category.id)}
                      onCheckedChange={() => toggleCategorySelection(category.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                  )}
                  <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium text-sm flex-1 truncate">{category.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {category.productCount} Produkt{category.productCount !== 1 ? "e" : ""}
                  </span>
                  {!selectionMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCategory(category);
                          setRenameCategoryName(category.name);
                          setShowRenameDialog(true);
                        }}>
                          <Pencil className="w-3.5 h-3.5 mr-2" />
                          Umbenennen
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCategory(category);
                            setShowDeleteDialog(true);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Bulk Delete Bar */}
          {selectionMode && selectedCategoryIds.size > 0 && (
            <div className="sticky bottom-4 mx-auto w-fit bg-destructive text-destructive-foreground rounded-full px-4 py-2 shadow-lg flex items-center gap-3 z-30">
              <span className="text-sm font-medium">
                {selectedCategoryIds.size} ausgewählt
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

      {/* Single Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie "{selectedCategory?.name}" wirklich löschen? Alle Produkte in dieser Kategorie werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedCategory && deleteCategoryMutation.mutate(selectedCategory.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedCategoryIds.size} Kategorie{selectedCategoryIds.size !== 1 ? "n" : ""} löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Produkte in den ausgewählten Kategorien werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteCategoriesMutation.mutate(Array.from(selectedCategoryIds))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteCategoriesMutation.isPending}
            >
              {bulkDeleteCategoriesMutation.isPending ? "Löschen..." : "Endgültig löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategorie umbenennen</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameCategory} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-category">Name</Label>
              <Input
                id="rename-category"
                value={renameCategoryName}
                onChange={(e) => setRenameCategoryName(e.target.value)}
                autoFocus
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
                disabled={!renameCategoryName.trim() || renameCategoryMutation.isPending}
              >
                Speichern
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      {profile?.company_id && (
        <DataImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          companyId={profile.company_id}
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["calculator-categories-with-count"] });
          }}
        />
      )}
    </div>
  );
};

export default CalculatorParametersPage;
