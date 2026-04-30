import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTabNavigate } from "@/hooks/useTabNavigate";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, User, Building2, MapPin, Phone, Mail, Tag, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerAvatarUpload } from "@/components/customers/CustomerAvatarUpload";
import { ownerAwarePath } from "@/lib/ownerRouting";

const customerSchema = z.object({
  name: z.string().max(100).optional().nullable().or(z.literal("")),
  company_name: z.string().max(100).optional().nullable().or(z.literal("")),
  customer_number: z.string().max(50).optional().nullable().or(z.literal("")),
  address: z.string().max(200).optional().nullable(),
  address_line_2: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email("Ungültige E-Mail-Adresse").max(255).optional().nullable().or(z.literal("")),
  customer_type: z.enum(["new", "existing", "premium"]),
}).refine(
  (data) => (data.name && data.name.trim().length > 0) || (data.company_name && data.company_name.trim().length > 0),
  { message: "Bitte geben Sie einen Namen oder eine Firma an", path: ["name"] }
);

type CustomerFormData = z.infer<typeof customerSchema>;

const OwnerCustomerCreate = () => {
  const navigate = useTabNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!profile?.company_id) throw new Error("Keine Firma-ID vorhanden");

      const { error } = await supabase.from("customers").insert({
        company_id: profile.company_id,
        created_by: user?.id,
        name: data.name || "",
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
      toast.success("Kunde erfolgreich erstellt", { duration: 2000 });
      navigate(ownerAwarePath(location.pathname, "/?view=customers"));
    },
    onError: (error) => {
      console.error("Error creating customer:", error);
      toast.error("Fehler beim Erstellen des Kunden");
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-4 flex items-center gap-3 safe-top">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl h-10 w-10"
          onClick={() => navigate(ownerAwarePath(location.pathname, "/?view=customers"))}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserPlus className="h-4.5 w-4.5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Neuen Kunden anlegen</h1>
        </div>
      </div>

      {/* Full-page form */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Avatar */}
            <div className="flex justify-center py-4">
              <CustomerAvatarUpload
                customerId={undefined}
                currentAvatarUrl={avatarUrl}
                onAvatarChange={setAvatarUrl}
                size="lg"
              />
            </div>

            {/* Personal Info Card */}
            <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                <User className="h-4 w-4" />
                Persönliche Daten
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Max Mustermann"
                        className="h-12 text-base rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                        {...field}
                        value={field.value || ""}
                      />
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
                    <FormLabel className="text-sm flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      Firma
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Musterfirma GmbH"
                        className="h-12 text-base rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Customer Number Card */}
            <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                <Hash className="h-4 w-4" />
                Kundennummer
              </div>

              <FormField
                control={form.control}
                name="customer_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Kundennummer</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. KD-1003"
                        className="h-12 text-base rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address Card */}
            <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                Adresse
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Straße & Ort</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Musterstraße 123, 12345 Musterstadt"
                        className="h-12 text-base rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                        {...field}
                        value={field.value || ""}
                      />
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
                    <FormLabel className="text-sm">Adresszusatz</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Etage, Apartment, etc."
                        className="h-12 text-base rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact Card */}
            <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                <Phone className="h-4 w-4" />
                Kontaktdaten
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Telefonnummer</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+49 123 456789"
                        className="h-12 text-base rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                        {...field}
                        value={field.value || ""}
                      />
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
                    <FormLabel className="text-sm flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      E-Mail
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="kunde@example.de"
                        className="h-12 text-base rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Type Card */}
            <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                <Tag className="h-4 w-4" />
                Kategorie
              </div>

              <FormField
                control={form.control}
                name="customer_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Kundentyp</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-base rounded-xl bg-muted/50 border-border/50">
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
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-4 pb-8">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(ownerAwarePath(location.pathname, "/?view=customers"))}
                className="flex-1 h-12 text-base rounded-xl"
                disabled={createMutation.isPending}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                className="flex-1 h-12 text-base rounded-xl"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Speichern..." : "Kunde anlegen"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default OwnerCustomerCreate;
