import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Users, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

export function CreateGroupDialog({ open, onOpenChange, companyId }: CreateGroupDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"name" | "members">("name");
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Fetch all company profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["company-profiles-chat", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles_limited" as any)
        .select("id, full_name, email")
        .eq("company_id", companyId);
      if (error) throw error;
      return (data || []) as unknown as { id: string; full_name: string | null; email: string }[];
    },
    enabled: !!companyId && open,
  });

  // Fetch user roles to filter
  const { data: userRoles = [] } = useQuery({
    queryKey: ["company-user-roles-chat", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      return (data || []) as { user_id: string; role: string }[];
    },
    enabled: !!companyId && open,
  });

  const excludedRoles = ["accounting", "owner", "super_admin"];
  const availableProfiles = profiles.filter((p) => {
    const roles = userRoles.filter((r) => r.user_id === p.id).map((r) => r.role);
    const hasExcludedRole = roles.some((r) => excludedRoles.includes(r));
    return !hasExcludedRole && p.id !== user?.id;
  });

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      // Create the group
      const { data: group, error: groupError } = await supabase
        .from("chat_groups")
        .insert({
          name: groupName.trim(),
          company_id: companyId,
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (groupError) throw groupError;

      // Add creator as member
      const membersToInsert = [user!.id, ...selectedMembers].map((uid) => ({
        group_id: group.id,
        user_id: uid,
      }));

      const { error: membersError } = await supabase
        .from("chat_group_members")
        .insert(membersToInsert);
      if (membersError) throw membersError;

      return group;
    },
    onSuccess: () => {
      toast.success("Gruppe erstellt");
      queryClient.invalidateQueries({ queryKey: ["chat-groups"] });
      handleClose();
    },
    onError: () => {
      toast.error("Fehler beim Erstellen der Gruppe");
    },
  });

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleClose = () => {
    setStep("name");
    setGroupName("");
    setSelectedMembers([]);
    onOpenChange(false);
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {step === "name" ? "Neue Gruppe" : "Mitglieder hinzufügen"}
          </DialogTitle>
        </DialogHeader>

        {step === "name" ? (
          <div className="space-y-4">
            <Input
              placeholder="Gruppenname eingeben..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && groupName.trim()) {
                  setStep("members");
                }
              }}
            />
            <Button
              className="w-full"
              disabled={!groupName.trim()}
              onClick={() => setStep("members")}
            >
              Weiter
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setStep("name")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <p className="text-sm text-muted-foreground">
                {selectedMembers.length} ausgewählt
              </p>
            </div>

            <ScrollArea className="h-64">
              <div className="space-y-1">
                {availableProfiles.map((profile) => {
                  const isSelected = selectedMembers.includes(profile.id);
                  return (
                    <button
                      key={profile.id}
                      onClick={() => toggleMember(profile.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                        isSelected ? "bg-[hsl(142,70%,35%)]/10" : "hover:bg-muted/60"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isSelected
                            ? "bg-[hsl(142,70%,35%)] text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          getInitials(profile.full_name)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {profile.full_name || profile.email}
                        </p>
                        {profile.full_name && (
                          <p className="text-xs text-muted-foreground truncate">
                            {profile.email}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
                {availableProfiles.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Keine Mitarbeiter verfügbar
                  </p>
                )}
              </div>
            </ScrollArea>

            <Button
              className="w-full bg-[hsl(142,70%,35%)] hover:bg-[hsl(142,70%,30%)] text-white"
              disabled={selectedMembers.length === 0 || createGroupMutation.isPending}
              onClick={() => createGroupMutation.mutate()}
            >
              <Users className="w-4 h-4 mr-2" />
              Gruppe erstellen ({selectedMembers.length + 1} Mitglieder)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
