import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tag, Plus, Check, X, Trash2, Ruler } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { CategoryParametersDialog } from "./CategoryParametersDialog";

interface SiteCategoryDropdownProps {
  siteId: string;
  currentCategoryId: string | null;
  currentCategoryName?: string | null;
}

export const SiteCategoryDropdown = ({
  siteId,
  currentCategoryId,
  currentCategoryName,
}: SiteCategoryDropdownProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [open, setOpen] = useState(false);
  const [parametersCategory, setParametersCategory] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["construction-site-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_site_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await supabase
        .from("construction_site_categories")
        .insert({
          name,
          company_id: profile.company_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-site-categories"] });
      setNewCategoryName("");
      setIsAdding(false);
      toast.success("Kategorie erstellt");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("Diese Kategorie existiert bereits");
      } else {
        toast.error("Fehler beim Erstellen der Kategorie");
      }
    },
  });

  // Assign category mutation
  const assignCategoryMutation = useMutation({
    mutationFn: async (categoryId: string | null) => {
      const { error } = await supabase
        .from("construction_sites")
        .update({ category_id: categoryId })
        .eq("id", siteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-sites-hours"] });
      queryClient.invalidateQueries({ queryKey: ["archived-sites"] });
      setOpen(false);
    },
    onError: () => {
      toast.error("Fehler beim Zuweisen der Kategorie");
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from("construction_site_categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-site-categories"] });
      queryClient.invalidateQueries({ queryKey: ["owner-sites-hours"] });
      queryClient.invalidateQueries({ queryKey: ["archived-sites"] });
      toast.success("Kategorie gelöscht");
    },
    onError: () => {
      toast.error("Fehler beim Löschen der Kategorie");
    },
  });

  const handleCreateCategory = () => {
    if (newCategoryName.trim()) {
      createCategoryMutation.mutate(newCategoryName.trim());
    }
  };

  const handleDeleteCategory = (e: React.MouseEvent, categoryId: string) => {
    e.stopPropagation();
    deleteCategoryMutation.mutate(categoryId);
  };

  return (
    <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button 
          type="button"
          className="inline-flex items-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full"
        >
          {currentCategoryName ? (
            <Badge 
              variant="secondary" 
              className="cursor-pointer hover:bg-secondary/80 transition-colors"
            >
              {currentCategoryName}
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Tag className="w-3.5 h-3.5" />
              Kategorie
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-popover">
        {categories.length > 0 && (
          <>
            {categories.map((category) => (
              <DropdownMenuItem
                key={category.id}
                className="flex items-center justify-between cursor-pointer"
                onClick={() => assignCategoryMutation.mutate(category.id)}
              >
                <div className="flex items-center gap-2">
                  {currentCategoryId === category.id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                  <span className={currentCategoryId === category.id ? "font-medium" : ""}>
                    {category.name}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      setParametersCategory({ id: category.id, name: category.name });
                    }}
                  >
                    <Ruler className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => handleDeleteCategory(e, category.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))}
            {currentCategoryId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-muted-foreground cursor-pointer"
                  onClick={() => assignCategoryMutation.mutate(null)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Kategorie entfernen
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        {isAdding ? (
          <div className="p-2 space-y-2">
            <Input
              placeholder="Kategorie-Name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCategory();
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewCategoryName("");
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
              >
                <Check className="w-4 h-4 mr-1" />
                Speichern
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setNewCategoryName("");
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              setIsAdding(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Neue Kategorie erstellen
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

      {parametersCategory && (
        <CategoryParametersDialog
          open={!!parametersCategory}
          onOpenChange={(open) => !open && setParametersCategory(null)}
          categoryId={parametersCategory.id}
          categoryName={parametersCategory.name}
        />
      )}
    </>
  );
};

