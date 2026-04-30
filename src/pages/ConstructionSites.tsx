import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Archive, Calendar, Search, ChevronDown, MapPin, Phone } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const ConstructionSites = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isNewSiteOpen, setIsNewSiteOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isFutureOpen, setIsFutureOpen] = useState(false);
  
  const [customerLastName, setCustomerLastName] = useState("");
  const [status, setStatus] = useState<"active" | "future">("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveSort, setArchiveSort] = useState<"name" | "date">("date");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: activeSites, isLoading: loadingActive } = useQuery({
    queryKey: ["construction-sites", "active", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("construction_sites")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const { data: archivedSites } = useQuery({
    queryKey: ["construction-sites", "archived", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("construction_sites")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("status", "archived")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id && isArchiveOpen,
  });

  const { data: futureSites } = useQuery({
    queryKey: ["construction-sites", "future", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("construction_sites")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("status", "future")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id && isFutureOpen,
  });

  const createSiteMutation = useMutation({
    mutationFn: async (newSite: {
      customer_last_name: string;
      status: string;
      start_date?: string;
      end_date?: string;
      notes?: string;
      address?: string;
      customer_phone?: string;
    }) => {
      if (!profile?.company_id || !user?.id) throw new Error("Missing required data");
      
      const { data, error } = await supabase
        .from("construction_sites")
        .insert({
          company_id: profile.company_id,
          created_by: user.id,
          customer_last_name: newSite.customer_last_name,
          status: newSite.status,
          start_date: newSite.start_date || null,
          end_date: newSite.end_date || null,
          notes: newSite.notes || null,
          address: newSite.address || null,
          customer_phone: newSite.customer_phone || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-sites"] });
      toast.success("Baustelle erfolgreich erstellt!", { duration: 2000 });
      setIsNewSiteOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Fehler beim Erstellen der Baustelle: " + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ siteId, newStatus }: { siteId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("construction_sites")
        .update({ status: newStatus })
        .eq("id", siteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-sites"] });
      toast.success("Status erfolgreich geändert!");
    },
    onError: (error) => {
      toast.error("Fehler beim Ändern des Status: " + error.message);
    },
  });

  const resetForm = () => {
    setCustomerLastName("");
    setStatus("active");
    setStartDate("");
    setEndDate("");
    setNotes("");
    setAddress("");
    setCustomerPhone("");
  };

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerLastName.trim()) {
      toast.error("Bitte geben Sie den Nachnamen des Kunden ein");
      return;
    }
    
    createSiteMutation.mutate({
      customer_last_name: customerLastName,
      status,
      start_date: startDate,
      end_date: endDate,
      notes,
      address,
      customer_phone: customerPhone,
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const filteredArchivedSites = archivedSites
    ?.filter(site =>
      site.customer_last_name.toLowerCase().includes(archiveSearch.toLowerCase())
    )
    .sort((a, b) => {
      if (archiveSort === "name") {
        return a.customer_last_name.localeCompare(b.customer_last_name);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={() => navigate("/installation-manager")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück zum Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Baustellen verwalten</h1>
            <p className="text-lg text-muted-foreground">Alle Baustellen und Montagen im Überblick</p>
          </div>

          <div className="flex justify-center">
            <Dialog open={isNewSiteOpen} onOpenChange={setIsNewSiteOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Neue Baustelle/Montage hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Neue Baustelle hinzufügen</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSite} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">Nachname des Kunden *</Label>
                    <Input
                      id="customer-name"
                      value={customerLastName}
                      onChange={(e) => setCustomerLastName(e.target.value)}
                      placeholder="z.B. Müller"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select value={status} onValueChange={(value: "active" | "future") => setStatus(value)}>
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Aktiv</SelectItem>
                        <SelectItem value="future">Ausstehend</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date">Startdatum</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">Enddatum</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Adresse der Baustelle</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="z.B. Musterstraße 12, 12345 Berlin"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefonnummer des Kunden</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="z.B. 0170 1234567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notizen</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optionale Notizen zur Baustelle"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsNewSiteOpen(false)}>
                      Abbrechen
                    </Button>
                    <Button type="submit" disabled={createSiteMutation.isPending}>
                      {createSiteMutation.isPending ? "Wird erstellt..." : "Baustelle erstellen"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Aktive Baustellen</h2>
            {loadingActive ? (
              <div className="text-center py-8 text-muted-foreground">Lädt...</div>
            ) : activeSites && activeSites.length > 0 ? (
              <div className="grid gap-4">
                {activeSites.map((site) => (
                  <Card key={site.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Baustelle: {site.customer_last_name}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50 gap-1">
                              Aktiv
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background">
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ siteId: site.id, newStatus: "active" })}>
                              Aktiv
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ siteId: site.id, newStatus: "archived" })}>
                              Archivieren
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ siteId: site.id, newStatus: "future" })}>
                              Ausstehend
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {site.address && (
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {site.address}
                          </a>
                        </div>
                      )}
                      {site.customer_phone && (
                        <div className="flex items-center gap-2 mb-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <a href={`tel:${site.customer_phone}`} className="text-primary hover:underline">
                            {site.customer_phone}
                          </a>
                        </div>
                      )}
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {site.start_date && (
                          <span>Gestartet: {formatDate(site.start_date)}</span>
                        )}
                        {site.end_date && (
                          <span>Geplantes Ende: {formatDate(site.end_date)}</span>
                        )}
                      </div>
                      {site.notes && (
                        <p className="mt-2 text-sm text-muted-foreground">{site.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Keine aktiven Baustellen vorhanden</p>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-8">
            <Dialog open={isArchiveOpen} onOpenChange={setIsArchiveOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="w-full gap-2">
                  <Archive className="w-5 h-5" />
                  Baustellenarchiv
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Baustellenarchiv</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pb-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Suche nach Kundenname..."
                        value={archiveSearch}
                        onChange={(e) => setArchiveSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={archiveSort} onValueChange={(value: "name" | "date") => setArchiveSort(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sortieren nach..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="date">Nach Datum (neueste zuerst)</SelectItem>
                        <SelectItem value="name">Nach Name (A-Z)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-4 overflow-y-auto flex-1">
                  {filteredArchivedSites && filteredArchivedSites.length > 0 ? (
                    filteredArchivedSites.map((site) => (
                      <Card key={site.id}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span>Baustelle: {site.customer_last_name}</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="bg-gray-100 dark:bg-gray-800 gap-1">
                                  Archiviert
                                  <ChevronDown className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background">
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ siteId: site.id, newStatus: "active" })}>
                                  Aktiv setzen
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ siteId: site.id, newStatus: "future" })}>
                                  Ausstehend setzen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {site.address && (
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {site.address}
                              </a>
                            </div>
                          )}
                          {site.customer_phone && (
                            <div className="flex items-center gap-2 mb-2">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <a href={`tel:${site.customer_phone}`} className="text-primary hover:underline">
                                {site.customer_phone}
                              </a>
                            </div>
                          )}
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            {site.start_date && <span>Start: {formatDate(site.start_date)}</span>}
                            {site.end_date && <span>Ende: {formatDate(site.end_date)}</span>}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Keine archivierten Baustellen</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isFutureOpen} onOpenChange={setIsFutureOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="w-full gap-2">
                  <Calendar className="w-5 h-5" />
                  Ausstehende Baustellen
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Ausstehende Baustellen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {futureSites && futureSites.length > 0 ? (
                    futureSites.map((site) => (
                      <Card key={site.id}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span>Baustelle: {site.customer_last_name}</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 gap-1">
                                  Ausstehend
                                  <ChevronDown className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background">
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ siteId: site.id, newStatus: "active" })}>
                                  Aktiv setzen
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ siteId: site.id, newStatus: "archived" })}>
                                  Archivieren
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {site.address && (
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {site.address}
                              </a>
                            </div>
                          )}
                          {site.customer_phone && (
                            <div className="flex items-center gap-2 mb-2">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <a href={`tel:${site.customer_phone}`} className="text-primary hover:underline">
                                {site.customer_phone}
                              </a>
                            </div>
                          )}
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            {site.start_date && <span>Geplanter Start: {formatDate(site.start_date)}</span>}
                            {site.end_date && <span>Geplantes Ende: {formatDate(site.end_date)}</span>}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Keine ausstehenden Baustellen</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConstructionSites;
