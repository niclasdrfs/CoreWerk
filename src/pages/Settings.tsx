import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings as SettingsIcon, User, Lock, Sun, Moon, ChevronRight, LogOut, Bell } from "lucide-react";
 import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProfileDialog } from "@/components/settings/ProfileDialog";
import { AppearanceDialog } from "@/components/settings/AppearanceDialog";
import { PasswordDialog } from "@/components/settings/PasswordDialog";
import { NotificationDialog } from "@/components/settings/NotificationDialog";
 import { useAppUpdate } from "@/hooks/useAppUpdate";

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme } = useTheme();
   const { updateApp } = useAppUpdate();

  // Dialog states
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [appearanceDialogOpen, setAppearanceDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);

  // Fetch current profile
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone_number, email")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const goBack = () => {
    navigate(-1);
  };

  const getThemeLabel = () => {
    switch (theme) {
      case "light": return "Hell";
      case "dark": return "Dunkel";
      case "system": return "System";
      default: return "System";
    }
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "light": return <Sun className="w-5 h-5 text-foreground" />;
      case "dark": return <Moon className="w-5 h-5 text-foreground" />;
      default: return <Sun className="w-5 h-5 text-foreground" />;
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={goBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Einstellungen</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <SettingsIcon className="w-7 h-7 text-foreground" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Einstellungen</h2>
              <p className="text-muted-foreground">Verwalten Sie Ihr Profil und Ihre Sicherheit</p>
            </div>
          </div>

          {/* Settings List */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Profile Button */}
            <button
              onClick={() => setProfileDialogOpen(true)}
              className="w-full flex items-center gap-4 p-4 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Profil</p>
                <p className="text-sm text-muted-foreground truncate">
                  {profile?.full_name || profile?.email || "Keine Angabe"}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>

            <div className="h-px bg-border mx-4" />

            {/* Appearance Button */}
            <button
              onClick={() => setAppearanceDialogOpen(true)}
              className="w-full flex items-center gap-4 p-4 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {getThemeIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Erscheinungsbild</p>
                <p className="text-sm text-muted-foreground">{getThemeLabel()}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>

            <div className="h-px bg-border mx-4" />

            {/* Password Button */}
            <button
              onClick={() => setPasswordDialogOpen(true)}
              className="w-full flex items-center gap-4 p-4 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Passwort ändern</p>
                <p className="text-sm text-muted-foreground">Sicherheit verwalten</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>

            <div className="h-px bg-border mx-4" />

            {/* Notifications Button */}
            <button
              onClick={() => setNotificationDialogOpen(true)}
              className="w-full flex items-center gap-4 p-4 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Benachrichtigungen</p>
                <p className="text-sm text-muted-foreground">Push-Mitteilungen verwalten</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>

            <div className="h-px bg-border mx-4" />

           {/* Update App Button */}
           <button
             onClick={updateApp}
             className="w-full flex items-center gap-4 p-4 hover:bg-primary/5 transition-colors text-left"
           >
             <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
               <RefreshCw className="w-5 h-5 text-foreground" />
             </div>
             <div className="flex-1 min-w-0">
               <p className="font-medium text-foreground">App aktualisieren</p>
               <p className="text-sm text-muted-foreground">Cache leeren & neueste Version laden</p>
             </div>
             <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
           </button>

           <div className="h-px bg-border mx-4" />

            {/* Logout Button */}
            <button
              onClick={signOut}
              className="w-full flex items-center gap-4 p-4 hover:bg-destructive/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-destructive">Abmelden</p>
                <p className="text-sm text-muted-foreground">Von Ihrem Konto abmelden</p>
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Dialogs */}
      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        userId={user?.id}
        profile={profile}
      />
      <AppearanceDialog
        open={appearanceDialogOpen}
        onOpenChange={setAppearanceDialogOpen}
      />
      <PasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        userEmail={profile?.email}
      />
      <NotificationDialog
        open={notificationDialogOpen}
        onOpenChange={setNotificationDialogOpen}
      />
    </div>
  );
};

export default Settings;
