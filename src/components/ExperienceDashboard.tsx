import { useExperienceData, CategoryExperience } from "@/hooks/useExperienceData";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock, Ruler, Euro } from "lucide-react";

const confidenceConfig = {
  low: { label: "Wenig Daten", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle },
  medium: { label: "Mittel", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", icon: TrendingUp },
  high: { label: "Zuverlässig", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
};

const formatHours = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

export const ExperienceDashboard = () => {
  const { data: categories, isLoading } = useExperienceData();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <Card className="p-8 text-center">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <h3 className="text-lg font-semibold mb-1">Noch keine Erfahrungswerte</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Sobald Baustellen mit Kategorien und Maßen abgeschlossen werden, erscheinen hier
          automatisch Durchschnittswerte für die Kalkulation.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Erfahrungswerte</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Durchschnittliche Stunden pro Einheit — basierend auf abgeschlossenen Baustellen
        </p>
      </div>

      <Accordion type="multiple" defaultValue={categories.map((c) => c.categoryId)} className="space-y-3">
        {categories.map((cat) => (
          <CategoryCard key={cat.categoryId} category={cat} />
        ))}
      </Accordion>
    </div>
  );
};

const CategoryCard = ({ category }: { category: CategoryExperience }) => {
  return (
    <AccordionItem value={category.categoryId} className="border rounded-xl overflow-hidden">
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30">
        <div className="flex items-center gap-3 text-left">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Ruler className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-foreground">{category.categoryName}</span>
            <p className="text-xs text-muted-foreground">
              {category.parameters.reduce((sum, p) => sum + p.totalDataPoints, 0)} Datenpunkte
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5">
        <div className="space-y-4">
          {category.parameters.map((param) => (
            <ParameterCard key={param.parameterId} param={param} avgHourlyRate={category.avgHourlyRate} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

const ParameterCard = ({ param, avgHourlyRate }: { param: any; avgHourlyRate: number }) => {
  const conf = confidenceConfig[param.confidence as keyof typeof confidenceConfig];
  const ConfIcon = conf.icon;
  const estimatedCostPerUnit = param.weightedAvgHoursPerUnit * avgHourlyRate;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{param.parameterName}</span>
          <Badge variant="outline" className="text-[10px] font-mono">
            {param.parameterUnit}
          </Badge>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${conf.color}`}>
          <ConfIcon className="w-3.5 h-3.5" />
          {conf.label} ({param.totalDataPoints} Baustellen)
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="Ø Gewichtet"
          value={`${formatHours(param.weightedAvgHoursPerUnit)} / ${param.parameterUnit}`}
          highlight
        />
        <StatBox
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Ø Einfach"
          value={`${formatHours(param.simpleAvgHoursPerUnit)} / ${param.parameterUnit}`}
        />
        <StatBox
          icon={<BarChart3 className="w-3.5 h-3.5" />}
          label="Min / Max"
          value={`${formatHours(param.minHoursPerUnit)} – ${formatHours(param.maxHoursPerUnit)}`}
        />
        {avgHourlyRate > 0 && (
          <StatBox
            icon={<Euro className="w-3.5 h-3.5" />}
            label={`Kalk. Kosten / ${param.parameterUnit}`}
            value={formatCurrency(estimatedCostPerUnit)}
            highlight
          />
        )}
      </div>

      {/* Data Points Table */}
      {param.dataPoints.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Einzelwerte</p>
          <div className="space-y-1">
            {param.dataPoints.map((dp: any) => (
              <div
                key={dp.siteId}
                className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded ${
                  dp.isOutlier
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 line-through opacity-60"
                    : "bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{dp.siteName}</span>
                  <Badge variant="outline" className="text-[9px] h-4">
                    {dp.status === "archived" ? "Abgeschlossen" : "Aktiv"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {dp.parameterValue} {param.parameterUnit}
                  </span>
                  <span className="text-muted-foreground">
                    {formatHours(dp.totalHours)} gesamt
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatHours(dp.hoursPerUnit)} / {param.parameterUnit}
                  </span>
                  {dp.materialEk > 0 && (
                    <span className="text-muted-foreground/60 text-[10px]">
                      Mat: {formatCurrency(dp.materialEk)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatBox = ({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div className={`rounded-md p-2.5 ${highlight ? "bg-primary/5 border border-primary/20" : "bg-muted/40"}`}>
    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </div>
    <p className={`text-sm font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
  </div>
);
