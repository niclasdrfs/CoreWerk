import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, MapPin, Phone, Calendar, FileText, User, Image as ImageIcon, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getTextColor } from "@/lib/colorUtils";

const ConstructionSiteDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { siteId } = useParams<{ siteId: string }>();

  // Determine base path from current URL
  const basePath = location.pathname.startsWith("/ober-montageleiter")
    ? "/ober-montageleiter"
    : location.pathname.startsWith("/employee")
      ? "/employee"
      : "/installation-manager";

  const { data: site, isLoading, error } = useQuery({
    queryKey: ["construction-site", siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const { data, error } = await supabase
        .from("construction_sites")
        .select("*")
        .eq("id", siteId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Lade Baustelle...</div>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card safe-top">
          <div className="container mx-auto px-4 py-4">
            <Button
              variant="ghost"
              onClick={() => navigate(basePath)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Baustelle nicht gefunden</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const siteColor = site.color || "#3B82F6";
  const textColor = getTextColor(siteColor);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate(basePath)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header Card with Color */}
          <Card className="overflow-hidden">
            <div 
              className="p-6"
              style={{ 
                backgroundColor: siteColor,
                color: textColor 
              }}
            >
              <div className="flex items-center gap-4">
                <Building2 className="w-10 h-10" />
                <div>
                  <h1 className="text-2xl font-bold">{site.customer_last_name}</h1>
                  <p className="opacity-80">
                    Status: {site.status === "active" ? "Aktiv" : site.status === "future" ? "Ausstehend" : site.status === "completed" ? "Abgeschlossen" : site.status}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="grid grid-cols-2 gap-2 p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`${basePath}/site/${siteId}/kundeninfo`)}
                className="justify-start gap-2 h-10"
              >
                <User className="w-3.5 h-3.5 text-primary" />
                Kundeninfo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`${basePath}/site/${siteId}/plaene`)}
                className="justify-start gap-2 h-10"
              >
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                Pläne & Bilder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`${basePath}/site/${siteId}/schriftverkehr`)}
                className="justify-start gap-2 h-10"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                Schriftverkehr
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`${basePath}/site/${siteId}/kontakt`)}
                className="justify-start gap-2 h-10"
              >
                <Phone className="w-3.5 h-3.5 text-rose-600" />
                Kontakt
              </Button>
            </div>
          </Card>

          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {site.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Adresse</p>
                    <p className="text-foreground">{site.address}</p>
                  </div>
                </div>
              )}

              {site.customer_phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telefon</p>
                    <a 
                      href={`tel:${site.customer_phone}`}
                      className="text-primary hover:underline"
                    >
                      {site.customer_phone}
                    </a>
                  </div>
                </div>
              )}

              {(site.start_date || site.end_date) && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Zeitraum</p>
                    <p className="text-foreground">
                      {site.start_date && format(new Date(site.start_date), "dd. MMMM yyyy", { locale: de })}
                      {site.start_date && site.end_date && " – "}
                      {site.end_date && format(new Date(site.end_date), "dd. MMMM yyyy", { locale: de })}
                    </p>
                  </div>
                </div>
              )}

              {site.notes && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Notizen</p>
                    <p className="text-foreground whitespace-pre-wrap">{site.notes}</p>
                  </div>
                </div>
              )}

              {!site.address && !site.customer_phone && !site.start_date && !site.end_date && !site.notes && (
                <p className="text-muted-foreground text-center py-4">
                  Keine weiteren Details vorhanden
                </p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`${basePath}/baustellen?edit=${site.id}`)}
              className="flex-1"
            >
              Bearbeiten
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConstructionSiteDetail;