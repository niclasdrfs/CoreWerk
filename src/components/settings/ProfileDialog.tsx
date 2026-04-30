import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User } from "lucide-react";

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Name ist erforderlich").max(100, "Name darf maximal 100 Zeichen haben"),
  phone_number: z.string().trim().max(30, "Telefonnummer darf maximal 30 Zeichen haben").optional().or(z.literal("")),
});

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  profile: { email: string; full_name: string | null; phone_number: string | null } | null;
}

export const ProfileDialog = ({ open, onOpenChange, userId, profile }: ProfileDialogProps) => {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [errors, setErrors] = useState<{ full_name?: string; phone_number?: string }>({});

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhoneNumber(profile.phone_number || "");
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { full_name: string; phone_number: string }) => {
      if (!userId) throw new Error("Nicht authentifiziert");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          phone_number: data.phone_number || null,
        })
        .eq("id", userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Fehler beim Speichern", {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = profileSchema.safeParse({ full_name: fullName, phone_number: phoneNumber });
    
    if (!result.success) {
      const newErrors: { full_name?: string; phone_number?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "full_name") newErrors.full_name = err.message;
        if (err.path[0] === "phone_number") newErrors.phone_number = err.message;
      });
      setErrors(newErrors);
      return;
    }

    updateProfileMutation.mutate({ full_name: result.data.full_name, phone_number: result.data.phone_number || "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profil bearbeiten
          </DialogTitle>
          <DialogDescription>Ihre persönlichen Informationen</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={profile?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              E-Mail-Adresse kann nicht geändert werden
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Name</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ihr vollständiger Name"
            />
            {errors.full_name && (
              <p className="text-sm text-destructive">{errors.full_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Telefonnummer</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+49 123 456789"
            />
            {errors.phone_number && (
              <p className="text-sm text-destructive">{errors.phone_number}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={updateProfileMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {updateProfileMutation.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
