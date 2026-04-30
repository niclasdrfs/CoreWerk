import { useState, useRef } from "react";
import { useParams, useSearchParams, useLocation } from "react-router-dom";
import { useTabNavigate } from "@/hooks/useTabNavigate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Camera,
  FileText,
  Upload,
  Plus,
  Image,
  File,
  Trash2,
  User,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

const StageDocumentation = () => {
  const { siteId, stageId } = useParams<{ siteId: string; stageId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useTabNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isOwnerRoute = location.pathname.startsWith("/owner");
  const goBack = () => isOwnerRoute ? navigate(`/owner/site/${siteId}`) : navigate(-1);
  const queryClient = useQueryClient();
  
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const activeTab = searchParams.get("tab") || "photos";

  const { data, isLoading, error } = useQuery({
    queryKey: ["stage-documentation", stageId],
    queryFn: async () => {
      if (!stageId || !user) throw new Error("Invalid request");

      // Get stage info
      const { data: stage, error: stageError } = await supabase
        .from("construction_site_timeline_stages")
        .select(`
          id,
          name,
          construction_site_timelines (
            construction_sites (
              id,
              customer_last_name
            )
          )
        `)
        .eq("id", stageId)
        .maybeSingle();

      if (stageError) throw stageError;
      if (!stage) throw new Error("Stufe nicht gefunden");

      // Get documentation for this stage
      const { data: docs, error: docsError } = await supabase
        .from("stage_documentation")
        .select(`
          id,
          type,
          title,
          content,
          file_path,
          file_name,
          file_size,
          mime_type,
          created_at,
          uploader:profiles!stage_documentation_uploaded_by_fkey (
            id,
            full_name
          )
        `)
        .eq("stage_id", stageId)
        .order("created_at", { ascending: false });

      if (docsError) throw docsError;

      const timeline = stage.construction_site_timelines as {
        construction_sites: { id: string; customer_last_name: string } | null;
      } | null;

      return {
        stageName: stage.name,
        siteName: timeline?.construction_sites?.customer_last_name || "Unbekannt",
        documentation: (docs || []).map(d => ({
          id: d.id,
          type: d.type as "photo" | "note" | "document",
          title: d.title,
          content: d.content,
          filePath: d.file_path,
          fileName: d.file_name,
          fileSize: d.file_size,
          mimeType: d.mime_type,
          createdAt: d.created_at,
          uploaderName: (d.uploader as { full_name: string | null })?.full_name || "Unbekannt",
        })),
      };
    },
    enabled: !!stageId && !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: "photo" | "document" }) => {
      if (!user || !stageId) throw new Error("Invalid state");

      const filePath = `${user.id}/${stageId}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("site-documentation")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("stage_documentation")
        .insert({
          stage_id: stageId,
          uploaded_by: user.id,
          type,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-documentation", stageId] });
      toast.success("Datei hochgeladen");
    },
    onError: () => {
      toast.error("Fehler beim Hochladen");
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !stageId) throw new Error("Invalid state");

      const { error } = await supabase
        .from("stage_documentation")
        .insert({
          stage_id: stageId,
          uploaded_by: user.id,
          type: "note",
          title: noteTitle || null,
          content: noteContent,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-documentation", stageId] });
      setNoteDialogOpen(false);
      setNoteTitle("");
      setNoteContent("");
      toast.success("Notiz erstellt");
    },
    onError: () => {
      toast.error("Fehler beim Erstellen der Notiz");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ docId, filePath }: { docId: string; filePath?: string | null }) => {
      if (filePath) {
        await supabase.storage.from("site-documentation").remove([filePath]);
      }
      
      const { error } = await supabase
        .from("stage_documentation")
        .delete()
        .eq("id", docId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-documentation", stageId] });
      toast.success("Gelöscht");
    },
    onError: () => {
      toast.error("Fehler beim Löschen");
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "photo" | "document") => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      uploadMutation.mutate({ file, type });
    });

    e.target.value = "";
  };

  const getFileUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from("site-documentation")
      .createSignedUrl(filePath, 3600);
    return data?.signedUrl;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 min-h-screen bg-background">
        <header className="border-b border-border bg-card safe-top">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <Skeleton className="h-6 w-48" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 min-h-screen bg-background">
        <header className="border-b border-border bg-card safe-top">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <Button variant="ghost" size="sm" onClick={goBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="p-6">
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Stufe nicht gefunden"}
            </p>
          </Card>
        </main>
      </div>
    );
  }

  const photos = data.documentation.filter(d => d.type === "photo");
  const notes = data.documentation.filter(d => d.type === "note");
  const documents = data.documentation.filter(d => d.type === "document");

  return (
    <div className="flex-1 min-h-screen bg-background">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück zur Baustelle
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Header */}
          <div>
            <p className="text-sm text-muted-foreground mb-1">{data.siteName}</p>
            <h1 className="text-3xl font-bold text-foreground">Dokumentation</h1>
            <p className="text-lg text-muted-foreground mt-1">Stufe: {data.stageName}</p>
          </div>

          {/* Hidden file inputs */}
          <input
            type="file"
            ref={photoInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={(e) => handleFileUpload(e, "photo")}
          />
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
            multiple
            onChange={(e) => handleFileUpload(e, "document")}
          />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="photos" className="gap-2">
                <Camera className="w-4 h-4" />
                Fotos ({photos.length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-2">
                <FileText className="w-4 h-4" />
                Notizen ({notes.length})
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-2">
                <File className="w-4 h-4" />
                Dokumente ({documents.length})
              </TabsTrigger>
            </TabsList>

            {/* Photos Tab */}
            <TabsContent value="photos" className="mt-6">
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Fotos</h2>
                  <Button onClick={() => photoInputRef.current?.click()} className="gap-2">
                    <Upload className="w-4 h-4" />
                    Foto hochladen
                  </Button>
                </div>

                {photos.length === 0 ? (
                  <div className="py-8 text-center">
                    <Image className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Noch keine Fotos hochgeladen</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo) => (
                      <DocumentCard
                        key={photo.id}
                        doc={photo}
                        onDelete={() => deleteMutation.mutate({ docId: photo.id, filePath: photo.filePath })}
                        getFileUrl={getFileUrl}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-6">
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Notizen</h2>
                  <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        Neue Notiz
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Neue Notiz erstellen</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <Input
                          placeholder="Titel (optional)"
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                        />
                        <Textarea
                          placeholder="Notiz eingeben..."
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          rows={5}
                        />
                        <Button
                          onClick={() => createNoteMutation.mutate()}
                          disabled={!noteContent.trim() || createNoteMutation.isPending}
                          className="w-full"
                        >
                          Notiz speichern
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {notes.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Noch keine Notizen erstellt</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="p-4 rounded-lg bg-muted/30 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            {note.title && (
                              <h3 className="font-medium">{note.title}</h3>
                            )}
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {note.content}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate({ docId: note.id, filePath: null })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {note.uploaderName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(note.createdAt).toLocaleDateString("de-DE")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-6">
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Dokumente</h2>
                  <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <Upload className="w-4 h-4" />
                    Dokument hochladen
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <div className="py-8 text-center">
                    <File className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Noch keine Dokumente hochgeladen</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <File className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{doc.fileName}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{formatFileSize(doc.fileSize)}</span>
                              <span>{doc.uploaderName}</span>
                              <span>{new Date(doc.createdAt).toLocaleDateString("de-DE")}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate({ docId: doc.id, filePath: doc.filePath })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

// Photo card component
const DocumentCard = ({
  doc,
  onDelete,
  getFileUrl,
}: {
  doc: {
    id: string;
    filePath: string | null;
    fileName: string | null;
    uploaderName: string;
    createdAt: string;
  };
  onDelete: () => void;
  getFileUrl: (path: string) => Promise<string | undefined>;
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const loadImage = async () => {
    if (doc.filePath && !imageUrl) {
      const url = await getFileUrl(doc.filePath);
      if (url) setImageUrl(url);
    }
  };

  return (
    <div
      className="relative aspect-square rounded-lg overflow-hidden bg-muted group cursor-pointer"
      onClick={loadImage}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={doc.fileName || "Foto"}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <Image className="w-8 h-8 text-muted-foreground mb-2" />
          <span className="text-xs text-muted-foreground">Klicken zum Laden</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
        <div className="text-white text-xs">
          <p className="truncate">{doc.uploaderName}</p>
          <p>{new Date(doc.createdAt).toLocaleDateString("de-DE")}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:text-destructive hover:bg-destructive/20"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default StageDocumentation;
