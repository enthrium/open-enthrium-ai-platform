import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import { EnterpriseConnectorsPanel } from "../../components/ConnectorsPanel";

import connectionTypes from "../../../../server/src/data/connectionTypes.json";
const ALL_TYPES = connectionTypes;
function Spinner() {
  return <div className="w-5 h-5 border-[2.5px] border-indigo border-t-transparent rounded-full animate-spin" />;
}

export default function WorkspaceConnectorsPage() {
  const { slug }  = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const [workspace,   setWorkspace]   = useState(null);
  const [connectors,  setConnectors]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [search,      setSearch]      = useState("");
  const [selectedCat, setSelectedCat] = useState(null);
  const [showPanel,   setShowPanel]   = useState(false);
  const [panelType,   setPanelType]   = useState(null);
  const [panelEditConnector, setPanelEditConnector] = useState(null);
  const [testing,     setTesting]     = useState(null);
  const [testResult,  setTestResult]  = useState({});
  const [confirmDel,  setConfirmDel]  = useState(null);
  const [deleting,    setDeleting]    = useState(null);
  const [runningAgentCount, setRunningAgentCount] = useState(0);
  const [connectorSharingEnabled, setConnectorSharingEnabled] = useState(false);
  const [sharesMap,         setSharesMap]         = useState({});
  const [sharePickerConnId, setSharePickerConnId] = useState(null);
  const [peerWorkspaces,    setPeerWorkspaces]    = useState([]);
  const [sharingTo,         setSharingTo]         = useState(null);
  const [mastersMap,        setMastersMap]        = useState({});
  const [dynForm,           setDynForm]           = useState({ name: "" });
  const [dynSaving,         setDynSaving]         = useState(false);
  const [dynError,          setDynError]          = useState("");

  useEffect(() => {
    if (!slug) return;
    api.get(`/workspaces/${slug}`)
      .then(r => setWorkspace(r.data.workspace))
      .catch(() => setError("Workspace not found"))
      .finally(() => setLoading(false));
    api.get("/admin/connection-masters")
      .then(r => {
        const map = {};
        (r.data.masters || []).forEach(m => { map[m.key] = m; });
        setMastersMap(map);
      })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const check = () => {
      api.get(`/workspaces/${slug}/agent-runs?period=7d`)
        .then(r => setRunningAgentCount((r.data.runs || []).filter(x => x.status === "running").length))
        .catch(() => {});
    };
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, [slug]);

  const loadConnectors = useCallback(() => {
    if (!workspace?.id) return;
    api.get(`/admin/workspaces/${workspace.id}/connectors`)
      .then(r => setConnectors(r.data.connectors || []))
      .catch(() => {});
  }, [workspace?.id]);

  useEffect(() => { loadConnectors(); }, [loadConnectors]);

  function loadShares() {
    api.get(`/workspaces/${slug}/connector-shares`)
      .then(r => {
        const map = {};
        (r.data.shares || []).forEach(s => {
          if (!map[s.connectorId]) map[s.connectorId] = [];
          map[s.connectorId].push(s);
        });
        setSharesMap(map);
      }).catch(() => {});
  }

  useEffect(() => {
    if (!slug) return;
    api.get("/features").then(r => {
      const enabled = r.data.connectorSharing !== false;
      setConnectorSharingEnabled(enabled);
      if (enabled) loadShares();
    }).catch(() => {});
  }, [slug]);

  async function openSharePicker(connId) {
    if (sharePickerConnId === connId) { setSharePickerConnId(null); return; }
    setSharePickerConnId(connId);
    if (!peerWorkspaces.length) {
      api.get("/admin/workspaces")
        .then(r => setPeerWorkspaces((r.data.workspaces || []).filter(w => w.slug !== slug)))
        .catch(() => {});
    }
  }

  async function addConnectorShare(connId, grantedWorkspaceId) {
    setSharingTo(grantedWorkspaceId);
    try {
      await api.post(`/workspaces/${slug}/connector-shares`, { connectorId: connId, grantedWorkspaceId });
      loadShares();
    } catch { } finally { setSharingTo(null); }
  }

  async function removeConnectorShare(shareId) {
    try {
      await api.delete(`/workspaces/${slug}/connector-shares/${shareId}`);
      loadShares();
    } catch { }
  }

  async function handleTest(c) {
    setTesting(c.id);
    setTestResult(r => ({ ...r, [c.id]: null }));
    try {
      const { data } = await api.post(`/admin/workspaces/${workspace.id}/connectors/${c.id}/test`);
      setTestResult(r => ({ ...r, [c.id]: data }));
    } catch {
      setTestResult(r => ({ ...r, [c.id]: { success: false, message: "Test failed" } }));
    } finally { setTesting(null); }
  }

  async function handleDelete(c) {
    setDeleting(c.id);
    try {
      await api.delete(`/admin/workspaces/${workspace.id}/connectors/${c.id}`);
      setConnectors(cs => cs.filter(x => x.id !== c.id));
      setTestResult(r => { const n = { ...r }; delete n[c.id]; return n; });
    } catch { } finally { setDeleting(null); setConfirmDel(null); }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-white">
      <Spinner />
    </div>
  );

  if (error) return (
    <div className="flex h-screen items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-gray-500 mb-4">{error}</p>
        <button onClick={() => navigate("/workspaces")} className="btn-primary px-4 py-2 text-sm">Back to Workspaces</button>
      </div>
    </div>
  );

  const canManage = user?.role === "admin" || user?.role === "manager";
  const activeConnectors = connectors;
  const filtered = ALL_TYPES.filter(t => {
    const matchSearch = !search.trim() || t.label.toLowerCase().includes(search.toLowerCase()) || t.cat.toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCat || t.cat === selectedCat;
    return matchSearch && matchCat;
  });

  const CATEGORIES = [
    { key: "Database",              label: "Databases"              },
    { key: "CRM & Sales",           label: "CRM & Sales"            },
    { key: "Email & Communication", label: "Email & Comms"          },
    { key: "Cloud Storage",         label: "Cloud Storage"          },
    { key: "Developer Tools",       label: "Developer Tools"        },
    { key: "Project Management",    label: "Project Mgmt"           },
    { key: "Marketing",             label: "Marketing"              },
    { key: "HR & Payroll",          label: "HR & Payroll"           },
    { key: "Finance & Accounting",  label: "Finance"                },
    { key: "E-commerce",            label: "E-commerce"             },
    { key: "Analytics",             label: "Analytics"              },
    { key: "Observability",         label: "Observability"          },
    { key: "AI & ML",               label: "AI & ML"                },
    { key: "Security & Identity",   label: "Security"               },
    { key: "Social Media",          label: "Social Media"           },
    { key: "Data Integration",      label: "Data Integration"       },
    { key: "Survey & Feedback",     label: "Survey"                 },
    { key: "E-Signature",           label: "E-Signature"            },
    { key: "Video & Webinar",       label: "Video"                  },
    { key: "Scheduling",            label: "Scheduling"             },
    { key: "Customer Success",      label: "Customer Success"       },
    { key: "CMS",                   label: "CMS"                    },
    { key: "Search",                label: "Search"                 },
    { key: "Messaging",             label: "Messaging"              },
    { key: "Healthcare",            label: "Healthcare"             },
    { key: "ERP",                   label: "ERP"                    },
    { key: "IoT",                   label: "IoT"                    },
    { key: "Blockchain",            label: "Blockchain"             },
    { key: "Media & DAM",           label: "Media & DAM"            },
    { key: "Low Code",              label: "Low Code"               },
    { key: "Cloud Services",        label: "Cloud Services"         },
    { key: "Collaboration",         label: "Collaboration"          },
    { key: "DevOps",               label: "DevOps"                  },
    { key: "Automation",           label: "Automation"              },
    { key: "BI",                   label: "BI"                      },
    { key: "Education",            label: "Education"               },
    { key: "Legal",                label: "Legal"                   },
    { key: "Real Estate",          label: "Real Estate"             },
    { key: "Operations",           label: "Operations"              },
    { key: "MCP",                  label: "MCP Servers"             },
  ];

  return (
    <div className="flex h-screen bg-white overflow-hidden">

      {/* ── Left sidebar ── */}
      <div className="w-64 bg-[#f9f9f9] border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="px-3 py-3 border-b border-gray-200">
          <button onClick={() => navigate("/workspaces")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors w-full px-2 py-1.5 rounded-lg hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Workspaces</span>
          </button>
        </div>
        <div className="px-3 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 px-2">
            <div className="w-6 h-6 bg-gray-900 rounded-md flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <p className="flex-1 text-sm font-semibold text-gray-900 truncate min-w-0">{workspace?.name || "…"}</p>
          </div>
        </div>
        <div className="flex-1" />
        <div className="shrink-0 border-t border-gray-200 px-3 py-3 space-y-0.5">
          <button onClick={() => navigate(`/workspace/${slug}`)} className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </button>
          <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm bg-indigo/10 text-indigo font-semibold">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Connectors
          </button>
          <button onClick={() => navigate(`/workspace/${slug}/agents`)} className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="flex-1 text-left">Agents</span>
            {runningAgentCount > 0 && (
              <span className="relative flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Row 1: Header */}
        <div className="px-8 py-5 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Connectors <span className="ml-2 text-xs font-semibold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full align-middle">{ALL_TYPES.length}</span></h1>
              <p className="text-sm text-gray-400 mt-0.5">Databases and integrations connected to this workspace</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

          {/* Row 2: Active Connections */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Active Connections</span>
              <span className="text-xs bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">{activeConnectors.length}</span>
            </div>
            {activeConnectors.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-xl py-8 text-center">
                <p className="text-sm text-gray-400">No connectors yet — click <strong>Add Connector</strong> to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {activeConnectors.map(c => {
                  const meta = ALL_TYPES.find(t => t.id === c.type);
                  const tr   = testResult[c.id];
                  return (
                    <div key={c.id} className="border border-green-200 rounded-xl bg-white overflow-hidden flex flex-col">
                      {/* Body */}
                      <div className="px-3 pt-3 pb-2 flex items-start gap-2.5 flex-1">
                        <div className={`w-7 h-7 rounded-lg ${meta?.color || "bg-gray-500"} flex items-center justify-center shrink-0`}>
                          <span className="text-white text-[9px] font-bold">{meta?.initial || c.type.slice(0,2).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 mt-1" />
                      </div>

                      {/* Test result */}
                      {tr && (
                        <div className={`mx-3 mb-1 px-2 py-1 rounded-lg text-[10px] font-medium ${tr.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                          {tr.success ? "✓" : "✗"} {tr.message || (tr.success ? "Connected" : "Failed")}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="px-3 pb-2.5 pt-1 border-t border-gray-100 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {/* Test */}
                        <button onClick={() => handleTest(c)} disabled={testing === c.id} title="Test connection"
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-medium text-gray-500 hover:text-indigo hover:bg-indigo/5 transition-colors disabled:opacity-40">
                          {testing === c.id
                            ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                            : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
                          Test
                        </button>
                        {/* Edit */}
                        <button onClick={() => { setPanelType(null); setPanelEditConnector(c); setShowPanel(true); }} title="Edit connection"
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-medium text-gray-500 hover:text-indigo hover:bg-indigo/5 transition-colors">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          Edit
                        </button>
                        {/* Share */}
                        {connectorSharingEnabled && (
                          <button onClick={() => openSharePicker(c.id)} title="Share with workspace"
                            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-medium transition-colors ${sharePickerConnId === c.id ? "text-indigo bg-indigo/10" : "text-gray-500 hover:text-indigo hover:bg-indigo/5"}`}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                            Share
                          </button>
                        )}
                        {/* Delete */}
                        <button onClick={() => setConfirmDel(c)} title="Delete connection"
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          Delete
                        </button>
                      </div>
                      {/* Share picker */}
                      {connectorSharingEnabled && sharePickerConnId === c.id && (
                        <div className="border-t border-gray-100 px-3 py-3 bg-gray-50 space-y-2">
                          <p className="text-xs font-semibold text-gray-700">Share with workspace</p>
                          {(sharesMap[c.id] || []).length > 0 && (
                            <div className="space-y-1">
                              {(sharesMap[c.id] || []).map(s => (
                                <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 bg-indigo/5 rounded-lg">
                                  <span className="text-xs font-medium text-gray-700 flex-1">{s.grantedWorkspace.name}</span>
                                  <span className="text-[10px] text-green-600 font-semibold">Shared</span>
                                  <button onClick={() => removeConnectorShare(s.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {peerWorkspaces.filter(w => !(sharesMap[c.id] || []).some(s => s.grantedWorkspace.id === w.id)).length === 0
                              ? <p className="text-xs text-gray-400">All workspaces already added.</p>
                              : peerWorkspaces.filter(w => !(sharesMap[c.id] || []).some(s => s.grantedWorkspace.id === w.id)).map(w => (
                                <button key={w.id} onClick={() => addConnectorShare(c.id, w.id)} disabled={sharingTo === w.id}
                                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg border border-gray-200 hover:border-indigo hover:bg-indigo/5 transition-colors text-left disabled:opacity-50 text-xs">
                                  <span className="font-medium text-gray-700">{w.name}</span>
                                  <span className="text-gray-400">{sharingTo === w.id ? "Sharing…" : "Share →"}</span>
                                </button>
                              ))
                            }
                          </div>
                          <button onClick={() => setSharePickerConnId(null)} className="text-[10px] text-gray-400 hover:text-gray-600">✕ Close</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Row 3: Search */}
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search connectors…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo transition-colors"
            />
          </div>

          {/* Row 4: Category filter pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCat(null)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
                !selectedCat ? "bg-indigo text-white border-indigo" : "bg-white text-gray-500 border-gray-200 hover:border-indigo hover:text-indigo"
              }`}>
              All
            </button>
            {CATEGORIES.map(cat => (
              <button key={cat.key}
                onClick={() => setSelectedCat(selectedCat === cat.key ? null : cat.key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
                  selectedCat === cat.key ? "bg-indigo text-white border-indigo" : "bg-white text-gray-500 border-gray-200 hover:border-indigo hover:text-indigo"
                }`}>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Row 5: All Connector Types — grouped by category */}
          {CATEGORIES.map(cat => {
            const items = filtered.filter(t => t.cat === cat.key);
            if (!items.length) return null;
            return (
              <div key={cat.key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{cat.label}</span>
                  <span className="text-xs bg-red-500 text-white font-semibold px-1.5 py-0.5 rounded-full">{items.length}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {items.map(t => {
                    const isConnected = connectors.some(c => c.type === t.id);
                    const isLive = !!mastersMap[t.id];
                    return (
                      <div key={t.id}
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                          isConnected
                            ? "border-green-200 bg-green-50/50"
                            : isLive
                              ? "border-gray-100 bg-gray-50/50 hover:border-indigo/25 hover:bg-white hover:shadow-sm"
                              : "border-gray-100 bg-gray-50/30 opacity-60"
                        }`}>
                        <div className={`w-7 h-7 rounded-lg ${t.color} flex items-center justify-center shrink-0`}>
                          <span className="text-white text-[9px] font-bold leading-none">{t.initial}</span>
                        </div>
                        <span className="flex-1 text-sm font-medium text-gray-700 truncate min-w-0">{t.label}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isConnected && <span className="w-2 h-2 rounded-full bg-green-400" />}
                          {!isLive && (
                            <span className="text-[10px] font-semibold text-gray-300">Soon</span>
                          )}
                          {isLive && canManage && (
                            <button
                              onClick={() => { setDynError(""); const defaults = { name: t.id }; (JSON.parse(mastersMap[t.id]?.fields || "[]")).forEach(f => { defaults[f.key] = ""; }); setDynForm(defaults); setPanelEditConnector(null); setPanelType(t.id); setShowPanel(true); }}
                              className="text-[11px] font-semibold text-indigo opacity-0 group-hover:opacity-100 hover:text-indigo/70 whitespace-nowrap transition-all">
                              Connect →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        </div>
      </div>

      {/* ── Delete confirm ── */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Delete Connector</h3>
            <p className="text-xs text-gray-500 mb-4">Remove <strong>{confirmDel.name}</strong> from this workspace?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(confirmDel)} disabled={deleting === confirmDel.id}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting === confirmDel.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Connector Panel ── */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => { setShowPanel(false); setPanelType(null); setPanelEditConnector(null); loadConnectors(); }} />
          <div className="w-[520px] bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div>
                {panelEditConnector ? (
                  <>
                    <h2 className="text-sm font-bold text-gray-900">Edit — {panelEditConnector.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Update connection details</p>
                  </>
                ) : panelType ? (
                  <>
                    <h2 className="text-sm font-bold text-gray-900">Connect {ALL_TYPES.find(t => t.id === panelType)?.label || panelType}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Enter your connection details below</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-sm font-bold text-gray-900">Add Connector</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Connect a database or integration</p>
                  </>
                )}
              </div>
              <button onClick={() => { setShowPanel(false); setPanelType(null); setPanelEditConnector(null); loadConnectors(); }} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const ENTERPRISE_TYPES = new Set(["mongodb","redis","elasticsearch","ssh","gmail","gdrive","github","slack","zoho-mail","jira","confluence","notion","hubspot","freshdesk","zendesk","onedrive","dropbox","box","postgresql","mysql","mssql","oracle"]);
                const useDynForm = panelType && !panelEditConnector && mastersMap[panelType]?.fields && !ENTERPRISE_TYPES.has(panelType);

                if (useDynForm) {
                  const fields = JSON.parse(mastersMap[panelType].fields);
                  const firstRequired = fields.find(f => f.required)?.key;
                  return (
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Connection Name</label>
                        <input value={dynForm.name || ""}
                          onChange={e => setDynForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-") }))}
                          className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo" />
                      </div>
                      {fields.map(f => (
                        <div key={f.key}>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">
                            {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                          </label>
                          {f.type === "textarea" || f.type === "json" ? (
                            <textarea rows={4} value={dynForm[f.key] || ""} placeholder={f.placeholder || ""}
                              onChange={e => setDynForm(v => ({ ...v, [f.key]: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo font-mono resize-none" />
                          ) : f.type === "boolean" ? (
                            <select value={dynForm[f.key] || "false"}
                              onChange={e => setDynForm(v => ({ ...v, [f.key]: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo">
                              <option value="false">No</option>
                              <option value="true">Yes</option>
                            </select>
                          ) : (
                            <input
                              type={f.type === "password" ? "password" : f.type === "number" ? "number" : "text"}
                              value={dynForm[f.key] || ""} placeholder={f.placeholder || ""}
                              onChange={e => setDynForm(v => ({ ...v, [f.key]: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo" />
                          )}
                        </div>
                      ))}
                      {dynError && <p className="text-xs text-red-500">{dynError}</p>}
                      <button
                        disabled={dynSaving || !!(firstRequired && !dynForm[firstRequired]?.trim())}
                        onClick={async () => {
                          setDynSaving(true); setDynError("");
                          try {
                            const { name, ...rest } = dynForm;
                            const authConfig = {};
                            fields.forEach(f => { if (dynForm[f.key] !== undefined && dynForm[f.key] !== "") authConfig[f.key] = dynForm[f.key]; });
                            await api.post(`/admin/workspaces/${workspace.id}/connectors`, {
                              name: name || ALL_TYPES.find(t => t.id === panelType)?.label || panelType,
                              type: panelType,
                              config: {},
                              authConfig,
                            });
                            setShowPanel(false); setPanelType(null); loadConnectors();
                          } catch (err) {
                            setDynError(err?.response?.data?.error || err.message || "Failed to save");
                          } finally { setDynSaving(false); }
                        }}
                        className="w-full py-2.5 text-sm font-semibold text-white bg-indigo rounded-lg hover:bg-indigo/90 disabled:opacity-50 transition-colors">
                        {dynSaving ? "Connecting…" : "Connect"}
                      </button>
                    </div>
                  );
                }

                return (
                  <EnterpriseConnectorsPanel
                    workspaceId={workspace?.id}
                    workspaceSlug={slug}
                    onIngestionStarted={() => {}}
                    section="both"
                    focusType={panelType}
                    focusEditConnector={panelEditConnector}
                    onConnected={() => { setShowPanel(false); setPanelType(null); setPanelEditConnector(null); loadConnectors(); }}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
