import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

function useServerReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      while (!cancelled) {
        try {
          const res = await fetch("/api/health");
          if (res.ok) { setReady(true); return; }
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    poll();
    return () => { cancelled = true; };
  }, []);
  return ready;
}

function ServerGate({ children }) {
  const ready = useServerReady();
  if (!ready) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white dark:bg-[#111]">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Starting server…</p>
    </div>
  );
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  const dest = (user?.role === "admin" || user?.role === "manager") ? "/dashboard" : "/workspaces";
  return <Navigate to={dest} replace />;
}

function AuthRequired({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

import AppLayout            from "./components/layout/AppLayout";
import Login                from "./pages/Auth/Login";
import EmbedChat            from "./pages/Embed/EmbedChat";
import WorkspaceChat        from "./pages/Workspace/WorkspaceChat";
import WorkspaceSettingsPage  from "./pages/Workspace/WorkspaceSettingsPage";
import WorkspaceProjectsPage  from "./pages/Workspace/WorkspaceProjectsPage";
import ProjectDetailPage      from "./pages/Workspace/ProjectDetailPage";
import WorkspaceEmbedPage     from "./pages/Workspace/WorkspaceEmbedPage";
import WorkspaceRunLogsPage   from "./pages/Workspace/WorkspaceRunLogsPage";

import DashboardPage  from "./pages/Dashboard/DashboardPage";
import WorkspacesPage from "./pages/Workspaces/WorkspacesPage";
import SettingsPage   from "./pages/Settings/SettingsPage";
import MaintenancePage from "./pages/Settings/MaintenancePage";
import UsersPage       from "./pages/Settings/UsersPage";
import McpServersPage  from "./pages/Settings/McpServersPage";
import commercialRoutes from "@commercial/routes";

// Fetch licenseType from the server once; returns null while loading
function useIsEnterprise() {
  const [isEnterprise, setIsEnterprise] = useState(null);
  useEffect(() => {
    fetch("/api/instance")
      .then(r => r.json())
      .then(d => setIsEnterprise(d.licenseType === "enterprise"))
      .catch(() => setIsEnterprise(false));
  }, []);
  return isEnterprise;
}

function AppRoutes() {
  const isEnterprise = useIsEnterprise();

  // Hold rendering until we know the license type (avoids flash of enterprise routes)
  if (isEnterprise === null) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"        element={<Login />} />
      <Route path="/embed/:slug"  element={<EmbedChat />} />

      {/* Full-screen routes — auth required, no sidebar shell */}
      <Route path="/workspace/:slug"                               element={<AuthRequired><WorkspaceChat /></AuthRequired>} />
      <Route path="/workspace/:slug/projects"                      element={<AuthRequired><WorkspaceProjectsPage /></AuthRequired>} />
      <Route path="/workspace/:slug/projects/:projectId"           element={<AuthRequired><ProjectDetailPage /></AuthRequired>} />
      <Route path="/workspace/:slug/settings"                      element={<AuthRequired><WorkspaceSettingsPage /></AuthRequired>} />
      <Route path="/workspace/:slug/embed"                          element={<AuthRequired><WorkspaceEmbedPage /></AuthRequired>} />
      <Route path="/workspace/:slug/run-logs"                       element={<AuthRequired><WorkspaceRunLogsPage /></AuthRequired>} />

      {/* Authenticated shell — AppLayout handles auth guard + sidebar */}
      <Route element={<AppLayout />}>
        <Route path="/"                    element={<HomeRedirect />} />
        <Route path="/admin"               element={<HomeRedirect />} />
        <Route path="/dashboard"           element={<DashboardPage />} />
        <Route path="/workspaces"          element={<WorkspacesPage />} />
        <Route path="/settings"            element={<SettingsPage />} />
        <Route path="/settings/maintenance" element={<MaintenancePage />} />
        <Route path="/users"               element={<UsersPage />} />
        <Route path="/settings/mcp-servers" element={<McpServersPage />} />
        {/* Commercial routes: only registered when server confirms enterprise license */}
        {isEnterprise && commercialRoutes.map(r => <Route key={r.path} path={r.path} element={r.element} />)}
        <Route path="*"                    element={<HomeRedirect />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <ServerGate><AuthProvider><AppRoutes /></AuthProvider></ServerGate>;
}
