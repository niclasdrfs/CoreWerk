import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ImagePlus, Trash2, FileText, Download, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const SitePlansImages = () => {
  const navigate = useNavigate();
  const { siteId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
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

  const { data: documents = [] } = useQuery({
    queryKey: ["site-documents", siteId, "plans_images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_documents")
        .select("*, profiles:created_by(full_name)")
        .eq("construction_site_id", siteId!)
        .eq("category", "plans_images")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!siteId,
  });

  const handleUpload = async (files: FileList) => {
    if (!files.length || !profile) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const filePath = `${profile.id}/${siteId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("site-documents").upload(filePath, file);
        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from("site_documents").insert({
          construction_site_id: siteId!,
          company_id: profile.company_id!,
          category: "plans_images",
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          created_by: profile.id,
        });
        if (dbError) throw dbError;
      }
      queryClient.invalidateQueries({ queryKey: ["site-documents", siteId, "plans_images"] });
      toast.success("Hochgeladen!");
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Hochladen");
    } finally {
      setUploading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("site-documents").remove([doc.file_path]);
      const { error } = await supabase.from("site_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-documents", siteId, "plans_images"] });
      toast.success("Gelöscht");
    },
  });

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("site-documents").getPublicUrl(path);
    return data.publicUrl;
  };

  const isImage = (mime: string | null) => mime?.startsWith("image/");

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-card safe-top sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1">
            <ImagePlus className="w-4 h-4" />
            {uploading ? "Lädt..." : "Hochladen"}
          </Button>
          <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.dwg,.dxf" className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files)} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Pläne & Bilder</h1>
            <p className="text-xs text-muted-foreground">{site?.customer_last_name}</p>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="bg-card border rounded-xl p-8 text-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Noch keine Dateien hochgeladen</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {documents.map((doc: any) => (
              <div key={doc.id} className="bg-card border rounded-xl overflow-hidden">
                {isImage(doc.mime_type) ? (
                  <a href={getPublicUrl(doc.file_path)} target="_blank" rel="noopener noreferrer">
                    <img src={getPublicUrl(doc.file_path)} alt={doc.file_name} className="w-full h-32 object-cover" />
                  </a>
                ) : (
                  <a href={getPublicUrl(doc.file_path)} target="_blank" rel="noopener noreferrer" className="w-full h-32 flex items-center justify-center bg-muted">
                    <FileText className="w-10 h-10 text-muted-foreground" />
                  </a>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{doc.file_name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("de-DE")}</span>
                    <div className="flex gap-1">
                      <a href={getPublicUrl(doc.file_path)} download className="text-muted-foreground hover:text-foreground">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      {doc.created_by === profile?.id && (
                        <button onClick={() => deleteMutation.mutate(doc)} className="text-destructive hover:text-destructive/80">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SitePlansImages;
