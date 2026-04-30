import { useState, useMemo } from "react";
import { useExperienceData } from "@/hooks/useExperienceData";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, Clock, Euro, AlertTriangle, CheckCircle2 } from "lucide-react";

const confidenceConfig = {
  low: { label: "Wenig Daten", color: "text-amber-600 dark:text-amber-400", icon: AlertTriangle },
  medium: { label: "Mittel", color: "text-blue-600 dark:text-blue-400", icon: TrendingUp },
  high: { label: "Zuverlässig", color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
};

const formatHours = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

export const LaborEstimationCard = () => {
  const { data: categories, isLoading } = useExperienceData();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [paramValues, setParamValues] = useState<Record<string, number>>({});

  const selectedCategory = useMemo(
    () => categories?.find((c) => c.categoryId === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const estimation = useMemo(() => {
    if (!selectedCategory) return null;

    let totalEstimatedHours = 0;
    let totalEstimatedCost = 0;
    const breakdowns: { name: string; unit: string; qty: number; hpu: number; hours: number; cost: number; confidence: string }[] = [];

    selectedCategory.parameters.forEach((param) => {
      const qty = paramValues[param.parameterId] || 0;
      if (qty > 0 && param.weightedAvgHoursPerUnit > 0) {
        const hours = qty * param.weightedAvgHoursPerUnit;
        const cost = hours * selectedCategory.avgHourlyRate;
        totalEstimatedHours += hours;
        totalEstimatedCost += cost;
        breakdowns.push({
          name: param.parameterName,
          unit: param.parameterUnit,
          qty,
          hpu: param.weightedAvgHoursPerUnit,
          hours,
          cost,
          confidence: param.confidence,
        });
      }
    });

    return { totalEstimatedHours, totalEstimatedCost, breakdowns };
  }, [selectedCategory, paramValues]);

  if (isLoading || !categories || categories.length === 0) return null;

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        <Label className="text-sm font-semibold text-primary">Lohnkosten-Schätzung</Label>
        <Badge variant="outline" className="text-[10px] ml-auto">
          Erfahrungswerte
        </Badge>
      </div>

      {/* Category Selection */}
      <Select value={selectedCategoryId} onValueChange={(v) => { setSelectedCategoryId(v); setParamValues({}); }}>
        <SelectTrigger className="h-9 bg-background">
          <SelectValue placeholder="Kategorie auswählen..." />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat.categoryId} value={cat.categoryId}>
              {cat.categoryName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Parameter Inputs */}
      {selectedCategory && (
        <div className="grid gap-2 sm:grid-cols-2">
          {selectedCategory.parameters.map((param) => {
            const conf = confidenceConfig[param.confidence];
            const ConfIcon = conf.icon;
            return (
              <div key={param.parameterId} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">{param.parameterName}</Label>
                  <Badge variant="outline" className="text-[9px] font-mono h-4">
                    {param.parameterUnit}
                  </Badge>
                  <ConfIcon className={`w-3 h-3 ml-auto ${conf.color}`} />
                </div>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0"
                  className="h-8 bg-background text-sm"
                  value={paramValues[param.parameterId] || ""}
                  onChange={(e) =>
                    setParamValues((prev) => ({
                      ...prev,
                      [param.parameterId]: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
                {param.weightedAvgHoursPerUnit > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Ø {formatHours(param.weightedAvgHoursPerUnit)} / {param.parameterUnit}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Estimation Result */}
      {estimation && estimation.breakdowns.length > 0 && (
        <div className="border-t border-primary/20 pt-3 space-y-2">
          {estimation.breakdowns.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {b.qty} {b.unit} × {formatHours(b.hpu)}/{b.unit}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-medium">{formatHours(b.hours)}</span>
                {b.cost > 0 && (
                  <span className="text-primary font-semibold">{formatCurrency(b.cost)}</span>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 border-t border-primary/20">
            <span className="text-sm font-semibold">Geschätzte Lohnkosten</span>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{formatHours(estimation.totalEstimatedHours)} Stunden</p>
              <p className="text-lg font-bold text-primary flex items-center gap-1">
                {formatCurrency(estimation.totalEstimatedCost)}
                <Euro className="w-4 h-4" />
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
