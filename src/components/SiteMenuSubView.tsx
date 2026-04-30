import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, ImagePlus, Trash2, FileText, Download,
  Image as ImageIcon, User, MapPin, Phone, Mail, Building2,
  Plus, StickyNote, MessageSquare, Paperclip,
} from "lucide-react";
import { toast } from "sonner";

interface SiteMenuSubViewProps {
  siteId: string;
  siteName: string;
  view: "plans" | "customer" | "correspondence";
  onBack: () => void;
  userId?: string;
}

export function SiteMenuSubView({ siteId, siteName, view, onBack, userId }: SiteMenuSubViewProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newEntry, setNewEntry] = useState("");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custAddress, setCustAddress] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["my-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, company_id").eq("id", userId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // ===== PLANS & IMAGES =====
  const { data: documents = [] } = useQuery({
    queryKey: ["site-documents", siteId, "plans_images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_documents")
        .select("*, profiles:created_by(full_name)")
        .eq("construction_site_id", siteId)
        .eq("category", "plans_images")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: view === "plans",
  });

  // ===== CUSTOMER INFO =====
  const { data: site } = useQuery({
    queryKey: ["construction-site-detail", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("construction_sites")
        .select("*, customers(*)")
        .eq("id", siteId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: view === "customer",
  });

  // Populate customer form when data loads
  useEffect(() => {
    if (site?.customers) {
      setCustName(site.customers.name || "");
      setCustPhone(site.customers.phone || "");
      setCustEmail(site.customers.email || "");
      setCustAddress(site.customers.address || "");
    } else if (site) {
      setCustName(site.customer_last_name || "");
      setCustPhone(site.customer_phone || "");
      setCustAddress(site.address || "");
    }
  }, [site]);

  const saveCustomerMutation = useMutation({
    mutationFn: async () => {
      if (site?.customer_id && site?.customers) {
        // Update existing customer
        const { error } = await supabase.from("customers").update({
          name: custName.trim(),
          phone: custPhone.trim() || null,
          email: custEmail.trim() || null,
          address: custAddress.trim() || null,
        }).eq("id", site.customer_id);
        if (error) throw error;
      }
      // Also update construction_sites fields
      const { error } = await supabase.from("construction_sites").update({
        customer_last_name: custName.trim(),
        customer_phone: custPhone.trim() || null,
        address: custAddress.trim() || null,
      }).eq("id", siteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-site-detail", siteId] });
      toast.success("Gespeichert");
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["site-customer-notes", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_customer_notes")
        .select("*, profiles:created_by(full_name)")
        .eq("construction_site_id", siteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: view === "customer",
  });

  // ===== CORRESPONDENCE =====
  const { data: corrEntries = [] } = useQuery({
    queryKey: ["site-correspondence", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_correspondence")
        .select("*, profiles:created_by(full_name)")
        .eq("construction_site_id", siteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: view === "correspondence",
  });

  const { data: corrFiles = [] } = useQuery({
    queryKey: ["site-documents", siteId, "correspondence"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_documents")
        .select("*, profiles:created_by(full_name)")
        .eq("construction_site_id", siteId)
        .eq("category", "correspondence")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: view === "correspondence",
  });

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("site-documents").getPublicUrl(path);
    return data.publicUrl;
  };

  const isImage = (mime: string | null) => mime?.startsWith("image/");

  const handleUpload = async (files: FileList, category: string) => {
    if (!files.length || !profile) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const filePath = `${profile.id}/${siteId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("site-documents").upload(filePath, file);
        if (uploadError) throw uploadError;
        const { error: dbError } = await supabase.from("site_documents").insert({
          construction_site_id: siteId,
          company_id: profile.company_id!,
          category,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          created_by: profile.id,
        });
        if (dbError) throw dbError;
      }
      queryClient.invalidateQueries({ queryKey: ["site-documents", siteId] });
      toast.success("Hochgeladen!");
    } catch {
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
      queryClient.invalidateQueries({ queryKey: ["site-documents", siteId] });
      toast.success("Gelöscht");
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("site_customer_notes").insert({
        construction_site_id: siteId,
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
    onError: () => toast.error("Fehler"),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("site_customer_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-customer-notes", siteId] });
      toast.success("Gelöscht");
    },
  });

  const addCorrEntryMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("site_correspondence").insert({
        construction_site_id: siteId,
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

  const deleteCorrEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("site_correspondence").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-correspondence", siteId] });
      toast.success("Gelöscht");
    },
  });

  const titleMap = { plans: "Pläne & Bilder", customer: "Kundeninfos", correspondence: "Schriftverkehr" };

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            Chat
          </Button>
          {view === "correspondence" && (
            <>
              <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1">
                <Paperclip className="w-4 h-4" />
                {uploading ? "Lädt..." : "Datei"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleUpload(e.target.files, "correspondence")}
              />
            </>
          )}
        </div>
        <div className="mt-2">
          <h1 className="text-lg font-bold">{titleMap[view]}</h1>
          <p className="text-xs text-muted-foreground">{siteName}</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        {/* ===== PLANS VIEW ===== */}
        {view === "plans" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {/* Upload card */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-card border-2 border-dashed border-border rounded-xl h-44 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <ImagePlus className="w-8 h-8" />
                <span className="text-xs font-medium">{uploading ? "Lädt..." : "Hochladen"}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.dwg,.dxf"
                className="hidden"
                onChange={(e) => e.target.files && handleUpload(e.target.files, "plans_images")}
              />
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
          </>
        )}

        {/* ===== CUSTOMER VIEW ===== */}
        {view === "customer" && (
          <>
            <div className="bg-card border rounded-xl p-4 space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Name
                  </label>
                  <Input
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="Name eingeben..."
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Telefon
                  </label>
                  <Input
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="Telefonnummer..."
                    type="tel"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> E-Mail
                  </label>
                  <Input
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="E-Mail-Adresse..."
                    type="email"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Adresse
                  </label>
                  <Input
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                    placeholder="Straße, PLZ Ort..."
                    className="text-sm"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => saveCustomerMutation.mutate()}
                disabled={!custName.trim() || saveCustomerMutation.isPending}
                className="w-full"
              >
                {saveCustomerMutation.isPending ? "Speichert..." : "Speichern"}
              </Button>

              {/* Quick action links */}
              {(custPhone || custAddress) && (
                <div className="flex gap-2 pt-1">
                  {custPhone && (
                    <a href={`tel:${custPhone}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-medium text-primary hover:bg-muted transition-colors">
                      <Phone className="w-3.5 h-3.5" /> Anrufen
                    </a>
                  )}
                  {custAddress && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(custAddress)}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-medium text-primary hover:bg-muted transition-colors">
                      <MapPin className="w-3.5 h-3.5" /> Navigation
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="font-semibold text-sm">Notizen</span>
              </div>
              <Textarea
                placeholder="Notiz hinzufügen..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[60px] text-sm"
              />
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
          </>
        )}

        {/* ===== CORRESPONDENCE VIEW ===== */}
        {view === "correspondence" && (
          <>
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <Textarea
                placeholder="Neuen Eintrag schreiben..."
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                className="min-h-[80px] text-sm"
              />
              <Button
                size="sm"
                onClick={() => newEntry.trim() && addCorrEntryMutation.mutate(newEntry.trim())}
                disabled={!newEntry.trim() || addCorrEntryMutation.isPending}
                className="gap-1"
              >
                <Plus className="w-4 h-4" />
                Hinzufügen
              </Button>
            </div>

            {(() => {
              const allItems = [
                ...corrEntries.map((e: any) => ({ ...e, type: "text" as const })),
                ...corrFiles.map((f: any) => ({ ...f, type: "file" as const })),
              ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              if (allItems.length === 0) {
                return (
                  <div className="bg-card border rounded-xl p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Noch kein Schriftverkehr vorhanden</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
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
                            onClick={() => item.type === "text" ? deleteCorrEntryMutation.mutate(item.id) : deleteMutation.mutate(item)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}