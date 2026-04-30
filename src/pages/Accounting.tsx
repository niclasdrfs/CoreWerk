import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AccountManagement } from "@/components/AccountManagement";
import { TimeTracking } from "@/components/TimeTracking";
import { EmployeeTimesheet } from "@/components/EmployeeTimesheet";
import { EmployeeChatTab } from "@/components/EmployeeChatTab";
import { OwnerEmployeeManagement } from "@/components/OwnerEmployeeManagement";
import { ArrowLeft, Calculator, Users, Clock, FileText, Menu, Settings, MessageCircle, FileDown, BarChart3, Euro, TrendingUp, ShoppingCart } from "lucide-react";
import { ExcavatorIcon } from "@/components/icons/ExcavatorIcon";
import { preloadAccountingRoutes } from "@/utils/routePreload";
import { PageLoader } from "@/components/PageLoader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Lazy load heavy quote components
const AccountingQuotesView = lazy(() => import("@/components/accounting/AccountingQuotesView"));
const AccountingQuoteConfigurator = lazy(() => import("@/components/accounting/AccountingQuoteConfigurator"));
const ExperienceDashboard = lazy(() => import("@/components/ExperienceDashboardWrapper"));
const AccountingInsightsView = lazy(() => import("@/components/accounting/AccountingInsightsView"));

const ProductBuilderView = lazy(() => import("@/pages/ProductBuilderPage"));

type ViewType = "menu" | "users" | "time" | "timesheet" | "chat" | "quotes" | "quote-pdf" | "experience" | "employees" | "insights" | "product-builder";

const Accounting = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewType>("menu");
  
  // Preload accounting routes for instant navigation
  useEffect(() => {
    preloadAccountingRoutes();
  }, []);

  // Chat view uses full-screen layout like employee
  if (view === "chat") {
    return (
      <div className="min-h-screen bg-background">
        {/* Fixed top bar matching employee layout height (h-14 = top-14 for chat header) */}
        <header className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-card safe-top h-14 flex items-center px-4">
          <Button variant="ghost" onClick={() => setView("menu")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Button>
          <h2 className="font-semibold ml-2">Chat</h2>
        </header>
        <main className="container mx-auto max-w-3xl pt-14">
          <EmployeeChatTab />
        </main>
      </div>
    );
  }

  // Quote PDF configurator - full screen
  // Full-screen views with own header
  if (view === "quotes" || view === "quote-pdf" || view === "experience" || view === "insights" || view === "product-builder") {
    const title = view === "quotes" ? "Angebote" : view === "quote-pdf" ? "PDF-Angebote" : view === "insights" ? "Ist-Kosten Insights" : view === "product-builder" ? "Produkte anlegen" : "Erfahrungswerte";
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card safe-top">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={() => setView("menu")} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Zurück
              </Button>
              <h2 className="font-semibold">{title}</h2>
              <div className="w-20" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <Suspense fallback={<PageLoader />}>
            {view === "quotes" ? (
              <AccountingQuotesView />
            ) : view === "quote-pdf" ? (
              <AccountingQuoteConfigurator onBack={() => setView("menu")} />
            ) : view === "insights" ? (
              <AccountingInsightsView />
            ) : view === "product-builder" ? (
              <ProductBuilderView />
            ) : (
              <ExperienceDashboard />
            )}
          </Suspense>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card safe-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {(view !== "menu" || window.history.length > 1) && (
                <Button variant="ghost" onClick={() => view !== "menu" ? setView("menu") : navigate(-1)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Zurück
                </Button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="w-4 h-4 mr-2" />
                  Einstellungen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Calculator className="w-8 h-8 text-accent" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-foreground">
                Accounting
              </h1>
              <p className="text-lg text-muted-foreground">Buchhaltung</p>
            </div>
          </div>

          {view === "menu" && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card 
                className="p-8 cursor-pointer hover:shadow-lg transition-all duration-300 group"
                onClick={() => setView("users")}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Benutzerkonten
                    </h2>
                    <p className="text-muted-foreground">
                      Verwalten Sie Mitarbeiterkonten und Rollen
                    </p>
                  </div>
                </div>
              </Card>

              <Card 
                className="p-8 cursor-pointer hover:shadow-lg transition-all duration-300 group"
                onClick={() => setView("time")}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ExcavatorIcon className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Zeiten/Baustelle
                    </h2>
                    <p className="text-muted-foreground">
                      Einsehen von Arbeitszeiten aller Mitarbeiter
                    </p>
                  </div>
                </div>
              </Card>

              <Card 
                className="p-8 cursor-pointer hover:shadow-lg transition-all duration-300 group"
                onClick={() => setView("timesheet")}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Zeiterfassungsbogen
                    </h2>
                    <p className="text-muted-foreground">
                      Monatliche Arbeitsstunden pro Mitarbeiter als PDF
                    </p>
                  </div>
                </div>
              </Card>

              <Card 
                className="p-8 cursor-pointer hover:shadow-lg transition-all duration-300 group"
                onClick={() => setView("quotes")}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Angebote
                    </h2>
                    <p className="text-muted-foreground">
                      Angebote verwalten und Baustellen zuweisen
                    </p>
                  </div>
                </div>
              </Card>

              <Card 
                className="p-8 cursor-pointer hover:shadow-lg transition-all duration-300 group"
                onClick={() => setView("quote-pdf")}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileDown className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      PDF-Angebote
                    </h2>
                    <p className="text-muted-foreground">
                      Angebote als PDF erstellen und exportieren
                    </p>
                  </div>
                </div>
              </Card>

              <Card 
                className="p-8 cursor-pointer hover:shadow-lg transition-all duration-300 group"
                onClick={() => setView("chat")}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-10 h-10 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Chat
                    </h2>
                    <p className="text-muted-foreground">
                      Nachrichten und Urlaubsanträge
                    </p>
                  </div>
                </div>
              </Card>

              <Card 
                className="p-8 cursor-pointer hover:shadow-lg transition-all duration-300 group"
                onClick={() => setView("employees")}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Euro className="w-10 h-10 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Mitarbeiter
                    </h2>
                    <p className="text-muted-foreground">
                      Stundenlöhne und kalkulatorische Stundensätze verwalten
                    </p>
                  </div>
                </div>
              </Card>

              <Card 
                className="p-8 cursor-pointer hover:shadow-lg transition-all duration-300 group"
                onClick={() => setView("experience")}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BarChart3 className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Erfahrungswerte
                    </h2>
                    <p className="text-muted-foreground">
                      Stunden pro Einheit — automatische Kalkulation aus Baustellen
                    </p>
                  </div>
                </div>
              </Card>

              <Card 
                className="p-8 cursor-pointer hover:shadow-lg transition-all duration-300 group"
                onClick={() => setView("product-builder")}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShoppingCart className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Produkte anlegen
                    </h2>
                    <p className="text-muted-foreground">
                      Kategorien, Materialien und Angebotskalkulation
                    </p>
                  </div>
                </div>
              </Card>

              <Card 
                className="p-8 cursor-pointer hover:shadow-lg transition-all duration-300 group"
                onClick={() => setView("insights")}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-10 h-10 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Ist-Kosten
                    </h2>
                    <p className="text-muted-foreground">
                      Tatsächliche Kosten pro Baustelle — Lohn + Material
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {view === "users" && <AccountManagement />}
          {view === "time" && <TimeTracking />}
          {view === "timesheet" && <EmployeeTimesheet onBack={() => setView("menu")} />}
          {view === "employees" && <OwnerEmployeeManagement />}
        </div>
      </main>
    </div>
  );
};

export default Accounting;
