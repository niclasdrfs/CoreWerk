import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MessageSquare, Plus, Trash2, Paperclip, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const SiteCorrespondence = () => {
  const navigate = useNavigate();
  const { siteId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newEntry, setNewEntry] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, company_id").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: site } = useQuery({
    queryKey: ["construction-site-name", siteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("construction_sites").select("customer_last_name").eq("id", siteId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  // Text entries
  const { data: entries = [] } = useQuery({
    queryKey: ["site-correspondence", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_correspondence")
        .select("*, profiles:created_by(full_name)")
        .eq("construction_site_id", siteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!siteId,
  });

  // File entries
  const { data: files = [] } = useQuery({
    queryKey: ["site-documents", siteId, "correspondence"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_documents")
        .select("*, profiles:created_by(full_name)")
        .eq("construction_site_id", siteId!)
        .eq("category", "correspondence")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!siteId,
  });

  const addEntryMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("site_correspondence").insert({
        construction_site_id: siteId!,
        company_id: profile?.company_id!,
        content,
        created_by: profile?.id!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-correspondence", siteId] });
      setNewEntry("");
      toast.success("Eintrag hinzugefügt");
    },
    onError: () => toast.error("Fehler"),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("site_correspondence").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-correspondence", siteId] });
      toast.success("Gelöscht");
    },
  });

  const handleUpload = async (filesList: FileList) => {
    if (!filesList.length || !profile) return;
    setUploading(true);
    try {
      for (const file of Array.from(filesList)) {
        const filePath = `${profile.id}/${siteId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("site-documents").upload(filePath, file);
        if (uploadError) throw uploadError;
        const { error: dbError } = await supabase.from("site_documents").insert({
          construction_site_id: siteId!,
          company_id: profile.company_id!,
          category: "correspondence",
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          created_by: profile.id,
        });
        if (dbError) throw dbError;
      }
      queryClient.invalidateQueries({ queryKey: ["site-documents", siteId, "correspondence"] });
      toast.success("Datei hochgeladen");
    } catch {
      toast.error("Fehler beim Hochladen");
    } finally {
      setUploading(false);
    }
  };

  const deleteFileMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("site-documents").remove([doc.file_path]);
      const { error } = await supabase.from("site_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-documents", siteId, "correspondence"] });
      toast.success("Gelöscht");
    },
  });

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("site-documents").getPublicUrl(path);
    return data.publicUrl;
  };

  // Merge and sort all items chronologically
  const allItems = [
    ...entries.map((e: any) => ({ ...e, type: "text" as const })),
    ...files.map((f: any) => ({ ...f, type: "file" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-card safe-top sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1">
            <Paperclip className="w-4 h-4" />
            {uploading ? "Lädt..." : "Datei"}
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files)} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Schriftverkehr</h1>
            <p className="text-xs text-muted-foreground">{site?.customer_last_name}</p>
          </div>
        </div>

        {/* Add new entry */}
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <Textarea
            placeholder="Neuen Eintrag schreiben..."
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          <Button
            size="sm"
            onClick={() => newEntry.trim() && addEntryMutation.mutate(newEntry.trim())}
            disabled={!newEntry.trim() || addEntryMutation.isPending}
            className="gap-1"
          >
            <Plus className="w-4 h-4" />
            Hinzufügen
          </Button>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          {allItems.length === 0 && (
            <div className="bg-card border rounded-xl p-8 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Noch kein Schriftverkehr vorhanden</p>
            </div>
          )}
          {allItems.map((item: any) => (
            <div key={item.id} className="bg-card border rounded-xl p-3 space-y-1">
              {item.type === "text" ? (
                <p className="text-sm whitespace-pre-wrap">{item.content}</p>
              ) : (
                <a href={getPublicUrl(item.file_path)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <FileText className="w-4 h-4" />
                  {item.file_name}
                  <Download className="w-3.5 h-3.5 ml-auto" />
                </a>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {item.profiles?.full_name} • {new Date(item.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                {item.created_by === profile?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => item.type === "text" ? deleteEntryMutation.mutate(item.id) : deleteFileMutation.mutate(item)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default SiteCorrespondence;
