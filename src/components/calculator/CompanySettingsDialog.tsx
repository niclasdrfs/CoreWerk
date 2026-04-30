import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Upload, X } from "lucide-react";

interface CompanySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CompanySettingsDialog = ({ open, onOpenChange }: CompanySettingsDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const { data: company } = useQuery({
    queryKey: ["company-details", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.company_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  useEffect(() => {
    if (company) {
      setName(company.name || "");
      setAddress((company as any).address || "");
      setPhone((company as any).phone || "");
      setEmail((company as any).email || "");
      setTaxId((company as any).tax_id || "");
      setLogoUrl((company as any).logo_url || null);
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("Keine Firma");
      const { error } = await supabase
        .from("companies")
        .update({
          name,
          address,
          phone,
          email,
          tax_id: taxId,
          logo_url: logoUrl,
        } as any)
        .eq("id", profile.company_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-details"] });
      toast.success("Firmendaten gespeichert", { duration: 2000 });
      onOpenChange(false);
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.company_id) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.company_id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("company-logos")
        .getPublicUrl(filePath);

      setLogoUrl(data.publicUrl);
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Logo-Upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Firmendaten für Briefkopf
          </DialogTitle>
          <DialogDescription>
            Diese Daten erscheinen automatisch auf jedem Angebot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Logo */}
          <div>
            <Label className="text-sm">Firmenlogo</Label>
            <div className="mt-2 flex items-center gap-3">
              {logoUrl ? (
                <div className="relative">
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-16 w-auto max-w-[200px] object-contain rounded-lg border border-border"
                  />
                  <button
                    onClick={() => setLogoUrl(null)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "Hochladen..." : "Logo hochladen"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="company-name">Firmenname *</Label>
            <Input id="company-name" value={name} onChange={e => setName(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label htmlFor="company-address">Adresse</Label>
            <Input id="company-address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Straße, PLZ Ort" className="mt-1" />
          </div>

          <div>
            <Label htmlFor="company-phone">Telefon</Label>
            <Input id="company-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49 ..." className="mt-1" />
          </div>

          <div>
            <Label htmlFor="company-email">E-Mail</Label>
            <Input id="company-email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@firma.de" className="mt-1" />
          </div>

          <div>
            <Label htmlFor="company-tax">Steuernummer / USt-ID</Label>
            <Input id="company-tax" value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="DE123456789" className="mt-1" />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button className="flex-1" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !name.trim()}>
              {updateMutation.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
