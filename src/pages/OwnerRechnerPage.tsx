import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useTabNavigate } from "@/hooks/useTabNavigate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calculator, RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaterialPickerDialog } from "@/components/rechner/MaterialPickerDialog";
import { toast } from "sonner";
import { ownerAwarePath } from "@/lib/ownerRouting";

export default function OwnerRechnerPage() {
  const navigate = useTabNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projektName, setProjektName] = useState("Neues Projekt");
  const [materialEinkauf, setMaterialEinkauf] = useState(600);
  const [verschnittProzent, setVerschnittProzent] = useState(10);
  const [arbeitszeit, setArbeitszeit] = useState(18);
  const [stundenkosten, setStundenkosten] = useState(40);
  const [maschinenStundensatz, setMaschinenStundensatz] = useState(6);
  const [gemeinkostenProzent, setGemeinkostenProzent] = useState(50);
  const [risikoProzent, setRisikoProzent] = useState(5);
  const [gewinnProzent, setGewinnProzent] = useState(12);
  const [mwstProzent, setMwstProzent] = useState(19);

  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);

  // Read labor values from query params (set by LaborReferencePage)
  useEffect(() => {
    const lohnStunden = searchParams.get("lohnStunden");
    const lohnRate = searchParams.get("lohnRate");
    const lohnRef = searchParams.get("lohnRef");
    if (lohnStunden && lohnRate) {
      setArbeitszeit(Number(lohnStunden));
      setStundenkosten(Number(lohnRate));
      toast.success(`Lohnwerte von "${lohnRef}" übernommen`);
      // Clean up URL params
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const calc = useMemo(() => {
    const verschnitt = materialEinkauf * (verschnittProzent / 100);
    const materialkosten = materialEinkauf + verschnitt;
    const lohnkosten = arbeitszeit * stundenkosten;
    const maschinenkosten = arbeitszeit * maschinenStundensatz;
    const gemeinkosten = lohnkosten * (gemeinkostenProzent / 100);
    const selbstkosten = materialkosten + lohnkosten + maschinenkosten + gemeinkosten;
    const risiko = selbstkosten * (risikoProzent / 100);
    const zwischensumme = selbstkosten + risiko;
    const gewinn = zwischensumme * (gewinnProzent / 100);
    const angebotspreis = zwischensumme + gewinn;
    const mwst = angebotspreis * (mwstProzent / 100);
    const bruttopreis = angebotspreis + mwst;
    return { verschnitt, materialkosten, lohnkosten, maschinenkosten, gemeinkosten, selbstkosten, risiko, zwischensumme, gewinn, angebotspreis, mwst, bruttopreis };
  }, [materialEinkauf, verschnittProzent, arbeitszeit, stundenkosten, maschinenStundensatz, gemeinkostenProzent, risikoProzent, gewinnProzent, mwstProzent]);

  const fmt = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleReset = () => {
    setProjektName("Neues Projekt");
    setMaterialEinkauf(600);
    setVerschnittProzent(10);
    setArbeitszeit(18);
    setStundenkosten(40);
    setMaschinenStundensatz(6);
    setGemeinkostenProzent(50);
    setRisikoProzent(5);
    setGewinnProzent(12);
    setMwstProzent(19);
  };

  const handleMaterialSave = (total: number) => {
    setMaterialEinkauf(total);
    setMaterialPickerOpen(false);
  };

  // Reusable "+" button for card headers
  const PlusButton = ({ onClick, tooltip }: { onClick: () => void; tooltip: string }) => (
    <Button
      variant="default"
      size="icon"
      className="h-7 w-7 ml-auto rounded-full bg-blue-900 hover:bg-blue-800 text-white"
      onClick={onClick}
      title={tooltip}
    >
      <Plus className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Kalkulations-Rechner</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Zurücksetzen
        </Button>
      </div>

      {/* Project name */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">PROJEKT:</Label>
            <Input
              value={projektName}
              onChange={(e) => setProjektName(e.target.value)}
              className="text-lg font-semibold border-dashed"
            />
          </div>
        </CardContent>
      </Card>

      {/* 1. Material */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="text-primary border-primary font-bold">1</Badge>
            MATERIAL
            <PlusButton onClick={() => setMaterialPickerOpen(true)} tooltip="Material aus Katalog hinzufügen" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Material Einkauf</span>
            <div className="flex items-center gap-1">
              <Input type="number" value={materialEinkauf} onChange={(e) => setMaterialEinkauf(Number(e.target.value))} className="w-24 text-right font-mono text-primary border-dashed" />
              <span className="text-sm text-muted-foreground">€</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">+ Verschnitt</span>
            <div className="flex items-center gap-1">
              <Input type="number" value={verschnittProzent} onChange={(e) => setVerschnittProzent(Number(e.target.value))} className="w-20 text-right font-mono text-primary border-dashed" />
              <span className="text-sm text-muted-foreground">%</span>
              <span className="text-sm text-muted-foreground ml-3 w-20 text-right font-mono">{fmt(calc.verschnitt)} €</span>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between font-semibold">
            <span className="text-sm">= Materialkosten</span>
            <span className="font-mono">{fmt(calc.materialkosten)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Lohn */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="text-primary border-primary font-bold">2</Badge>
            LOHN
            <PlusButton onClick={() => navigate(ownerAwarePath(location.pathname, "/rechner/lohn"))} tooltip="Lohnwerte aus Baustelle übernehmen" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Arbeitszeit</span>
            <div className="flex items-center gap-1">
              <Input type="number" value={arbeitszeit} onChange={(e) => setArbeitszeit(Number(e.target.value))} className="w-20 text-right font-mono text-primary border-dashed" />
              <span className="text-sm text-muted-foreground">h</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Stundenkosten</span>
            <div className="flex items-center gap-1">
              <Input type="number" value={stundenkosten} onChange={(e) => setStundenkosten(Number(e.target.value))} className="w-20 text-right font-mono text-primary border-dashed" />
              <span className="text-sm text-muted-foreground">€/h</span>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between font-semibold">
            <span className="text-sm">= Lohnkosten</span>
            <span className="font-mono">{fmt(calc.lohnkosten)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Maschinen */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="text-primary border-primary font-bold">3</Badge>
            MASCHINEN
            <PlusButton onClick={() => {}} tooltip="Maschinen konfigurieren" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Maschinenstundensatz</span>
            <div className="flex items-center gap-1">
              <Input type="number" value={maschinenStundensatz} onChange={(e) => setMaschinenStundensatz(Number(e.target.value))} className="w-20 text-right font-mono text-primary border-dashed" />
              <span className="text-sm text-muted-foreground">€/h</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{arbeitszeit} h × {maschinenStundensatz} €</span>
            <span className="font-mono font-semibold text-foreground">{fmt(calc.maschinenkosten)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Gemeinkosten */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="text-primary border-primary font-bold">4</Badge>
            GEMEINKOSTEN
            <PlusButton onClick={() => {}} tooltip="Gemeinkosten konfigurieren" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Aufschlag auf Lohn</span>
            <div className="flex items-center gap-1">
              <Input type="number" value={gemeinkostenProzent} onChange={(e) => setGemeinkostenProzent(Number(e.target.value))} className="w-20 text-right font-mono text-primary border-dashed" />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{fmt(calc.lohnkosten)} € × {gemeinkostenProzent / 100}</span>
            <span className="font-mono font-semibold text-foreground">{fmt(calc.gemeinkosten)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* SELBSTKOSTEN */}
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-lg">SELBSTKOSTEN</span>
            <span className="font-bold text-lg font-mono text-primary">{fmt(calc.selbstkosten)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* 5. Risiko */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="text-primary border-primary font-bold">5</Badge>
            RISIKO
            <PlusButton onClick={() => {}} tooltip="Risiko konfigurieren" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Risikozuschlag</span>
            <div className="flex items-center gap-1">
              <Input type="number" value={risikoProzent} onChange={(e) => setRisikoProzent(Number(e.target.value))} className="w-20 text-right font-mono text-primary border-dashed" />
              <span className="text-sm text-muted-foreground">%</span>
              <span className="text-sm text-muted-foreground ml-3 w-20 text-right font-mono">{fmt(calc.risiko)} €</span>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between font-medium">
            <span className="text-sm">Zwischensumme</span>
            <span className="font-mono">{fmt(calc.zwischensumme)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* 6. Gewinn */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="text-primary border-primary font-bold">6</Badge>
            GEWINN
            <PlusButton onClick={() => {}} tooltip="Gewinn konfigurieren" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Gewinnmarge</span>
            <div className="flex items-center gap-1">
              <Input type="number" value={gewinnProzent} onChange={(e) => setGewinnProzent(Number(e.target.value))} className="w-20 text-right font-mono text-primary border-dashed" />
              <span className="text-sm text-muted-foreground">%</span>
              <span className="text-sm text-muted-foreground ml-3 w-20 text-right font-mono">{fmt(calc.gewinn)} €</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ANGEBOTSPREIS */}
      <Card className="border-2 border-primary bg-primary/10">
        <CardContent className="py-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xl">ANGEBOTSPREIS</span>
            <span className="font-bold text-xl font-mono text-primary">{fmt(calc.angebotspreis)} €</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">+ MwSt</span>
              <Input type="number" value={mwstProzent} onChange={(e) => setMwstProzent(Number(e.target.value))} className="w-16 text-right font-mono text-primary border-dashed h-7 text-xs" />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <span className="text-sm font-mono">{fmt(calc.mwst)} €</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="font-bold text-lg">BRUTTOPREIS</span>
            <span className="font-bold text-lg font-mono text-primary">{fmt(calc.bruttopreis)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* Material Picker Dialog */}
      <MaterialPickerDialog
        open={materialPickerOpen}
        onOpenChange={setMaterialPickerOpen}
        onSave={handleMaterialSave}
      />

    </div>
  );
}
