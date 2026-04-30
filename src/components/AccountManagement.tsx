import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { z } from "zod";
import { Pencil, Trash2 } from "lucide-react";

type AppRole = "owner" | "installation_manager" | "employee" | "ober_montageleiter";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  company_id: string | null;
  phone_number: string | null;
  vacation_days: number | null;
  birth_date: string | null;
  role: string | null;
}

const createUserSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  fullName: z.string().trim().min(2, { message: "Name must be at least 2 characters" }).max(100, { message: "Name must be less than 100 characters" }),
  role: z.enum(["owner", "installation_manager", "employee", "ober_montageleiter"], { message: "Please select a role" }),
});

const updateUserSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).optional().or(z.literal("")),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).optional().or(z.literal("")),
  fullName: z.string().trim().min(2, { message: "Name must be at least 2 characters" }).max(100, { message: "Name must be less than 100 characters" }).optional().or(z.literal("")),
  phoneNumber: z.string().trim().max(30, { message: "Phone number must be less than 30 characters" }).optional().or(z.literal("")),
});

export const AccountManagement = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  
  // Edit modal state
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editVacationDays, setEditVacationDays] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  
  // Delete confirmation state
  const [deleteUser, setDeleteUser] = useState<UserWithRole | null>(null);
  
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["company-users"],
    queryFn: async () => {
      // Get current user's company_id first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch all users from the same company
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("company_id", profile.company_id);

      if (profilesError) throw profilesError;

      // Fetch all roles for the company
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("company_id", profile.company_id);

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const usersWithRoles: UserWithRole[] = profiles?.map(p => ({
        ...p,
        role: roles?.find(r => r.user_id === p.id)?.role || null
      })) || [];

      return usersWithRoles;
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: { email: string; password: string; fullName: string; role: AppRole }) => {
      const validation = createUserSchema.safeParse(userData);
      if (!validation.success) {
        throw new Error(validation.error.errors[0].message);
      }

      // Call the create-user Edge Function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: userData.email,
          password: userData.password,
          fullName: userData.fullName,
          role: userData.role
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to create user');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Erfolg", {
        description: "Benutzerkonto wurde erfolgreich erstellt",
      });
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("");
    },
    onError: (error: Error) => {
      toast.error("Fehler", {
        description: error.message,
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (userData: { userId: string; email?: string; password?: string; fullName?: string; phoneNumber?: string; vacationDays?: number | null; birthDate?: string }) => {
      // Only validate fields that are provided
      const dataToValidate: Record<string, string> = {};
      if (userData.email) dataToValidate.email = userData.email;
      if (userData.password) dataToValidate.password = userData.password;
      if (userData.fullName) dataToValidate.fullName = userData.fullName;
      if (userData.phoneNumber) dataToValidate.phoneNumber = userData.phoneNumber;

      const validation = updateUserSchema.safeParse(dataToValidate);
      if (!validation.success) {
        throw new Error(validation.error.errors[0].message);
      }

      // Call the update-user Edge Function
      const { data, error } = await supabase.functions.invoke('update-user', {
        body: {
          userId: userData.userId,
          email: userData.email || undefined,
          password: userData.password || undefined,
          fullName: userData.fullName || undefined,
          phoneNumber: userData.phoneNumber || undefined,
          vacationDays: userData.vacationDays,
          birthDate: userData.birthDate || undefined,
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to update user');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Erfolg", {
        description: "Benutzerkonto wurde erfolgreich aktualisiert",
      });
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      setEditUser(null);
      setEditEmail("");
      setEditPassword("");
      setEditFullName("");
      setEditPhoneNumber("");
      setEditVacationDays("");
      setEditBirthDate("");
    },
    onError: (error: Error) => {
      toast.error("Fehler", {
        description: error.message,
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to delete user');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Erfolg", {
        description: "Benutzerkonto wurde erfolgreich gelöscht",
      });
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      setDeleteUser(null);
    },
    onError: (error: Error) => {
      toast.error("Fehler", {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      toast.error("Validierungsfehler", {
        description: "Bitte wählen Sie eine Rolle aus",
      });
      return;
    }
    createUserMutation.mutate({ email, password, fullName, role });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    // Check if at least one field has a value
    if (!editEmail && !editPassword && !editFullName && !editPhoneNumber && !editVacationDays && !editBirthDate) {
      toast.error("Validierungsfehler", {
        description: "Bitte füllen Sie mindestens ein Feld aus",
      });
      return;
    }

    updateUserMutation.mutate({
      userId: editUser.id,
      email: editEmail || undefined,
      password: editPassword || undefined,
      fullName: editFullName || undefined,
      phoneNumber: editPhoneNumber || undefined,
      vacationDays: editVacationDays ? parseInt(editVacationDays, 10) : undefined,
      birthDate: editBirthDate || undefined,
    });
  };

  const openEditModal = (user: UserWithRole) => {
    setEditUser(user);
    setEditEmail("");
    setEditPassword("");
    setEditFullName("");
    setEditPhoneNumber("");
    setEditVacationDays(user.vacation_days?.toString() || "");
    setEditBirthDate(user.birth_date || "");
  };

  const getRoleDisplayName = (role: string | null) => {
    switch (role) {
      case "owner": return "Chef / Boss";
      case "installation_manager": return "Montageleiter";
      case "ober_montageleiter": return "Ober-Montageleiter";
      case "employee": return "Mitarbeiter";
      case "accounting": return "Buchhaltung";
      case "super_admin": return "Super Admin";
      default: return "Keine Rolle";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Neues Benutzerkonto erstellen</CardTitle>
          <CardDescription>
            Erstellen Sie Konten für Mitarbeiter, Montageleiter oder Chefs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Vollständiger Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Max Mustermann"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="benutzer@beispiel.de"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rolle</Label>
              <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Rolle auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Chef / Boss</SelectItem>
                  <SelectItem value="installation_manager">Montageleiter</SelectItem>
                  <SelectItem value="ober_montageleiter">Ober-Montageleiter</SelectItem>
                  <SelectItem value="employee">Mitarbeiter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? "Erstellen..." : "Konto erstellen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vorhandene Benutzer</CardTitle>
          <CardDescription>Verwalten Sie Benutzer in Ihrem Unternehmen</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Benutzer werden geladen...</div>
          ) : users && users.length > 0 ? (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{user.full_name || "Kein Name"}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.phone_number && (
                      <p className="text-sm text-muted-foreground">{user.phone_number}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {getRoleDisplayName(user.role)}
                    </span>
                    {user.role !== "accounting" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(user)}
                          title="Benutzer bearbeiten"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteUser(user)}
                          title="Benutzer löschen"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Keine Benutzer gefunden</p>
          )}
        </CardContent>
      </Card>

      {/* Edit User Modal */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
            <DialogDescription>
              Ändern Sie die Daten für {editUser?.full_name || editUser?.email}. Lassen Sie Felder leer, die nicht geändert werden sollen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editFullName">Neuer Name</Label>
              <Input
                id="editFullName"
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder={editUser?.full_name || "Name eingeben"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Neue E-Mail</Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder={editUser?.email || "E-Mail eingeben"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPassword">Neues Passwort</Label>
              <Input
                id="editPassword"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Neues Passwort eingeben"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhoneNumber">Telefonnummer</Label>
              <Input
                id="editPhoneNumber"
                type="tel"
                value={editPhoneNumber}
                onChange={(e) => setEditPhoneNumber(e.target.value)}
                placeholder={editUser?.phone_number || "Telefonnummer eingeben"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editVacationDays">Urlaubstage pro Jahr</Label>
              <Input
                id="editVacationDays"
                type="number"
                min="0"
                max="365"
                value={editVacationDays}
                onChange={(e) => setEditVacationDays(e.target.value)}
                placeholder="z.B. 30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editBirthDate">Geburtsdatum</Label>
              <Input
                id="editBirthDate"
                type="date"
                value={editBirthDate}
                onChange={(e) => setEditBirthDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Speichern..." : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Benutzer "{deleteUser?.full_name || deleteUser?.email}" wirklich löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUser && deleteUserMutation.mutate(deleteUser.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? "Löschen..." : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
