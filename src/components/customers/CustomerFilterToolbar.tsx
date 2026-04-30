import { Search, Filter, ArrowUpDown, X, Building2, User } from "lucide-react";
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

export type CustomerSortOption = "name-asc" | "name-desc" | "created-asc" | "created-desc";
export type CustomerTypeFilter = "all" | "new" | "existing" | "premium";
export type CustomerCategoryFilter = "all" | "company" | "private";

interface CustomerFilterToolbarProps {
  customerTypeFilter: CustomerTypeFilter;
  onCustomerTypeChange: (type: CustomerTypeFilter) => void;
  customerCategoryFilter: CustomerCategoryFilter;
  onCustomerCategoryChange: (category: CustomerCategoryFilter) => void;
  sortOption: CustomerSortOption;
  onSortChange: (sort: CustomerSortOption) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const customerTypeLabels: Record<CustomerTypeFilter, string> = {
  all: "Alle Typen",
  new: "Neukunden",
  existing: "Bestandskunden",
  premium: "Premium Kunden",
};

const customerCategoryLabels: Record<CustomerCategoryFilter, string> = {
  all: "Alle",
  company: "Firmen",
  private: "Privatpersonen",
};

export const CustomerFilterToolbar = ({
  customerTypeFilter,
  onCustomerTypeChange,
  customerCategoryFilter,
  onCustomerCategoryChange,
  sortOption,
  onSortChange,
  searchQuery,
  onSearchChange,
}: CustomerFilterToolbarProps) => {
  const getSortLabel = (option: CustomerSortOption) => {
    switch (option) {
      case "name-asc":
        return "A → Z";
      case "name-desc":
        return "Z → A";
      case "created-asc":
        return "Älteste zuerst";
      case "created-desc":
        return "Neueste zuerst";
      default:
        return "Sortieren";
    }
  };

  const hasActiveFilters = customerTypeFilter !== "all" || customerCategoryFilter !== "all";

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Kunde suchen..."
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

      {/* Category Filter (Company/Private) */}
      <div className="flex rounded-lg border overflow-hidden shrink-0">
        <Button
          variant={customerCategoryFilter === "all" ? "default" : "ghost"}
          size="sm"
          className="rounded-none border-0 gap-1.5"
          onClick={() => onCustomerCategoryChange("all")}
        >
          Alle
        </Button>
        <Button
          variant={customerCategoryFilter === "company" ? "default" : "ghost"}
          size="sm"
          className="rounded-none border-0 gap-1.5"
          onClick={() => onCustomerCategoryChange("company")}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Firmen</span>
        </Button>
        <Button
          variant={customerCategoryFilter === "private" ? "default" : "ghost"}
          size="sm"
          className="rounded-none border-0 gap-1.5"
          onClick={() => onCustomerCategoryChange("private")}
        >
          <User className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Privat</span>
        </Button>
      </div>

      {/* Type Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 shrink-0">
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Typ</span>
            {customerTypeFilter !== "all" && (
              <Badge variant="secondary" className="ml-1">
                {customerTypeLabels[customerTypeFilter]}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Nach Kundentyp filtern</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(customerTypeLabels) as CustomerTypeFilter[]).map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() => onCustomerTypeChange(type)}
              className={customerTypeFilter === type ? "bg-accent" : ""}
            >
              {customerTypeLabels[type]}
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
