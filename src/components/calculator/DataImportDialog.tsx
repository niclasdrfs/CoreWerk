import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, FileSpreadsheet, File, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface DataImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onImportComplete: () => void;
}

type ImportFormat = "datanorm" | "gaeb" | "csv" | "excel";

interface PreviewArticle {
  article_number: string;
  name: string;
  unit: string;
  price: number;
  supplier: string;
}

const formatLabels: Record<ImportFormat, { label: string; icon: React.ElementType; accept: string }> = {
  datanorm: { label: "Datanorm", icon: FileText, accept: ".001,.dat,.wrg,.rab,.dnm" },
  gaeb: { label: "GAEB", icon: File, accept: ".xml,.x83,.x84,.d83,.d84" },
  csv: { label: "CSV", icon: FileText, accept: ".csv,.txt" },
  excel: { label: "Excel", icon: FileSpreadsheet, accept: ".xlsx,.xls,.csv" },
};

export const DataImportDialog = ({
  open,
  onOpenChange,
  companyId,
  onImportComplete,
}: DataImportDialogProps) => {
  const [format, setFormat] = useState<ImportFormat>("datanorm");
  const [file, setFile] = useState<File | null>(null);
  const [supplierHint, setSupplierHint] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    categories_created: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const resetState = useCallback(() => {
    setFile(null);
    setSupplierHint("");
    setCategoryName("");
    setIsImporting(false);
    setProgress(0);
    setResult(null);
  }, []);

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) setFile(droppedFile);
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file || !companyId) return;

    setIsImporting(true);
    setProgress(20);

    try {
      // Read file as base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Content = btoa(binary);

      setProgress(40);

      const { data, error } = await supabase.functions.invoke("import-articles", {
        body: {
          format: format === "datanorm" ? "datanorm4" : format,
          content: base64Content,
          company_id: companyId,
          supplier_hint: supplierHint || undefined,
          category_name: categoryName || undefined,
          file_name: file.name,
        },
      });

      setProgress(90);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data);
      setProgress(100);

      toast.success(
        `Import abgeschlossen: ${data.created} neu, ${data.updated} aktualisiert`
      );

      onImportComplete();
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error(err.message || "Fehler beim Import");
      setProgress(0);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Artikel importieren
          </DialogTitle>
        </DialogHeader>

        {result ? (
          // Result view
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg">
              <CheckCircle2 className="w-8 h-8 text-primary" />
              <div>
                <h3 className="font-semibold text-lg">Import abgeschlossen</h3>
                <p className="text-muted-foreground">
                  Die Artikel wurden erfolgreich importiert.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-3xl font-bold text-primary">{result.created}</p>
                <p className="text-sm text-muted-foreground">Neue Artikel</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-3xl font-bold">{result.updated}</p>
                <p className="text-sm text-muted-foreground">Aktualisiert</p>
              </div>
              {result.categories_created > 0 && (
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-3xl font-bold">{result.categories_created}</p>
                  <p className="text-sm text-muted-foreground">Neue Kategorien</p>
                </div>
              )}
              {result.skipped > 0 && (
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-3xl font-bold text-muted-foreground">{result.skipped}</p>
                  <p className="text-sm text-muted-foreground">Übersprungen</p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Schließen</Button>
            </div>
          </div>
        ) : (
          // Import form
          <div className="space-y-6">
            {/* Format Selection */}
            <Tabs value={format} onValueChange={(v) => { setFormat(v as ImportFormat); setFile(null); }}>
              <TabsList className="w-full grid grid-cols-4">
                {Object.entries(formatLabels).map(([key, { label, icon: Icon }]) => (
                  <TabsTrigger key={key} value={key} className="gap-1.5 text-xs sm:text-sm">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* File Upload */}
            <div
              className={`
                border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}
                ${file ? "border-primary/50 bg-primary/5" : ""}
              `}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("import-file-input")?.click()}
            >
              <input
                id="import-file-input"
                type="file"
                className="hidden"
                accept={formatLabels[format].accept}
                onChange={handleFileChange}
              />
              {file ? (
                <div className="space-y-2">
                  <FileText className="w-10 h-10 mx-auto text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <Badge variant="secondary">{formatLabels[format].label}</Badge>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                  <p className="font-medium">Datei hierher ziehen oder klicken</p>
                  <p className="text-sm text-muted-foreground">
                    Akzeptiert: {formatLabels[format].accept}
                  </p>
                </div>
              )}
            </div>

            {/* Category Name */}
            <div className="space-y-2">
              <Label htmlFor="category-name-input">
                Kategoriename
              </Label>
              <Input
                id="category-name-input"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="z.B. Wurth, Schüco, Befestigungen..."
              />
              <p className="text-xs text-muted-foreground">
                Alle Artikel werden in diese eine Kategorie importiert. Ordner entstehen automatisch.
              </p>
            </div>

            {/* Supplier Hint */}
            <div className="space-y-2">
              <Label htmlFor="supplier-hint">
                Hersteller / Lieferant <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="supplier-hint"
                value={supplierHint}
                onChange={(e) => setSupplierHint(e.target.value)}
                placeholder="z.B. Schüco, Salamander, Roto..."
              />
              <p className="text-xs text-muted-foreground">
                Fallback-Name falls kein Kategoriename angegeben und nicht aus der Datei erkennbar.
              </p>
            </div>

            {/* Progress */}
            {isImporting && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">
                  Importiere Artikel...
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isImporting}>
                Abbrechen
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || isImporting || (!categoryName.trim() && !supplierHint.trim())}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importieren
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
