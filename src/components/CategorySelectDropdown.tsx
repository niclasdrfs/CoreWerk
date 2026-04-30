import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tag, Plus, Check, X, Trash2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface CategorySelectDropdownProps {
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  disabled?: boolean;
}

export const CategorySelectDropdown = ({
  selectedCategoryId,
  onCategoryChange,
  disabled = false,
}: CategorySelectDropdownProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [open, setOpen] = useState(false);
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

  // Get current category name
  const currentCategoryName = categories.find(c => c.id === selectedCategoryId)?.name;

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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["construction-site-categories"] });
      setNewCategoryName("");
      setIsAdding(false);
      onCategoryChange(data.id);
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

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from("construction_site_categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;
      return categoryId;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["construction-site-categories"] });
      queryClient.invalidateQueries({ queryKey: ["owner-sites-hours"] });
      queryClient.invalidateQueries({ queryKey: ["archived-sites"] });
      if (selectedCategoryId === deletedId) {
        onCategoryChange(null);
      }
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

  const handleSelectCategory = (categoryId: string | null) => {
    onCategoryChange(categoryId);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          disabled={disabled}
        >
          {currentCategoryName ? (
            <span className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              {currentCategoryName}
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Kategorie auswählen
            </span>
          )}
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] bg-popover">
        {categories.length > 0 && (
          <>
            {categories.map((category) => (
              <DropdownMenuItem
                key={category.id}
                className="flex items-center justify-between cursor-pointer"
                onClick={() => handleSelectCategory(category.id)}
              >
                <div className="flex items-center gap-2">
                  {selectedCategoryId === category.id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                  <span className={selectedCategoryId === category.id ? "font-medium" : ""}>
                    {category.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => handleDeleteCategory(e, category.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuItem>
            ))}
            {selectedCategoryId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-muted-foreground cursor-pointer"
                  onClick={() => handleSelectCategory(null)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Keine Kategorie
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
  );
};
