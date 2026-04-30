/**
 * App – Wurzelkomponente
 *
 * Struktur:
 * - ErrorBoundary       → Fängt unerwartete Render-Fehler ab
 * - AppUpdateProvider   → PWA-Update-Benachrichtigungen
 * - TooltipProvider     → Globale Tooltip-Unterstützung (Radix)
 * - BrowserRouter       → Client-seitiges Routing
 *   - AuthProvider      → Authentifizierung & Rollen
 *     - RealtimeProvider → Supabase Realtime-Subscriptions
 *       - Suspense      → Lazy-Loading für Seiten
 *         - Routes      → Alle App-Routen
 *
 * Routen-Zugriffskontrolle:
 *   ProtectedRoute prüft Rollen client-seitig (für UX).
 *   Die eigentliche Sicherheit liegt in Supabase RLS auf DB-Ebene.
 */
import { lazy, Suspense, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RealtimeProvider } from "./components/RealtimeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineBanner } from "./components/OfflineBanner";
import { UpdateBanner } from "./components/UpdateBanner";
import { AppUpdateProvider } from "./contexts/AppUpdateContext";
import { PageLoader } from "./components/PageLoader";
import { VoiceAssistantButton } from "./components/VoiceAssistantButton";

// Eagerly loaded – wird sofort für den Login benötigt
import Index from "./pages/Index";

// ── Lazy-geladene Seiten ──────────────────────────────────────────────────────
// Jede Seite wird erst bei Navigation geladen → kleinere initiale Bundle-Größe
const OwnerLayout               = lazy(() => import("./layouts/OwnerLayout").then((m) => ({ default: m.OwnerLayout })));
const OberMontageleiterLayout   = lazy(() => import("./layouts/OberMontageleiterLayout"));
const InstallationManager       = lazy(() => import("./pages/InstallationManager"));
const OberMontageleiter         = lazy(() => import("./pages/OberMontageleiter"));
const ConstructionSites         = lazy(() => import("./pages/ConstructionSites"));
const ConstructionSiteDetail    = lazy(() => import("./pages/ConstructionSiteDetail"));
const AssignmentEmployees       = lazy(() => import("./pages/AssignmentEmployees"));
const Owner                     = lazy(() => import("./pages/Owner"));
const OwnerSiteDetail           = lazy(() => import("./pages/OwnerSiteDetail"));
const OwnerCustomPage           = lazy(() => import("./pages/OwnerCustomPage"));
const OwnerCustomerCreate       = lazy(() => import("./pages/OwnerCustomerCreate"));
const CalculatorLandingPage     = lazy(() => import("./pages/CalculatorLandingPage"));
const CalculatorParametersPage  = lazy(() => import("./pages/CalculatorParametersPage"));
const CalculatorCategoryPage    = lazy(() => import("./pages/CalculatorCategoryPage"));
const CalculatorQuotesPage      = lazy(() => import("./pages/CalculatorQuotesPage"));
const CalculatorProductsPage    = lazy(() => import("./pages/CalculatorProductsPage"));
const OwnerQuoteConfigurator    = lazy(() => import("./pages/OwnerQuoteConfigurator"));
const ProductBuilderPage        = lazy(() => import("./pages/ProductBuilderPage"));
const OwnerRechnerPage          = lazy(() => import("./pages/OwnerRechnerPage"));
const OwnerLaborReferencePage   = lazy(() => import("./pages/OwnerLaborReferencePage"));
const OwnerDeckungsbeitragPage  = lazy(() => import("./pages/OwnerDeckungsbeitragPage"));
const StageEmployees            = lazy(() => import("./pages/StageEmployees"));
const StageDocumentation        = lazy(() => import("./pages/StageDocumentation"));
const TimelineTemplates         = lazy(() => import("./pages/TimelineTemplates"));
const Accounting                = lazy(() => import("./pages/Accounting"));
const Employee                  = lazy(() => import("./pages/Employee"));
const EmployeeWorkday           = lazy(() => import("./pages/EmployeeWorkday"));
const Settings                  = lazy(() => import("./pages/Settings"));
const Install                   = lazy(() => import("./pages/Install"));
const MyTimeEntries             = lazy(() => import("./pages/MyTimeEntries"));
const NotFound                  = lazy(() => import("./pages/NotFound"));
const SiteCustomerInfo          = lazy(() => import("./pages/SiteCustomerInfo"));
const SitePlansImages           = lazy(() => import("./pages/SitePlansImages"));
const SiteCorrespondence        = lazy(() => import("./pages/SiteCorrespondence"));
const SiteContact               = lazy(() => import("./pages/SiteContact"));

// ── Hilfsfunktionen für kompakte Route-Definitionen ──────────────────────────
const guard = (role: Parameters<typeof ProtectedRoute>[0]["requiredRole"], el: JSX.Element) => (
  <ProtectedRoute requiredRole={role}>{el}</ProtectedRoute>
);
const im  = (el: JSX.Element) => guard("installation_manager", el);
const om  = (el: JSX.Element) => guard("ober_montageleiter", el);
const emp = (el: JSX.Element) => guard("employee", el);

const App = () => {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return (
  <ErrorBoundary>
    <AppUpdateProvider>
    <TooltipProvider>
      <OfflineBanner />
      <UpdateBanner />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RealtimeProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route
                path="/installation-manager"
                element={
                  <ProtectedRoute requiredRole="installation_manager">
                    <InstallationManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/installation-manager/baustellen"
                element={
                  <ProtectedRoute requiredRole="installation_manager">
                    <ConstructionSites />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/installation-manager/baustellen/:siteId"
                element={
                  <ProtectedRoute requiredRole="installation_manager">
                    <ConstructionSiteDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/installation-manager/einsatz/:assignmentId"
                element={
                  <ProtectedRoute requiredRole="installation_manager">
                    <AssignmentEmployees />
                  </ProtectedRoute>
                }
              />
              <Route path="/installation-manager/site/:siteId/kundeninfo" element={<ProtectedRoute requiredRole="installation_manager"><SiteCustomerInfo /></ProtectedRoute>} />
              <Route path="/installation-manager/site/:siteId/plaene" element={<ProtectedRoute requiredRole="installation_manager"><SitePlansImages /></ProtectedRoute>} />
              <Route path="/installation-manager/site/:siteId/schriftverkehr" element={<ProtectedRoute requiredRole="installation_manager"><SiteCorrespondence /></ProtectedRoute>} />
              <Route path="/installation-manager/site/:siteId/kontakt" element={<ProtectedRoute requiredRole="installation_manager"><SiteContact /></ProtectedRoute>} />
              <Route
                path="/installation-manager/site/:siteId/stage/:stageId/employees"
                element={
                  <ProtectedRoute requiredRole="installation_manager">
                    <StageEmployees />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/installation-manager/site/:siteId/stage/:stageId/documentation"
                element={
                  <ProtectedRoute requiredRole="installation_manager">
                    <StageDocumentation />
                  </ProtectedRoute>
                }
              />
              {/* Owner routes with sidebar layout */}
              <Route
                path="/owner/*"
                element={
                  <ProtectedRoute requiredRole="owner">
                    <OwnerLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Owner />} />
                <Route path="site/:siteId" element={<OwnerSiteDetail />} />
                <Route path="site/:siteId/stage/:stageId/employees" element={<StageEmployees />} />
                <Route path="site/:siteId/stage/:stageId/documentation" element={<StageDocumentation />} />
                <Route path="timeline-templates" element={<TimelineTemplates />} />
                <Route path="customers/new" element={<OwnerCustomerCreate />} />
                <Route path="page/:slug" element={<OwnerCustomPage />} />
                <Route path="calculator" element={<CalculatorLandingPage />} />
                <Route path="calculator/parameters" element={<CalculatorParametersPage />} />
                <Route path="calculator/quotes" element={<CalculatorQuotesPage />} />
                <Route path="calculator/products" element={<CalculatorProductsPage />} />
                <Route path="calculator/:slug" element={<CalculatorCategoryPage />} />
                <Route path="quote-configurator" element={<OwnerQuoteConfigurator />} />
                <Route path="product-builder" element={<ProductBuilderPage />} />
                <Route path="rechner" element={<OwnerRechnerPage />} />
                <Route path="rechner/lohn" element={<OwnerLaborReferencePage />} />
                <Route path="deckungsbeitrag" element={<OwnerDeckungsbeitragPage />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              {/* Ober-Montageleiter routes with tab layout */}
              <Route
                path="/ober-montageleiter/*"
                element={
                  <ProtectedRoute requiredRole="ober_montageleiter">
                    <OberMontageleiterLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<OberMontageleiter />} />
                <Route path="baustellen" element={<ConstructionSites />} />
                <Route path="baustellen/:siteId" element={<ConstructionSiteDetail />} />
                <Route path="einsatz/:assignmentId" element={<AssignmentEmployees />} />
                <Route path="site/:siteId/kundeninfo" element={<SiteCustomerInfo />} />
                <Route path="site/:siteId/plaene" element={<SitePlansImages />} />
                <Route path="site/:siteId/schriftverkehr" element={<SiteCorrespondence />} />
                <Route path="site/:siteId/kontakt" element={<SiteContact />} />
                <Route path="site/:siteId/stage/:stageId/employees" element={<StageEmployees />} />
                <Route path="site/:siteId/stage/:stageId/documentation" element={<StageDocumentation />} />
                <Route path="meine-buchungen" element={<MyTimeEntries />} />
              </Route>
              <Route
                path="/accounting"
                element={
                  <ProtectedRoute requiredRole="accounting">
                    <Accounting />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <Employee />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee/workday"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <EmployeeWorkday />
                  </ProtectedRoute>
                }
              />
              <Route path="/employee/baustellen/:siteId" element={<ProtectedRoute requiredRole="employee"><ConstructionSiteDetail /></ProtectedRoute>} />
              <Route path="/employee/site/:siteId/kundeninfo" element={<ProtectedRoute requiredRole="employee"><SiteCustomerInfo /></ProtectedRoute>} />
              <Route path="/employee/site/:siteId/plaene" element={<ProtectedRoute requiredRole="employee"><SitePlansImages /></ProtectedRoute>} />
              <Route path="/employee/site/:siteId/schriftverkehr" element={<ProtectedRoute requiredRole="employee"><SiteCorrespondence /></ProtectedRoute>} />
              <Route path="/employee/site/:siteId/kontakt" element={<ProtectedRoute requiredRole="employee"><SiteContact /></ProtectedRoute>} />
              <Route
                path="/employee/einsatz/:assignmentId"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <AssignmentEmployees />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee/site/:siteId/stage/:stageId/documentation"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <StageDocumentation />
                  </ProtectedRoute>
                }
              />
              {/* My Time Entries routes */}
              <Route path="/installation-manager/meine-buchungen" element={<ProtectedRoute requiredRole="installation_manager"><MyTimeEntries /></ProtectedRoute>} />
              
              <Route path="/employee/meine-buchungen" element={<ProtectedRoute requiredRole="employee"><MyTimeEntries /></ProtectedRoute>} />
              <Route path="/install" element={<Install />} />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <VoiceAssistantButton />
          </RealtimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </AppUpdateProvider>
  </ErrorBoundary>
  );
};

export default App;
