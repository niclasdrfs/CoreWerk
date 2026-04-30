import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Building2, Clock, Archive, Check, Layers, User } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CategorySelectDropdown } from "./CategorySelectDropdown";

interface ConstructionSite {
  id: string;
  customer_last_name: string;
  address: string | null;
  customer_phone: string | null;
  color: string | null;
  status: string;
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  category_id?: string | null;
}

interface ConstructionSiteEditDialogProps {
  site: ConstructionSite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "edit" | "create";
  companyId?: string;
  userId?: string;
}

type SiteStatus = "active" | "future" | "archived";

const statusLabels: Record<SiteStatus, string> = {
  active: "Aktiv",
  future: "Ausstehend",
  archived: "Archiviert",
};

export function ConstructionSiteEditDialog({
  site,
  open,
  onOpenChange,
  mode = "edit",
  companyId,
  userId,
}: ConstructionSiteEditDialogProps) {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<SiteStatus>("active");
  const [color, setColor] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Fetch user's profile for company_id
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch customers for selection
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, company_name, address, phone, email, customer_type")
        .eq("company_id", profile.company_id)
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Auto-fill form when customer is selected
  const handleCustomerSelect = (customerId: string) => {
    if (customerId === "manual") {
      setSelectedCustomerId(null);
      return;
    }
    
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setSelectedCustomerId(customerId);
      setCustomerName(customer.company_name || customer.name);
      setAddress(customer.address || "");
      setPhone(customer.phone || "");
    }
  };

  // Fetch timeline templates filtered by category
  const { data: timelineTemplates = [] } = useQuery({
    queryKey: ["timeline-templates-for-select", profile?.company_id, categoryId],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      let query = supabase
        .from("timeline_templates")
        .select(`
          id,
          name,
          category_id,
          is_default,
          timeline_template_stages (
            id,
            name,
            display_order
          )
        `)
        .eq("company_id", profile.company_id);
      
      // Filter: Nur Templates dieser Kategorie ODER ohne Kategorie (universelle Vorlagen)
      if (categoryId) {
        query = query.or(`category_id.eq.${categoryId},category_id.is.null`);
      }
      
      const { data, error } = await query.order("name");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Reset template selection when category changes and current selection is no longer valid
  useEffect(() => {
    if (selectedTemplateId && timelineTemplates.length > 0) {
      const templateStillValid = timelineTemplates.some(t => t.id === selectedTemplateId);
      if (!templateStillValid) {
        setSelectedTemplateId(null);
      }
    }
  }, [categoryId, timelineTemplates, selectedTemplateId]);

  const presetColors = [
    { value: null, label: "Standard" },
    { value: "#EF4444", label: "Rot" },
    { value: "#F97316", label: "Orange" },
    { value: "#EAB308", label: "Gelb" },
    { value: "#22C55E", label: "Grün" },
    { value: "#10B981", label: "Smaragd" },
    { value: "#14B8A6", label: "Türkis" },
    { value: "#06B6D4", label: "Cyan" },
    { value: "#3B82F6", label: "Blau" },
    { value: "#6366F1", label: "Indigo" },
    { value: "#8B5CF6", label: "Violett" },
    { value: "#A855F7", label: "Lila" },
    { value: "#EC4899", label: "Pink" },
  ];

  const resetForm = () => {
    setSelectedCustomerId(null);
    setCustomerName("");
    setAddress("");
    setPhone("");
    setNotes("");
    setStartDate("");
    setEndDate("");
    setStatus("active");
    setColor(null);
    setCategoryId(null);
    setSelectedTemplateId(null);
  };

  // Reset form when site changes or dialog opens in create mode
  useEffect(() => {
    if (mode === "edit" && site) {
      setCustomerName(site.customer_last_name || "");
      setAddress(site.address || "");
      setPhone(site.customer_phone || "");
      setNotes(site.notes || "");
      setStartDate(site.start_date || "");
      setEndDate(site.end_date || "");
      setStatus((site.status as SiteStatus) || "active");
      setColor(site.color || null);
      setCategoryId(site.category_id || null);
    } else if (mode === "create" && open) {
      resetForm();
    }
  }, [site, mode, open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !userId) throw new Error("Company or User ID missing");
      
      const trimmedName = customerName.trim();
      if (!trimmedName) {
        throw new Error("Kundenname ist erforderlich");
      }
      if (trimmedName.length > 100) {
        throw new Error("Kundenname darf maximal 100 Zeichen haben");
      }

      // Create construction site
      const { data: newSite, error } = await supabase
        .from("construction_sites")
        .insert({
          customer_last_name: trimmedName,
          address: address.trim() || null,
          customer_phone: phone.trim() || null,
          notes: notes.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          status: status,
          color: color,
          category_id: categoryId,
          customer_id: selectedCustomerId,
          company_id: companyId,
          created_by: userId,
        })
        .select("id")
        .single();

      if (error) throw error;

      // If a timeline template is selected, create the timeline with stages
      if (selectedTemplateId && newSite) {
        const selectedTemplate = timelineTemplates.find(t => t.id === selectedTemplateId);
        if (selectedTemplate) {
          // Create the timeline
          const { data: newTimeline, error: timelineError } = await supabase
            .from("construction_site_timelines")
            .insert({
              construction_site_id: newSite.id,
              template_id: selectedTemplateId,
              is_custom: false,
              current_stage_index: 0,
            })
            .select("id")
            .single();

          if (timelineError) throw timelineError;

          // Create the stages from template
          if (newTimeline && selectedTemplate.timeline_template_stages) {
            const stagesToInsert = selectedTemplate.timeline_template_stages
              .sort((a, b) => a.display_order - b.display_order)
              .map((stage, index) => ({
                timeline_id: newTimeline.id,
                name: stage.name,
                display_order: index,
                is_completed: false,
              }));

            const { error: stagesError } = await supabase
              .from("construction_site_timeline_stages")
              .insert(stagesToInsert);

            if (stagesError) throw stagesError;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-sites"] });
      queryClient.invalidateQueries({ queryKey: ["calendarData"] });
      queryClient.invalidateQueries({ queryKey: ["owner-sites-hours"] });
      queryClient.invalidateQueries({ queryKey: ["site-timeline"] });
      toast.success("Baustelle erfolgreich angelegt", { duration: 2000 });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Fehler beim Anlegen der Baustelle");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!site) throw new Error("No site selected");
      
      const trimmedName = customerName.trim();
      if (!trimmedName) {
        throw new Error("Kundenname ist erforderlich");
      }
      if (trimmedName.length > 100) {
        throw new Error("Kundenname darf maximal 100 Zeichen haben");
      }

      const { error } = await supabase
        .from("construction_sites")
        .update({
          customer_last_name: trimmedName,
          address: address.trim() || null,
          customer_phone: phone.trim() || null,
          notes: notes.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          status: status,
          color: color,
          category_id: categoryId,
        })
        .eq("id", site.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-sites"] });
      queryClient.invalidateQueries({ queryKey: ["calendarData"] });
      toast.success("Baustelle aktualisiert");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Fehler beim Speichern");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!site) throw new Error("No site selected");

      // First delete related daily_assignments and their dependencies
      const { data: assignments } = await supabase
        .from("daily_assignments")
        .select("id")
        .eq("construction_site_id", site.id);

      if (assignments && assignments.length > 0) {
        const assignmentIds = assignments.map(a => a.id);
        
        // Delete employee_assignments
        await supabase
          .from("employee_assignments")
          .delete()
          .in("daily_assignment_id", assignmentIds);
        
        // Delete assignment_materials
        await supabase
          .from("assignment_materials")
          .delete()
          .in("daily_assignment_id", assignmentIds);
        
        // Delete assignment_packing_list
        await supabase
          .from("assignment_packing_list")
          .delete()
          .in("daily_assignment_id", assignmentIds);
        
        // Delete employee_material_todos
        await supabase
          .from("employee_material_todos")
          .delete()
          .in("daily_assignment_id", assignmentIds);
        
        // Delete employee_custom_todos
        await supabase
          .from("employee_custom_todos")
          .delete()
          .in("daily_assignment_id", assignmentIds);
        
        // Delete daily_assignments
        await supabase
          .from("daily_assignments")
          .delete()
          .eq("construction_site_id", site.id);
      }

      // Finally delete the construction site
      const { error } = await supabase
        .from("construction_sites")
        .delete()
        .eq("id", site.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-sites"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
      toast.success("Baustelle gelöscht");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Delete error:", error);
      toast.error("Fehler beim Löschen der Baustelle");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "create") {
      createMutation.mutate();
    } else {
      updateMutation.mutate();
    }
  };

  const isLoading = updateMutation.isPending || deleteMutation.isPending || createMutation.isPending;
  const isCreateMode = mode === "create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: color || "hsl(var(--muted))" }}
            />
            <span>{isCreateMode ? "Neue Baustelle anlegen" : "Baustelle bearbeiten"}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Customer Selection (only in create mode, only for owners) */}
          {isCreateMode && customers.length > 0 && hasRole("owner") && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Aus Kundenkartei übernehmen
              </Label>
              <Select 
                value={selectedCustomerId || "manual"} 
                onValueChange={handleCustomerSelect}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kunde auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manuell eingeben</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name 
                        ? `${customer.company_name}${customer.name ? ` (${customer.name})` : ""}`
                        : customer.name
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Customer Name */}
          <div className="space-y-2">
            <Label htmlFor="customerName">Kundenname *</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Name des Kunden"
              maxLength={100}
              required
              disabled={isLoading}
              autoFocus={!isCreateMode || customers.length === 0}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as SiteStatus)} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {status === "active" && <Building2 className="h-4 w-4 text-emerald-500" />}
                    {status === "future" && <Clock className="h-4 w-4 text-blue-500" />}
                    {status === "archived" && <Archive className="h-4 w-4 text-gray-500" />}
                    <span>{statusLabels[status]}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-500" />
                    <span>Aktiv</span>
                  </div>
                </SelectItem>
                <SelectItem value="future">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>Ausstehend</span>
                  </div>
                </SelectItem>
                <SelectItem value="archived">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-gray-500" />
                    <span>Archiviert</span>
                  </div>
                </SelectItem>
              </SelectContent>
          </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Kategorie</Label>
            <CategorySelectDropdown
              selectedCategoryId={categoryId}
              onCategoryChange={setCategoryId}
              disabled={isLoading}
            />
          </div>

          {/* Timeline Template (only in create mode) */}
          {isCreateMode && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Zeitstrahl-Vorlage
              </Label>
              {timelineTemplates.length > 0 ? (
                <>
                  <Select
                    value={selectedTemplateId || "none"}
                    onValueChange={(v) => setSelectedTemplateId(v === "none" ? null : v)}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Keine Vorlage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Vorlage</SelectItem>
                      {timelineTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex flex-col">
                            <span>{template.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {template.timeline_template_stages?.length || 0} Stufen
                              {!template.category_id && " • Universell"}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplateId && (
                    <p className="text-xs text-muted-foreground">
                      Der Zeitstrahl wird automatisch mit der Vorlage erstellt.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  {categoryId 
                    ? "Keine Vorlagen für diese Kategorie vorhanden."
                    : "Wähle zuerst eine Kategorie, um passende Vorlagen zu sehen."}
                </p>
              )}
            </div>
          )}

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Farbe im Kalender</Label>
            <div className="flex flex-wrap gap-2">
              {presetColors.map((preset) => (
                <button
                  key={preset.value || "default"}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  disabled={isLoading}
                  className={`
                    w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all
                    ${color === preset.value 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-transparent hover:border-muted-foreground/30"
                    }
                    ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                  style={{ 
                    backgroundColor: preset.value || "hsl(var(--muted))",
                  }}
                  title={preset.label}
                >
                  {color === preset.value && (
                    <Check 
                      className="h-4 w-4" 
                      style={{ 
                        color: preset.value ? "white" : "hsl(var(--muted-foreground))" 
                      }} 
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Straße, PLZ Ort"
              maxLength={255}
              disabled={isLoading}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Telefonnummer"
              type="tel"
              maxLength={50}
              disabled={isLoading}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Startdatum</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Enddatum</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Informationen zur Baustelle..."
              rows={3}
              maxLength={2000}
              disabled={isLoading}
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            {/* Delete Button with Confirmation - only in edit mode */}
            {!isCreateMode && site && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full sm:w-auto"
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Löschen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Baustelle löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Diese Aktion kann nicht rückgängig gemacht werden. Die Baustelle 
                      "{site.customer_last_name}" und alle zugehörigen Zuweisungen werden 
                      dauerhaft gelöscht.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Endgültig löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-none"
                disabled={isLoading}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                className="flex-1 sm:flex-none"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {isCreateMode ? "Anlegen" : "Speichern"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
