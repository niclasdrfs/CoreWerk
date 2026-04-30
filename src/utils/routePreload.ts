// Route component preloaders - call these to preload lazy components
export const preloadRoutes = {
  // Owner routes
  owner: () => import("@/pages/Owner"),
  ownerSiteDetail: () => import("@/pages/OwnerSiteDetail"),
  ownerCustomPage: () => import("@/pages/OwnerCustomPage"),
  stageEmployees: () => import("@/pages/StageEmployees"),
  stageDocumentation: () => import("@/pages/StageDocumentation"),
  timelineTemplates: () => import("@/pages/TimelineTemplates"),
  calculator: () => import("@/pages/CalculatorLandingPage"),
  calculatorQuotes: () => import("@/pages/CalculatorQuotesPage"),
  calculatorParameters: () => import("@/pages/CalculatorParametersPage"),
  calculatorCategory: () => import("@/pages/CalculatorCategoryPage"),
  // Employee routes
  employee: () => import("@/pages/Employee"),
  employeeWorkday: () => import("@/pages/EmployeeWorkday"),
  // Installation Manager routes
  installationManager: () => import("@/pages/InstallationManager"),
  constructionSites: () => import("@/pages/ConstructionSites"),
  constructionSiteDetail: () => import("@/pages/ConstructionSiteDetail"),
  assignmentEmployees: () => import("@/pages/AssignmentEmployees"),
  // Accounting routes
  accounting: () => import("@/pages/Accounting"),
  // Shared routes
  settings: () => import("@/pages/Settings"),
};

// Preload routes for OWNER role
export function preloadOwnerRoutes() {
  preloadRoutes.owner();
  preloadRoutes.ownerSiteDetail();
  preloadRoutes.ownerCustomPage();
  preloadRoutes.stageEmployees();
  preloadRoutes.stageDocumentation();
  preloadRoutes.timelineTemplates();
  preloadRoutes.calculator();
  preloadRoutes.calculatorQuotes();
  preloadRoutes.calculatorParameters();
  preloadRoutes.calculatorCategory();
  preloadRoutes.settings();
}

// Preload routes for EMPLOYEE role
export function preloadEmployeeRoutes() {
  preloadRoutes.employee();
  preloadRoutes.employeeWorkday();
  preloadRoutes.settings();
}

// Preload routes for INSTALLATION MANAGER role
export function preloadInstallationManagerRoutes() {
  preloadRoutes.installationManager();
  preloadRoutes.constructionSites();
  preloadRoutes.constructionSiteDetail();
  preloadRoutes.assignmentEmployees();
  preloadRoutes.settings();
}

// Preload routes for ACCOUNTING role
export function preloadAccountingRoutes() {
  preloadRoutes.accounting();
  preloadRoutes.settings();
}
