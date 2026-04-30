import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, RotateCcw, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function OwnerDeckungsbeitragPage() {
  // Erlöse
  const [erloes, setErloes] = useState(10000);

  // Variable Kosten
  const [materialkosten, setMaterialkosten] = useState(2500);
  const [fertigungsloehne, setFertigungsloehne] = useState(1500);
  const [maschinenkosten, setMaschinenkosten] = useState(400);
  const [frachtkosten, setFrachtkosten] = useState(200);
  const [sonstigeVariable, setSonstigeVariable] = useState(0);

  // Produktfixkosten (DB II)
  const [produktAbschreibungen, setProduktAbschreibungen] = useState(300);
  const [produktWartung, setProduktWartung] = useState(100);
  const [sonstigeProduktfix, setSonstigeProduktfix] = useState(0);

  // Bereichsfixkosten (DB III)
  const [abteilungsleitung, setAbteilungsleitung] = useState(500);
  const [raumkosten, setRaumkosten] = useState(300);
  const [sonstigeBereichsfix, setSonstigeBereichsfix] = useState(0);

  // Unternehmensfixkosten (Betriebsergebnis)
  const [verwaltung, setVerwaltung] = useState(400);
  const [miete, setMiete] = useState(600);
  const [versicherungen, setVersicherungen] = useState(200);
  const [sonstigeUnternehmensfix, setSonstigeUnternehmensfix] = useState(0);

  const calc = useMemo(() => {
    const variableKosten = materialkosten + fertigungsloehne + maschinenkosten + frachtkosten + sonstigeVariable;
    const db1 = erloes - variableKosten;
    const db1Prozent = erloes > 0 ? (db1 / erloes) * 100 : 0;

    const produktFixkosten = produktAbschreibungen + produktWartung + sonstigeProduktfix;
    const db2 = db1 - produktFixkosten;
    const db2Prozent = erloes > 0 ? (db2 / erloes) * 100 : 0;

    const bereichsFixkosten = abteilungsleitung + raumkosten + sonstigeBereichsfix;
    const db3 = db2 - bereichsFixkosten;
    const db3Prozent = erloes > 0 ? (db3 / erloes) * 100 : 0;

    const unternehmensFixkosten = verwaltung + miete + versicherungen + sonstigeUnternehmensfix;
    const betriebsergebnis = db3 - unternehmensFixkosten;
    const betriebsergebnisProzent = erloes > 0 ? (betriebsergebnis / erloes) * 100 : 0;

    return {
      variableKosten, db1, db1Prozent,
      produktFixkosten, db2, db2Prozent,
      bereichsFixkosten, db3, db3Prozent,
      unternehmensFixkosten, betriebsergebnis, betriebsergebnisProzent,
    };
  }, [erloes, materialkosten, fertigungsloehne, maschinenkosten, frachtkosten, sonstigeVariable,
      produktAbschreibungen, produktWartung, sonstigeProduktfix,
      abteilungsleitung, raumkosten, sonstigeBereichsfix,
      verwaltung, miete, versicherungen, sonstigeUnternehmensfix]);

  const fmt = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const handleReset = () => {
    setErloes(10000);
    setMaterialkosten(2500);
    setFertigungsloehne(1500);
    setMaschinenkosten(400);
    setFrachtkosten(200);
    setSonstigeVariable(0);
    setProduktAbschreibungen(300);
    setProduktWartung(100);
    setSonstigeProduktfix(0);
    setAbteilungsleitung(500);
    setRaumkosten(300);
    setSonstigeBereichsfix(0);
    setVerwaltung(400);
    setMiete(600);
    setVersicherungen(200);
    setSonstigeUnternehmensfix(0);
  };

  const InfoTip = ({ text }: { text: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );

  const InputRow = ({ label, value, onChange, info }: { label: string; value: number; onChange: (v: number) => void; info?: string }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        {info && <InfoTip text={info} />}
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 text-right font-mono text-primary border-dashed"
        />
        <span className="text-sm text-muted-foreground">€</span>
      </div>
    </div>
  );

  const dbColor = (value: number) => value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive";
  const dbBg = (value: number) => value >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Deckungsbeitragsrechner</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Zurücksetzen
        </Button>
      </div>

      {/* Erlöse */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            ERLÖSE / UMSATZ
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Nettoerlös</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={erloes}
                onChange={(e) => setErloes(Number(e.target.value))}
                className="w-28 text-right font-mono text-primary border-dashed text-lg font-semibold"
              />
              <span className="text-sm text-muted-foreground">€</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variable Kosten */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="text-primary border-primary font-bold">–</Badge>
            VARIABLE KOSTEN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <InputRow label="Materialkosten" value={materialkosten} onChange={setMaterialkosten} info="Rohstoffe, Zukaufteile, Hilfsstoffe" />
          <InputRow label="Fertigungslöhne" value={fertigungsloehne} onChange={setFertigungsloehne} info="Direkt zurechenbare Löhne" />
          <InputRow label="Maschinenkosten" value={maschinenkosten} onChange={setMaschinenkosten} info="Variable Maschinenkosten (Strom, Verschleiß)" />
          <InputRow label="Frachtkosten" value={frachtkosten} onChange={setFrachtkosten} info="Transport- und Versandkosten" />
          <InputRow label="Sonstige variable Kosten" value={sonstigeVariable} onChange={setSonstigeVariable} />
          <Separator />
          <div className="flex items-center justify-between font-semibold text-sm">
            <span>= Summe variable Kosten</span>
            <span className="font-mono">{fmt(calc.variableKosten)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* DB I */}
      <Card className={`border-2 ${dbBg(calc.db1)}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">DECKUNGSBEITRAG I</span>
              <InfoTip text="Erlöse minus variable Kosten. Zeigt, was zur Deckung der Fixkosten übrig bleibt." />
            </div>
            <div className="text-right">
              <span className={`font-bold text-lg font-mono ${dbColor(calc.db1)}`}>{fmt(calc.db1)} €</span>
              <span className={`text-sm ml-2 ${dbColor(calc.db1)}`}>({fmtPct(calc.db1Prozent)}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Produktfixkosten */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="text-primary border-primary font-bold">–</Badge>
            PRODUKTFIXKOSTEN
            <InfoTip text="Fixkosten, die einem bestimmten Produkt direkt zugerechnet werden können." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <InputRow label="Abschreibungen (produktspezifisch)" value={produktAbschreibungen} onChange={setProduktAbschreibungen} />
          <InputRow label="Wartung & Instandhaltung" value={produktWartung} onChange={setProduktWartung} />
          <InputRow label="Sonstige Produktfixkosten" value={sonstigeProduktfix} onChange={setSonstigeProduktfix} />
          <Separator />
          <div className="flex items-center justify-between font-semibold text-sm">
            <span>= Summe Produktfixkosten</span>
            <span className="font-mono">{fmt(calc.produktFixkosten)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* DB II */}
      <Card className={`border-2 ${dbBg(calc.db2)}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">DECKUNGSBEITRAG II</span>
              <InfoTip text="DB I minus Produktfixkosten. Zeigt die Rentabilität einzelner Produkte." />
            </div>
            <div className="text-right">
              <span className={`font-bold text-lg font-mono ${dbColor(calc.db2)}`}>{fmt(calc.db2)} €</span>
              <span className={`text-sm ml-2 ${dbColor(calc.db2)}`}>({fmtPct(calc.db2Prozent)}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bereichsfixkosten */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="text-primary border-primary font-bold">–</Badge>
            BEREICHSFIXKOSTEN
            <InfoTip text="Fixkosten, die einer Abteilung oder einem Bereich zugeordnet werden." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <InputRow label="Abteilungsleitung" value={abteilungsleitung} onChange={setAbteilungsleitung} />
          <InputRow label="Raumkosten (Bereich)" value={raumkosten} onChange={setRaumkosten} />
          <InputRow label="Sonstige Bereichsfixkosten" value={sonstigeBereichsfix} onChange={setSonstigeBereichsfix} />
          <Separator />
          <div className="flex items-center justify-between font-semibold text-sm">
            <span>= Summe Bereichsfixkosten</span>
            <span className="font-mono">{fmt(calc.bereichsFixkosten)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* DB III */}
      <Card className={`border-2 ${dbBg(calc.db3)}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">DECKUNGSBEITRAG III</span>
              <InfoTip text="DB II minus Bereichsfixkosten. Zeigt den Beitrag zum Unternehmensergebnis." />
            </div>
            <div className="text-right">
              <span className={`font-bold text-lg font-mono ${dbColor(calc.db3)}`}>{fmt(calc.db3)} €</span>
              <span className={`text-sm ml-2 ${dbColor(calc.db3)}`}>({fmtPct(calc.db3Prozent)}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unternehmensfixkosten */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="text-primary border-primary font-bold">–</Badge>
            UNTERNEHMENSFIXKOSTEN
            <InfoTip text="Allgemeine Fixkosten, die dem gesamten Unternehmen zugeordnet werden." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <InputRow label="Verwaltung / Geschäftsführung" value={verwaltung} onChange={setVerwaltung} />
          <InputRow label="Miete / Grundstück" value={miete} onChange={setMiete} />
          <InputRow label="Versicherungen" value={versicherungen} onChange={setVersicherungen} />
          <InputRow label="Sonstige Unternehmensfixkosten" value={sonstigeUnternehmensfix} onChange={setSonstigeUnternehmensfix} />
          <Separator />
          <div className="flex items-center justify-between font-semibold text-sm">
            <span>= Summe Unternehmensfixkosten</span>
            <span className="font-mono">{fmt(calc.unternehmensFixkosten)} €</span>
          </div>
        </CardContent>
      </Card>

      {/* Betriebsergebnis */}
      <Card className={`border-2 ${calc.betriebsergebnis >= 0 ? "border-emerald-500 bg-emerald-500/10" : "border-destructive bg-destructive/10"}`}>
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl">BETRIEBSERGEBNIS</span>
              <InfoTip text="DB III minus Unternehmensfixkosten = Gewinn oder Verlust." />
            </div>
            <div className="text-right">
              <span className={`font-bold text-xl font-mono ${dbColor(calc.betriebsergebnis)}`}>{fmt(calc.betriebsergebnis)} €</span>
              <span className={`text-sm ml-2 ${dbColor(calc.betriebsergebnis)}`}>({fmtPct(calc.betriebsergebnisProzent)}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
