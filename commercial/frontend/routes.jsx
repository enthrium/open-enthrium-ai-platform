import React from "react";
import SSOPage            from "./pages/Settings/SSOPage";
import CompliancePage     from "./pages/Settings/CompliancePage";
import ViolationsPage     from "./pages/Settings/ViolationsPage";
import ActivityLogPage    from "./pages/Settings/ActivityLogPage";
import TierLimitsPage     from "./pages/Settings/TierLimitsPage";
import TokenUsagePage     from "./pages/Settings/TokenUsagePage";
import AgentBuilderPage   from "./pages/AgentBuilder/AgentBuilderPage";
import UsersPage          from "./pages/Users/UsersPage";
import ApiKeysPage        from "./pages/Developer/ApiKeysPage";
import EmbedPage          from "./pages/Developer/EmbedPage";
import VectorsPage        from "./pages/Settings/VectorsPage";

export default [
  { path: "/settings/sso",         element: <SSOPage /> },
  { path: "/settings/compliance",  element: <CompliancePage /> },
  { path: "/settings/violations",  element: <ViolationsPage /> },
  { path: "/settings/activity",    element: <ActivityLogPage /> },
  { path: "/settings/tier-limits", element: <TierLimitsPage /> },
  { path: "/settings/token-usage", element: <TokenUsagePage /> },
  { path: "/agent-builder",        element: <AgentBuilderPage /> },
  { path: "/users",                element: <UsersPage /> },
  { path: "/developer",            element: <ApiKeysPage /> },
  { path: "/developer/embed",      element: <EmbedPage /> },
  { path: "/settings/vectors",     element: <VectorsPage /> },
];
