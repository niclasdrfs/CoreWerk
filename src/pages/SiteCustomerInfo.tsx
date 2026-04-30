import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, User, MapPin, Phone, Mail, Building2, Plus, Trash2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const SiteCustomerInfo = () => {
  const navigate = useNavigate();
  const { siteId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, company_id").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const basePath = location.pathname.includes("/ober-montageleiter") ? "/ober-montageleiter" : location.pathname.includes("/employee") ? "/employee" : "/installation-manager";

  const { data: site } = useQuery({
    queryKey: ["construction-site-detail", siteId],
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

  const { data: notes = [] } = useQuery({
    queryKey: ["site-customer-notes", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_customer_notes")
        .select("*, profiles:created_by(full_name)")
        .eq("construction_site_id", siteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!siteId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("site_customer_notes").insert({
        construction_site_id: siteId!,
        company_id: profile?.company_id!,
        content,
        created_by: profile?.id!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-customer-notes", siteId] });
      setNewNote("");
      toast.success("Notiz hinzugefügt");
    },
    onError: () => toast.error("Fehler beim Hinzufügen"),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("site_customer_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-customer-notes", siteId] });
      toast.success("Notiz gelöscht");
    },
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
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Kundeninformationen</h1>
              <p className="text-xs text-muted-foreground">{site?.customer_last_name}</p>
            </div>
          </div>

          {customer ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{customer.name}</span>
              </div>
              {customer.company_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span>{customer.company_name}</span>
                </div>
              )}
              {customer.address && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <MapPin className="w-4 h-4" />
                  <span>{customer.address}</span>
                </a>
              )}
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Phone className="w-4 h-4" />
                  <span>{customer.phone}</span>
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Mail className="w-4 h-4" />
                  <span>{customer.email}</span>
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Kein Kunde verknüpft.</p>
          )}
        </div>

        {/* Notes Section */}
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-semibold">Notizen</span>
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Notiz hinzufügen..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[60px] text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={() => newNote.trim() && addNoteMutation.mutate(newNote.trim())}
            disabled={!newNote.trim() || addNoteMutation.isPending}
            className="gap-1"
          >
            <Plus className="w-4 h-4" />
            Hinzufügen
          </Button>

          <div className="space-y-2 pt-2">
            {notes.map((note: any) => (
              <div key={note.id} className="bg-muted rounded-lg p-3 space-y-1">
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {note.profiles?.full_name} • {new Date(note.created_at).toLocaleDateString("de-DE")}
                  </span>
                  {note.created_by === profile?.id && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteNoteMutation.mutate(note.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {notes.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Keine Notizen vorhanden</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SiteCustomerInfo;
