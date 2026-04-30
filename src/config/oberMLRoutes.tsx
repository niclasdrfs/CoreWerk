import { lazy } from "react";

const OberMontageleiter = lazy(() => import("@/pages/OberMontageleiter"));
const ConstructionSites = lazy(() => import("@/pages/ConstructionSites"));
const ConstructionSiteDetail = lazy(() => import("@/pages/ConstructionSiteDetail"));
const AssignmentEmployees = lazy(() => import("@/pages/AssignmentEmployees"));
const SiteCustomerInfo = lazy(() => import("@/pages/SiteCustomerInfo"));
const SitePlansImages = lazy(() => import("@/pages/SitePlansImages"));
const SiteCorrespondence = lazy(() => import("@/pages/SiteCorrespondence"));
const SiteContact = lazy(() => import("@/pages/SiteContact"));
const StageEmployees = lazy(() => import("@/pages/StageEmployees"));
const StageDocumentation = lazy(() => import("@/pages/StageDocumentation"));
const MyTimeEntries = lazy(() => import("@/pages/MyTimeEntries"));

import type { RouteConfig } from "./ownerRoutes";

export const oberMLRoutes: RouteConfig[] = [
  { path: "", element: <OberMontageleiter />, index: true },
  { path: "baustellen", element: <ConstructionSites /> },
  { path: "baustellen/:siteId", element: <ConstructionSiteDetail /> },
  { path: "einsatz/:assignmentId", element: <AssignmentEmployees /> },
  { path: "site/:siteId/kundeninfo", element: <SiteCustomerInfo /> },
  { path: "site/:siteId/plaene", element: <SitePlansImages /> },
  { path: "site/:siteId/schriftverkehr", element: <SiteCorrespondence /> },
  { path: "site/:siteId/kontakt", element: <SiteContact /> },
  { path: "site/:siteId/stage/:stageId/employees", element: <StageEmployees /> },
  { path: "site/:siteId/stage/:stageId/documentation", element: <StageDocumentation /> },
  { path: "meine-buchungen", element: <MyTimeEntries /> },
];
