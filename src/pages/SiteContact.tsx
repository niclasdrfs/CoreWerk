import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, Mail, MapPin, Building2, User, Globe } from "lucide-react";

const SiteContact = () => {
  const navigate = useNavigate();
  const { siteId } = useParams();

  const { data: site } = useQuery({
    queryKey: ["construction-site-contact", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_sites")
        .select("*, customers(*)")
        .eq("id", siteId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  const customer = site?.customers;

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-card safe-top sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
            <Phone className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Kontakt</h1>
            <p className="text-xs text-muted-foreground">{site?.customer_last_name}</p>
          </div>
        </div>

        {/* Site Contact */}
        <div className="bg-card border rounded-xl p-4 space-y-4">
          <h2 className="font-semibold text-sm">Baustelle</h2>
          {site?.address && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
              <MapPin className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Adresse</p>
                <p className="text-xs text-muted-foreground">{site.address}</p>
              </div>
            </a>
          )}
          {site?.customer_phone && (
            <a href={`tel:${site.customer_phone}`} className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
              <Phone className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Telefon (Baustelle)</p>
                <p className="text-xs text-muted-foreground">{site.customer_phone}</p>
              </div>
            </a>
          )}
        </div>

        {/* Customer Contact */}
        {customer && (
          <div className="bg-card border rounded-xl p-4 space-y-4">
            <h2 className="font-semibold text-sm">Kunde</h2>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <User className="w-5 h-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{customer.name}</p>
                {customer.company_name && <p className="text-xs text-muted-foreground">{customer.company_name}</p>}
              </div>
            </div>
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <Phone className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">Telefon</p>
                  <p className="text-xs text-muted-foreground">{customer.phone}</p>
                </div>
              </a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <Mail className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">E-Mail</p>
                  <p className="text-xs text-muted-foreground">{customer.email}</p>
                </div>
              </a>
            )}
            {customer.address && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <MapPin className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">Adresse</p>
                  <p className="text-xs text-muted-foreground">{customer.address}</p>
                  {customer.address_line_2 && <p className="text-xs text-muted-foreground">{customer.address_line_2}</p>}
                </div>
              </a>
            )}
          </div>
        )}

        {!customer && !site?.address && !site?.customer_phone && (
          <div className="bg-card border rounded-xl p-8 text-center">
            <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Keine Kontaktdaten vorhanden</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default SiteContact;
