import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const BLOCK_TYPES = [
  { value: "article", label: "Artikelzuweisung" },
  { value: "yes_no", label: "Ja/Nein-Option" },
  { value: "labor", label: "Arbeitsstunden" },
  { value: "travel", label: "Anfahrtskosten" },
  { value: "selection", label: "Auswahl" },
  { value: "fixed_cost", label: "Festkosten" },
];

const UNIT_OPTIONS = [
  { value: "meter", label: "Meter (m)" },
  { value: "work_hours", label: "Arbeitsstunden (Std.)" },
  { value: "eur_per_hour", label: "€/Stunde" },
  { value: "eur_per_day", label: "€/Tag" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  companyId: string;
  block?: any;
}

export function ConfiguratorBlockDialog({ open, onOpenChange, categoryId, companyId, block }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [blockType, setBlockType] = useState("article");
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    if (open) {
      setName(block?.name || "");
      setBlockType(block?.block_type || "article");
      setConfig(block?.config || {});
    }
  }, [open, block]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (block) {
        const { error } = await supabase
          .from("product_configurator_blocks")
          .update({ name, block_type: blockType, config })
          .eq("id", block.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("product_configurator_blocks")
          .insert({
            name,
            block_type: blockType,
            config,
            category_id: categoryId,
            company_id: companyId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurator-blocks"] });
      toast.success(block ? "Baustein aktualisiert" : "Baustein erstellt");
      onOpenChange(false);
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const updateConfig = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{block ? "Baustein bearbeiten" : "Neuer Baustein"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Kran" />
          </div>
          <div>
            <Label>Typ</Label>
            <Select value={blockType} onValueChange={(v) => { setBlockType(v); setConfig({}); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Einheit</Label>
            <Select value={config.unit || ""} onValueChange={(v) => updateConfig("unit", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Einheit wählen…" />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type-specific config fields */}
          {blockType === "yes_no" && (
            <div className="space-y-3 border rounded-lg p-3">
              <h4 className="text-sm font-medium">Ja/Nein Konfiguration</h4>
              <div>
                <Label>Stundensatz (€) wenn Ja</Label>
                <Input
                  type="number"
                  value={config.hourly_rate || ""}
                  onChange={(e) => updateConfig("hourly_rate", Number(e.target.value))}
                  placeholder="z.B. 120"
                />
              </div>
              <div>
                <Label>Standard-Stunden</Label>
                <Input
                  type="number"
                  value={config.default_hours || ""}
                  onChange={(e) => updateConfig("default_hours", Number(e.target.value))}
                  placeholder="z.B. 4"
                />
              </div>
            </div>
          )}

          {blockType === "labor" && (
            <div className="space-y-3 border rounded-lg p-3">
              <h4 className="text-sm font-medium">Arbeitsstunden Konfiguration</h4>
              <div>
                <Label>Standard Anzahl Arbeiter</Label>
                <Input
                  type="number"
                  value={config.default_workers || ""}
                  onChange={(e) => updateConfig("default_workers", Number(e.target.value))}
                  placeholder="z.B. 3"
                />
              </div>
              <div>
                <Label>Standard Stundensatz (€)</Label>
                <Input
                  type="number"
                  value={config.default_hourly_rate || ""}
                  onChange={(e) => updateConfig("default_hourly_rate", Number(e.target.value))}
                  placeholder="z.B. 55"
                />
              </div>
              <div>
                <Label>Standard Stunden</Label>
                <Input
                  type="number"
                  value={config.default_hours || ""}
                  onChange={(e) => updateConfig("default_hours", Number(e.target.value))}
                  placeholder="z.B. 8"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.use_profile_rate || false}
                  onCheckedChange={(v) => updateConfig("use_profile_rate", v)}
                />
                <Label>Stundensatz aus Mitarbeiter-Profil verwenden</Label>
              </div>
            </div>
          )}

          {blockType === "travel" && (
            <div className="space-y-3 border rounded-lg p-3">
              <h4 className="text-sm font-medium">Anfahrtskosten Konfiguration</h4>
              <div>
                <Label>Kostensatz pro km (€)</Label>
                <Input
                  type="number"
                  value={config.cost_per_km || ""}
                  onChange={(e) => updateConfig("cost_per_km", Number(e.target.value))}
                  placeholder="z.B. 0.50"
                  step="0.01"
                />
              </div>
              <div>
                <Label>Standard km</Label>
                <Input
                  type="number"
                  value={config.default_km || ""}
                  onChange={(e) => updateConfig("default_km", Number(e.target.value))}
                  placeholder="z.B. 50"
                />
              </div>
            </div>
          )}

          {blockType === "fixed_cost" && (
            <div className="space-y-3 border rounded-lg p-3">
              <h4 className="text-sm font-medium">Festkosten Konfiguration</h4>
              <div>
                <Label>Betrag (€)</Label>
                <Input
                  type="number"
                  value={config.amount || ""}
                  onChange={(e) => updateConfig("amount", Number(e.target.value))}
                  placeholder="z.B. 500"
                />
              </div>
            </div>
          )}

          {blockType === "selection" && (
            <div className="space-y-3 border rounded-lg p-3">
              <h4 className="text-sm font-medium">Auswahl-Optionen</h4>
              {(config.options || []).map((opt: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={opt.label}
                    onChange={(e) => {
                      const opts = [...(config.options || [])];
                      opts[idx] = { ...opts[idx], label: e.target.value, value: e.target.value.toLowerCase() };
                      updateConfig("options", opts);
                    }}
                    placeholder="Label"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={opt.factor ?? ""}
                    onChange={(e) => {
                      const opts = [...(config.options || [])];
                      opts[idx] = { ...opts[idx], factor: Number(e.target.value) };
                      updateConfig("options", opts);
                    }}
                    placeholder="Faktor"
                    className="w-24"
                    step="0.1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive shrink-0"
                    onClick={() => {
                      const opts = (config.options || []).filter((_: any, i: number) => i !== idx);
                      updateConfig("options", opts);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const opts = [...(config.options || []), { label: "", value: "", factor: 1.0 }];
                  updateConfig("options", opts);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Option hinzufügen
              </Button>
            </div>
          )}

          {blockType === "article" && (
            <div className="border rounded-lg p-3">
              <p className="text-sm text-muted-foreground">
                Artikel aus dem Kalkulator können nach dem Erstellen zugewiesen werden.
              </p>
              <div className="mt-2">
                <Label>Standard-Aufschlag (%)</Label>
                <Input
                  type="number"
                  value={config.default_markup || ""}
                  onChange={(e) => updateConfig("default_markup", Number(e.target.value))}
                  placeholder="z.B. 15"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
            {block ? "Speichern" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
