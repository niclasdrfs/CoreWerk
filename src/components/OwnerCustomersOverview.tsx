import { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useTabNavigate } from "@/hooks/useTabNavigate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
import { CustomerCard, type Customer } from "@/components/customers/CustomerCard";
import { CustomerEditDialog } from "@/components/customers/CustomerEditDialog";
import {
  CustomerFilterToolbar,
  type CustomerSortOption,
  type CustomerTypeFilter,
  type CustomerCategoryFilter,
} from "@/components/customers/CustomerFilterToolbar";
import { ownerAwarePath } from "@/lib/ownerRouting";

export const OwnerCustomersOverview = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const navigate = useTabNavigate();
  const location = useLocation();

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);

  // Filter & sort state
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerTypeFilter>("all");
  const [customerCategoryFilter, setCustomerCategoryFilter] = useState<CustomerCategoryFilter>("all");
  const [sortOption, setSortOption] = useState<CustomerSortOption>("name-asc");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Fetch customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("name");

      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!profile?.company_id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Kunde erfolgreich gelöscht");
      setDeletingCustomerId(null);
    },
    onError: (error) => {
      console.error("Error deleting customer:", error);
      toast.error("Fehler beim Löschen des Kunden");
    },
  });

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) ||
          customer.company_name?.toLowerCase().includes(query) ||
          customer.email?.toLowerCase().includes(query) ||
          customer.phone?.toLowerCase().includes(query) ||
          customer.address?.toLowerCase().includes(query)
      );
    }

    // Filter by customer category (company/private)
    if (customerCategoryFilter === "company") {
      result = result.filter((customer) => customer.company_name && customer.company_name.trim().length > 0);
    } else if (customerCategoryFilter === "private") {
      result = result.filter((customer) => !customer.company_name || customer.company_name.trim().length === 0);
    }

    // Filter by customer type
    if (customerTypeFilter !== "all") {
      result = result.filter((customer) => customer.customer_type === customerTypeFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "created-asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "created-desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [customers, searchQuery, customerTypeFilter, customerCategoryFilter, sortOption]);

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
  };

  const handleDelete = (customerId: string) => {
    setDeletingCustomerId(customerId);
  };

  const confirmDelete = () => {
    if (deletingCustomerId) {
      deleteMutation.mutate(deletingCustomerId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Kunden</h1>
            <p className="text-sm text-muted-foreground">Kundenverwaltung</p>
          </div>
        </div>
        <Button onClick={() => navigate(ownerAwarePath(location.pathname, "/customers/new"))} className="gap-2">
          <Plus className="w-4 h-4" />
          Neuen Kunden anlegen
        </Button>
      </div>

      {/* Filter Toolbar */}
      <CustomerFilterToolbar
        customerTypeFilter={customerTypeFilter}
        onCustomerTypeChange={setCustomerTypeFilter}
        customerCategoryFilter={customerCategoryFilter}
        onCustomerCategoryChange={setCustomerCategoryFilter}
        sortOption={sortOption}
        onSortChange={setSortOption}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Customers Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery || customerTypeFilter !== "all" || customerCategoryFilter !== "all"
              ? "Keine Kunden gefunden"
              : "Noch keine Kunden"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || customerTypeFilter !== "all" || customerCategoryFilter !== "all"
              ? "Versuchen Sie andere Filterkriterien."
              : "Legen Sie Ihren ersten Kunden an."}
          </p>
          {!searchQuery && customerTypeFilter === "all" && customerCategoryFilter === "all" && (
            <Button onClick={() => navigate(ownerAwarePath(location.pathname, "/customers/new"))} className="gap-2">
              <Plus className="w-4 h-4" />
              Neuen Kunden anlegen
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog (keep dialog for editing) */}
      <CustomerEditDialog
        customer={editingCustomer}
        open={!!editingCustomer}
        onOpenChange={(open) => !open && setEditingCustomer(null)}
        companyId={profile?.company_id || undefined}
        userId={user?.id}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingCustomerId}
        onOpenChange={(open) => !open && setDeletingCustomerId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunde löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diesen Kunden löschen möchten? Diese Aktion
              kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
