import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { load as yamlLoad } from "js-yaml";

// ─── Icons ────────────────────────────────────────────────────────────────────
function Icon({ d, size = 4, className = "" }) {
  return (
    <svg className={`w-${size} h-${size} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  );
}
const ICONS = {
  back:   "M10 19l-7-7m0 0l7-7m-7 7h18",
  plus:   "M12 4v16m8-8H4",
  trash:  "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  save:   "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4",
  upload: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
};

// ─── Sensitive key/value masking ─────────────────────────────────────────────
const SENSITIVE_KEY_RE = /key|password|secret|token|auth|pass|credential|connection_string|apikey|private/i;
// Mask URLs that have an embedded API token (e.g. Telegram: /bot{id}:{hash}, Slack webhooks, etc.)
const EMBEDDED_TOKEN_RE = /https?:\/\/\S*[:/][A-Za-z0-9_\-]{20,}/;

function isSensitive(key, val) {
  if (typeof val !== "string" || val.length === 0) return false;
  if (SENSITIVE_KEY_RE.test(key)) return true;
  if (EMBEDDED_TOKEN_RE.test(val)) return true;
  return false;
}

function maskObj(val) {
  if (Array.isArray(val)) return val.map(maskObj);
  if (val && typeof val === "object") {
    return Object.fromEntries(
      Object.entries(val).map(([k, v]) =>
        [k, isSensitive(k, v) ? "••••••••" : maskObj(v)]
      )
    );
  }
  return val;
}

function maskedJson(raw) {
  try { return JSON.stringify(maskObj(JSON.parse(raw)), null, 2); } catch { return raw; }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { slug, projectId } = useParams();
  const navigate = useNavigate();

  const [project,       setProject]       = useState(null);
  const [agents,        setAgents]        = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [yamlContent,   setYamlContent]   = useState("");
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [saving,        setSaving]        = useState(false);
  const [saveMsg,       setSaveMsg]       = useState("");
  const [isNew,         setIsNew]         = useState(false);

  // oe-config.json right panel
  const [oeRaw,         setOeRaw]         = useState("");
  const [oeSaving,      setOeSaving]      = useState(false);
  const [oeSaved,       setOeSaved]       = useState(false);
  const [oeError,       setOeError]       = useState("");
  const [hideKeys,      setHideKeys]      = useState(true);

  const yamlInputRef = useRef();

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const wsRes = await api.get(`/workspaces/${slug}`);
        const ws    = wsRes.data.workspace;
        const prRes = await api.get(`/admin/workspaces/${ws.id}/projects/${projectId}`);
        const proj  = prRes.data.project;
        setProject({ ...proj, workspaceId: ws.id });
        // Initialise oe-config panel
        try {
          const cfg = JSON.parse(proj.oeConfig || "{}");
          setOeRaw(JSON.stringify(cfg, null, 2));
        } catch { setOeRaw("{}"); }
        const ags = proj.agents || [];
        setAgents(ags);
        const def = ags.find(a => a.isDefault) || ags[0];
        if (def) selectAgent(def);
      } catch { setError("Failed to load project"); }
      finally  { setLoading(false); }
    })();
  }, [slug, projectId]);

  function selectAgent(agent) {
    setSelectedAgent(agent);
    setYamlContent(agent.yamlContent || "");
    setIsNew(false);
    setSaveMsg("");
  }

  function newAgent() {
    const blank = {
      id: null, name: "new-agent", description: "", fileName: "agent.yaml",
      yamlContent: "name: New Agent\ndescription: \ninstructions: You are a helpful assistant.\nsteps:\n  - name: Main\n    content: |\n      Answer the user's question.\n",
      isDefault: false,
    };
    setSelectedAgent(blank);
    setYamlContent(blank.yamlContent);
    setIsNew(true);
    setSaveMsg("");
  }

  // ── Import single YAML ───────────────────────────────────────────────────────
  function importYaml(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const content = ev.target.result;
        const doc     = yamlLoad(content) || {};
        setSelectedAgent({
          id: null,
          name: doc.name || file.name.replace(/\.ya?ml$/, ""),
          description: doc.description || "",
          fileName: file.name,
          yamlContent: content,
          isDefault: false,
        });
        setYamlContent(content);
        setIsNew(true);
        setSaveMsg("");
      } catch { setSaveMsg("Invalid YAML"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Save agent ───────────────────────────────────────────────────────────────
  async function saveAgent() {
    setSaving(true); setSaveMsg("");
    try {
      let agentName = selectedAgent.name;
      try { const d = yamlLoad(yamlContent); if (d?.name) agentName = d.name; } catch {}
      const payload = {
        name:        agentName,
        description: selectedAgent.description || null,
        fileName:    selectedAgent.fileName || "agent.yaml",
        yamlContent,
        isDefault:   selectedAgent.isDefault || false,
      };
      if (isNew) {
        const { data } = await api.post(`/admin/workspaces/${project.workspaceId}/projects/${projectId}/agents`, payload);
        setAgents(a => [...a, data.agent]);
        setSelectedAgent(data.agent);
        setIsNew(false);
        setSaveMsg("Created ✓");
      } else {
        const { data } = await api.put(`/admin/workspaces/${project.workspaceId}/projects/${projectId}/agents/${selectedAgent.id}`, payload);
        setAgents(a => a.map(ag => ag.id === data.agent.id ? data.agent : ag));
        setSelectedAgent(data.agent);
        setSaveMsg("Saved ✓");
      }
    } catch (e) {
      setSaveMsg(e.response?.data?.error || "Save failed");
    } finally { setSaving(false); }
  }

  // ── Delete agent ─────────────────────────────────────────────────────────────
  async function deleteAgent(agent) {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    try {
      await api.delete(`/admin/workspaces/${project.workspaceId}/projects/${projectId}/agents/${agent.id}`);
      setAgents(a => a.filter(ag => ag.id !== agent.id));
      if (selectedAgent?.id === agent.id) { setSelectedAgent(null); setIsNew(false); }
    } catch { alert("Delete failed"); }
  }

  // ── Save oe-config.json ──────────────────────────────────────────────────────
  async function saveOeConfig() {
    setOeError(""); setOeSaving(true);
    try {
      const parsed = JSON.parse(oeRaw);
      const { data } = await api.put(`/admin/workspaces/${project.workspaceId}/projects/${projectId}`, { oeConfig: parsed });
      setProject(p => ({ ...p, oeConfig: data.project.oeConfig }));
      setHideKeys(true);
      setOeSaved(true);
      setTimeout(() => setOeSaved(false), 2000);
    } catch (e) {
      setOeError(e instanceof SyntaxError ? "Invalid JSON" : (e.response?.data?.error || "Save failed"));
    } finally { setOeSaving(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-indigo border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
      <p className="text-red-500">{error}</p>
      <button onClick={() => navigate(`/workspace/${slug}/projects`)} className="btn-secondary px-4 py-2 text-sm">Back</button>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: "linear-gradient(145deg,#13103a 0%,#1e1b4b 40%,#2e2a80 80%,#4f46e5 100%)", borderBottom: "1px solid rgba(99,102,241,.25)" }}>
        <button onClick={() => navigate(`/workspace/${slug}/projects`)}
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <Icon d={ICONS.back} size="4" />
        </button>
        <div>
          <h1 className="text-white font-semibold text-sm">{project?.name}</h1>
          <p className="text-white/50 text-[10px]">Agents</p>
        </div>
      </header>

      {/* 3-panel body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — agent list */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Agents</span>
            <button onClick={newAgent} className="p-1 rounded-lg text-indigo hover:bg-indigo/10 transition-colors" title="New agent">
              <Icon d={ICONS.plus} size="4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1.5">
            {agents.length === 0 && !isNew && (
              <p className="text-xs text-gray-400 text-center py-6 px-3">No agents yet.<br />Import a YAML or click +.</p>
            )}
            {isNew && (
              <div className="mx-2 my-1 px-3 py-2.5 rounded-lg bg-indigo/10 border border-indigo/20">
                <p className="text-sm font-semibold text-indigo">New Agent</p>
                <p className="text-[10px] text-indigo/60">Unsaved</p>
              </div>
            )}
            {agents.map(agent => (
              <div key={agent.id} onClick={() => selectAgent(agent)}
                className={`group mx-2 my-0.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${selectedAgent?.id === agent.id && !isNew ? "bg-indigo/10 border border-indigo/20" : "hover:bg-gray-50"}`}>
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${selectedAgent?.id === agent.id && !isNew ? "text-indigo" : "text-gray-800"}`}>
                      {agent.name}
                      {agent.isDefault && <span className="ml-1 text-[9px] font-bold text-gray-400 uppercase">default</span>}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{agent.fileName}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteAgent(agent); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 transition-all shrink-0 mt-0.5">
                    <Icon d={ICONS.trash} size="3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center — YAML editor */}
        <main className="flex-1 flex flex-col overflow-hidden border-r border-gray-200 min-w-0">
          {!selectedAgent ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
              <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">Select an agent or import a YAML</p>
            </div>
          ) : (
            <>
              <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">{selectedAgent.name || "New Agent"}</span>
                  <span className="text-xs text-gray-400 font-mono">{selectedAgent.fileName}</span>
                  {saveMsg && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${saveMsg.includes("✓") ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                      {saveMsg}
                    </span>
                  )}
                </div>
                <button onClick={saveAgent} disabled={saving}
                  className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
                  <Icon d={ICONS.save} size="3.5" />
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
              <div className="flex-1 overflow-hidden p-3 flex flex-col">
                <textarea
                  value={yamlContent}
                  onChange={e => setYamlContent(e.target.value)}
                  spellCheck={false}
                  className="flex-1 w-full font-mono text-xs text-gray-200 bg-gray-950 rounded-lg p-4 outline-none resize-none leading-relaxed focus:ring-1 focus:ring-indigo/50"
                  placeholder={"name: My Agent\ndescription: \ninstructions: You are a helpful assistant.\nsteps:\n  - name: Main\n    content: |\n      Answer the user's question.\n"}
                />
              </div>
            </>
          )}
        </main>

        {/* Right — oe-config.json */}
        <aside className="w-[380px] shrink-0 bg-gray-50 flex flex-col overflow-hidden border-l border-gray-200">
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">oe-config.json</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">LLM · connectors · server</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Hide / Show keys toggle */}
              <button
                onClick={() => setHideKeys(v => !v)}
                title={hideKeys ? "Show sensitive values" : "Hide sensitive values"}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {hideKeys ? (
                  /* eye-off */
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  /* eye */
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
              <button onClick={saveOeConfig} disabled={oeSaving || hideKeys}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${oeSaved ? "bg-emerald-500 text-white" : "btn-primary"} disabled:opacity-50`}>
                {oeSaving ? "Saving…" : oeSaved ? "Saved ✓" : "Save"}
              </button>
            </div>
          </div>
          {hideKeys && (
            <div className="mx-3 mt-2 shrink-0 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sensitive values are masked. Click the eye icon to reveal and edit.
            </div>
          )}
          {oeError && (
            <div className="mx-3 mt-2 shrink-0 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{oeError}</div>
          )}
          <div className="flex-1 p-3 overflow-hidden flex flex-col">
            <textarea
              value={hideKeys ? maskedJson(oeRaw) : oeRaw}
              onChange={e => { if (!hideKeys) { setOeRaw(e.target.value); setOeError(""); } }}
              readOnly={hideKeys}
              spellCheck={false}
              className={`flex-1 w-full font-mono text-xs text-gray-200 bg-gray-950 rounded-lg p-4 outline-none resize-none leading-relaxed focus:ring-1 focus:ring-indigo/50 ${hideKeys ? "cursor-default select-none" : ""}`}
              placeholder="{}"
            />
          </div>
        </aside>

      </div>
    </div>
  );
}
