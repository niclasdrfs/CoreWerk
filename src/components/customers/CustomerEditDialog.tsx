import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerAvatarUpload } from "./CustomerAvatarUpload";
import type { Customer } from "./CustomerCard";

const customerSchema = z.object({
  name: z.string().max(100, "Name ist zu lang").optional().nullable().or(z.literal("")),
  company_name: z.string().max(100, "Firmenname ist zu lang").optional().nullable().or(z.literal("")),
  customer_number: z.string().max(50, "Kundennummer ist zu lang").optional().nullable().or(z.literal("")),
  address: z.string().max(200, "Adresse ist zu lang").optional().nullable(),
  address_line_2: z.string().max(200, "Adresszusatz ist zu lang").optional().nullable(),
  phone: z.string().max(50, "Telefonnummer ist zu lang").optional().nullable(),
  email: z.string().email("Ungültige E-Mail-Adresse").max(255, "E-Mail ist zu lang").optional().nullable().or(z.literal("")),
  customer_type: z.enum(["new", "existing", "premium"]),
}).refine(
  (data) => (data.name && data.name.trim().length > 0) || (data.company_name && data.company_name.trim().length > 0),
  {
    message: "Bitte geben Sie einen Namen oder eine Firma an",
    path: ["name"],
  }
);

type CustomerFormData = z.infer<typeof customerSchema>;

interface CustomerEditDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  userId?: string;
}

export const CustomerEditDialog = ({
  customer,
  open,
  onOpenChange,
  companyId,
  userId,
}: CustomerEditDialogProps) => {
  const queryClient = useQueryClient();
  const isEditing = !!customer;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      company_name: "",
      customer_number: "",
      address: "",
      address_line_2: "",
      phone: "",
      email: "",
      customer_type: "new",
    },
  });

  useEffect(() => {
    if (customer) {
      form.reset({
        name: customer.name,
        company_name: customer.company_name || "",
        customer_number: (customer as any).customer_number || "",
        address: customer.address || "",
        address_line_2: customer.address_line_2 || "",
        phone: customer.phone || "",
        email: customer.email || "",
        customer_type: customer.customer_type,
      });
      setAvatarUrl(customer.avatar_url || null);
    } else {
      form.reset({
        name: "",
        company_name: "",
        customer_number: "",
        address: "",
        address_line_2: "",
        phone: "",
        email: "",
        customer_type: "new",
      });
      setAvatarUrl(null);
    }
  }, [customer, form]);

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!companyId) throw new Error("Keine Firma-ID vorhanden");

      const { error } = await supabase.from("customers").insert({
        company_id: companyId,
        created_by: userId,
        name: data.name,
        company_name: data.company_name || null,
        customer_number: data.customer_number || null,
        address: data.address || null,
        address_line_2: data.address_line_2 || null,
        phone: data.phone || null,
        email: data.email || null,
        customer_type: data.customer_type,
        avatar_url: avatarUrl,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Kunde erfolgreich erstellt");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error creating customer:", error);
      toast.error("Fehler beim Erstellen des Kunden");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!customer) throw new Error("Kein Kunde zum Aktualisieren");

      const { error } = await supabase
        .from("customers")
        .update({
          name: data.name,
          company_name: data.company_name || null,
          customer_number: data.customer_number || null,
          address: data.address || null,
          address_line_2: data.address_line_2 || null,
          phone: data.phone || null,
          email: data.email || null,
          customer_type: data.customer_type,
          avatar_url: avatarUrl,
        })
        .eq("id", customer.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Kunde erfolgreich aktualisiert");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating customer:", error);
      toast.error("Fehler beim Aktualisieren des Kunden");
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Kunde bearbeiten" : "Neuen Kunden anlegen"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Bearbeiten Sie die Kundendaten."
              : "Füllen Sie die Daten für den neuen Kunden aus."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Avatar Upload */}
            <div className="flex justify-center mb-4">
              <CustomerAvatarUpload
                customerId={customer?.id}
                currentAvatarUrl={avatarUrl}
                onAvatarChange={setAvatarUrl}
                size="lg"
              />
            </div>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Max Mustermann" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Firma</FormLabel>
                  <FormControl>
                    <Input placeholder="Musterfirma GmbH" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kundennummer</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. KD-1003" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input placeholder="Musterstraße 123, 12345 Musterstadt" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address_line_2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresszusatz</FormLabel>
                  <FormControl>
                    <Input placeholder="Etage, Apartment, etc." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefonnummer</FormLabel>
                  <FormControl>
                    <Input placeholder="+49 123 456789" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="kunde@example.de" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kundentyp *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Kundentyp wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="new">Neukunde</SelectItem>
                      <SelectItem value="existing">Bestandskunde</SelectItem>
                      <SelectItem value="premium">Premium Kunde</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={isPending}
              >
                Abbrechen
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Speichern..." : isEditing ? "Speichern" : "Anlegen"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
