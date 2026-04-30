import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
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

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Aktuelles Passwort ist erforderlich"),
  newPassword: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirmPassword"],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: "Neues Passwort muss sich vom aktuellen unterscheiden",
  path: ["newPassword"],
});

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string | undefined;
}

export const PasswordDialog = ({ open, onOpenChange, userEmail }: PasswordDialogProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>({});

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ currentPwd, newPwd }: { currentPwd: string; newPwd: string }) => {
      if (!userEmail) throw new Error("Nicht authentifiziert");

      // First verify the current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPwd,
      });

      if (signInError) {
        throw new Error("Aktuelles Passwort ist falsch");
      }

      // Now update to the new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPwd,
      });
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Passwort geändert");
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      if (error.message === "Aktuelles Passwort ist falsch") {
        setErrors({ currentPassword: error.message });
      } else {
        toast.error("Fehler beim Ändern des Passworts", {
          description: error.message,
        });
      }
    },
  });

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = passwordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    
    if (!result.success) {
      const newErrors: { currentPassword?: string; newPassword?: string; confirmPassword?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "currentPassword") newErrors.currentPassword = err.message;
        if (err.path[0] === "newPassword") newErrors.newPassword = err.message;
        if (err.path[0] === "confirmPassword") newErrors.confirmPassword = err.message;
      });
      setErrors(newErrors);
      return;
    }

    updatePasswordMutation.mutate({ currentPwd: currentPassword, newPwd: newPassword });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Passwort ändern
          </DialogTitle>
          <DialogDescription>Geben Sie Ihr aktuelles und neues Passwort ein</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Ihr aktuelles Passwort"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-sm text-destructive">{errors.currentPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Neues Passwort</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort wiederholen"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={updatePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            >
              <Lock className="w-4 h-4 mr-2" />
              {updatePasswordMutation.isPending ? "Ändern..." : "Passwort ändern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};