import { lazy } from "react";

const Owner = lazy(() => import("@/pages/Owner"));
const OwnerSiteDetail = lazy(() => import("@/pages/OwnerSiteDetail"));
const StageEmployees = lazy(() => import("@/pages/StageEmployees"));
const StageDocumentation = lazy(() => import("@/pages/StageDocumentation"));
const TimelineTemplates = lazy(() => import("@/pages/TimelineTemplates"));
const OwnerCustomerCreate = lazy(() => import("@/pages/OwnerCustomerCreate"));
const OwnerCustomPage = lazy(() => import("@/pages/OwnerCustomPage"));
const CalculatorLandingPage = lazy(() => import("@/pages/CalculatorLandingPage"));
const CalculatorParametersPage = lazy(() => import("@/pages/CalculatorParametersPage"));
const CalculatorQuotesPage = lazy(() => import("@/pages/CalculatorQuotesPage"));
const CalculatorProductsPage = lazy(() => import("@/pages/CalculatorProductsPage"));
const CalculatorCategoryPage = lazy(() => import("@/pages/CalculatorCategoryPage"));
const OwnerQuoteConfigurator = lazy(() => import("@/pages/OwnerQuoteConfigurator"));
const ProductBuilderPage = lazy(() => import("@/pages/ProductBuilderPage"));
const OwnerRechnerPage = lazy(() => import("@/pages/OwnerRechnerPage"));
const OwnerLaborReferencePage = lazy(() => import("@/pages/OwnerLaborReferencePage"));
const OwnerDeckungsbeitragPage = lazy(() => import("@/pages/OwnerDeckungsbeitragPage"));
const Settings = lazy(() => import("@/pages/Settings"));

export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  index?: boolean;
}

export const ownerRoutes: RouteConfig[] = [
  { path: "", element: <Owner />, index: true },
  { path: "site/:siteId", element: <OwnerSiteDetail /> },
  { path: "site/:siteId/stage/:stageId/employees", element: <StageEmployees /> },
  { path: "site/:siteId/stage/:stageId/documentation", element: <StageDocumentation /> },
  { path: "timeline-templates", element: <TimelineTemplates /> },
  { path: "customers/new", element: <OwnerCustomerCreate /> },
  { path: "page/:slug", element: <OwnerCustomPage /> },
  { path: "calculator", element: <CalculatorLandingPage /> },
  { path: "calculator/parameters", element: <CalculatorParametersPage /> },
  { path: "calculator/quotes", element: <CalculatorQuotesPage /> },
  { path: "calculator/products", element: <CalculatorProductsPage /> },
  { path: "calculator/:slug", element: <CalculatorCategoryPage /> },
  { path: "quote-configurator", element: <OwnerQuoteConfigurator /> },
  { path: "product-builder", element: <ProductBuilderPage /> },
  { path: "rechner", element: <OwnerRechnerPage /> },
  { path: "rechner/lohn", element: <OwnerLaborReferencePage /> },
  { path: "deckungsbeitrag", element: <OwnerDeckungsbeitragPage /> },
  { path: "settings", element: <Settings /> },
];
