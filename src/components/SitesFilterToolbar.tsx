import { useState, useMemo } from "react";
import { Search, Filter, ArrowUpDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export type SortOption = "name-asc" | "name-desc" | "created-asc" | "created-desc" | "hours-desc" | "hours-asc";

interface Category {
  id: string;
  name: string;
}

interface SitesFilterToolbarProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showHoursSort?: boolean;
}

export const SitesFilterToolbar = ({
  categories,
  selectedCategoryId,
  onCategoryChange,
  sortOption,
  onSortChange,
  searchQuery,
  onSearchChange,
  showHoursSort = false,
}: SitesFilterToolbarProps) => {
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const getSortLabel = (option: SortOption) => {
    switch (option) {
      case "name-asc":
        return "A → Z";
      case "name-desc":
        return "Z → A";
      case "created-asc":
        return "Älteste zuerst";
      case "created-desc":
        return "Neueste zuerst";
      case "hours-desc":
        return "Meiste Stunden";
      case "hours-asc":
        return "Wenigste Stunden";
      default:
        return "Sortieren";
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Baustelle suchen..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onSearchChange("")}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 shrink-0">
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filter</span>
            {selectedCategory && (
              <Badge variant="secondary" className="ml-1">
                {selectedCategory.name}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Nach Kategorie filtern</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onCategoryChange(null)}
            className={!selectedCategoryId ? "bg-accent" : ""}
          >
            Alle Kategorien
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onCategoryChange("uncategorized")}
            className={selectedCategoryId === "uncategorized" ? "bg-accent" : ""}
          >
            Ohne Kategorie
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {categories.map((category) => (
            <DropdownMenuItem
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              className={selectedCategoryId === category.id ? "bg-accent" : ""}
            >
              {category.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 shrink-0">
            <ArrowUpDown className="w-4 h-4" />
            <span className="hidden sm:inline">{getSortLabel(sortOption)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Sortieren nach</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onSortChange("name-asc")}
            className={sortOption === "name-asc" ? "bg-accent" : ""}
          >
            Name A → Z
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onSortChange("name-desc")}
            className={sortOption === "name-desc" ? "bg-accent" : ""}
          >
            Name Z → A
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onSortChange("created-desc")}
            className={sortOption === "created-desc" ? "bg-accent" : ""}
          >
            Neueste zuerst
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onSortChange("created-asc")}
            className={sortOption === "created-asc" ? "bg-accent" : ""}
          >
            Älteste zuerst
          </DropdownMenuItem>
          {showHoursSort && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onSortChange("hours-desc")}
                className={sortOption === "hours-desc" ? "bg-accent" : ""}
              >
                Meiste Stunden
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSortChange("hours-asc")}
                className={sortOption === "hours-asc" ? "bg-accent" : ""}
              >
                Wenigste Stunden
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
