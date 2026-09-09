import React, { useState, useEffect } from "react";
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
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  save: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4",
};

// ─── File-type icon (emoji-based, fast) ──────────────────────────────────────
const FILE_EMOJI = { md:"📝", yaml:"📋", yml:"📋", json:"🔧", py:"🐍", js:"📜", ts:"📜", jsx:"📜", tsx:"📜", sh:"⚙️", html:"🌐", css:"🎨", txt:"📄", csv:"📊", sql:"🗄️", go:"🐹", rs:"🦀", rb:"💎", java:"☕" };
function fileEmoji(name) { const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase(); return FILE_EMOJI[ext] || "📄"; }

// ─── Recursive file-tree renderer ────────────────────────────────────────────
const TREE_HIDDEN = new Set(["agent.yaml", "agent.yml", "oe-config.json"]);

function FileTree({ nodes, depth, openDirs, onToggle, selectedFile, onSelectFile }) {
  const filtered = depth === 0 ? nodes.filter(n => !TREE_HIDDEN.has(n.name)) : nodes;
  return filtered.map(node => {
    if (node.type === "dir") {
      const isOpen = openDirs.has(node.path);
      return (
        <React.Fragment key={node.path}>
          <div
            onClick={() => onToggle(node.path)}
            style={{ paddingLeft: `${8 + depth * 12}px` }}
            className="flex items-center gap-1.5 py-[3px] cursor-pointer hover:bg-gray-100 select-none"
          >
            <span className="text-[8px] text-gray-400 w-2 shrink-0">{isOpen ? "▼" : "▶"}</span>
            <span className="shrink-0">{isOpen ? "📂" : "📁"}</span>
            <span className="text-xs text-gray-600 font-medium truncate">{node.name}</span>
          </div>
          {isOpen && node.children?.length > 0 && (
            <FileTree nodes={node.children} depth={depth + 1} openDirs={openDirs} onToggle={onToggle} selectedFile={selectedFile} onSelectFile={onSelectFile} />
          )}
        </React.Fragment>
      );
    }
    const sel = selectedFile === node.path;
    return (
      <div
        key={node.path}
        onClick={() => onSelectFile(node.path)}
        style={{ paddingLeft: `${18 + depth * 12}px` }}
        className={`flex items-center gap-1.5 py-[3px] cursor-pointer text-xs truncate rounded-sm mx-1 ${sel ? "bg-indigo/10 text-indigo font-semibold" : "text-gray-500 hover:bg-gray-100"}`}
      >
        <span className="shrink-0">{fileEmoji(node.name)}</span>
        <span className="truncate">{node.name}</span>
      </div>
    );
  });
}

// ─── Sensitive key/value masking ─────────────────────────────────────────────
const SENSITIVE_KEY_RE = /key|password|secret|token|auth|pass|credential|connection_string|apikey|private/i;
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

  // oe-config.json right panel
  const [oeRaw,         setOeRaw]         = useState("");
  const [oeSaving,      setOeSaving]      = useState(false);
  const [oeSaved,       setOeSaved]       = useState(false);
  const [oeError,       setOeError]       = useState("");
  const [hideKeys,      setHideKeys]      = useState(true);

  const [savingAll,     setSavingAll]     = useState(false);
  const [saveAllMsg,    setSaveAllMsg]    = useState("");

  // ── File explorer ─────────────────────────────────────────────────────────────
  const [tree,             setTree]            = useState([]);
  const [rootName,         setRootName]        = useState("");
  const [openDirs,         setOpenDirs]        = useState(new Set());
  const [selectedTreeFile, setSelectedTreeFile] = useState(null); // null = show 2-panel
  const [fileContent,      setFileContent]     = useState(null);
  const [fileEditContent,  setFileEditContent] = useState(null); // editable copy
  const [fileLoading,      setFileLoading]     = useState(false);
  const [fileSaving,       setFileSaving]      = useState(false);
  const [fileSaveMsg,      setFileSaveMsg]     = useState("");


  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const wsRes = await api.get(`/workspaces/${slug}`);
        const ws    = wsRes.data.workspace;
        const prRes = await api.get(`/admin/workspaces/${ws.id}/projects/${projectId}`);
        const proj  = prRes.data.project;
        setProject({ ...proj, workspaceId: ws.id });
        try {
          const raw = proj.oeConfig || "{}";
          const cfg = JSON.parse(raw);
          const isEmpty = Object.keys(cfg).length === 0;
          if (isEmpty) {
            // Auto-copy real LLM key from dedicated export endpoint
            let llmCfg = { provider: "openai", model: "gpt-4o", apiKey: "" };
            try {
              const { data: sd } = await api.get("/settings/oe-config");
              if (sd.llm) llmCfg = sd.llm;
            } catch {}
            setOeRaw(JSON.stringify({ llm: llmCfg, connectors: [] }, null, 2));
          } else {
            setOeRaw(JSON.stringify(cfg, null, 2));
          }
        } catch { setOeRaw(JSON.stringify({ llm: { provider: "openai", model: "gpt-4o", apiKey: "" }, connectors: [] }, null, 2)); }
        const ags = proj.agents || [];
        setAgents(ags);
        const def = ags.find(a => a.isDefault) || ags[0];
        if (def) selectAgent(def);
        // Load file tree (fire-and-forget, non-blocking)
        try {
          const { data: td } = await api.get(`/admin/workspaces/${ws.id}/projects/${projectId}/tree`);
          setTree(td.tree || []);
          setRootName(td.rootName || "");
        } catch {}
      } catch { setError("Failed to load project"); }
      finally  { setLoading(false); }
    })();
  }, [slug, projectId]);

  function selectAgent(agent) {
    setSelectedAgent(agent);
    setYamlContent(agent.yamlContent || "");
    setSaveMsg("");
  }

  async function loadFile(filePath) {
    setSelectedTreeFile(filePath);
    setFileContent(null);
    setFileEditContent(null);
    setFileSaveMsg("");
    setFileLoading(true);
    try {
      const { data } = await api.get(`/admin/workspaces/${project.workspaceId}/projects/${projectId}/file`, { params: { path: filePath } });
      const content = data.binary ? "[binary file — cannot display]" : (data.content ?? "");
      setFileContent(content);
      setFileEditContent(data.binary ? null : content); // null = not editable (binary)
    } catch { setFileContent("Failed to load file."); setFileEditContent(null); }
    finally { setFileLoading(false); }
  }

  // ── Save open tree file to disk ──────────────────────────────────────────────
  async function saveTreeFile() {
    if (!selectedTreeFile || fileEditContent === null) return;
    setFileSaving(true); setFileSaveMsg("");
    try {
      await api.put(`/admin/workspaces/${project.workspaceId}/projects/${projectId}/file`, { path: selectedTreeFile, content: fileEditContent });
      setFileContent(fileEditContent);
      setFileSaveMsg("Saved ✓");
    } catch (e) {
      setFileSaveMsg(e.response?.data?.error || "Save failed");
    } finally {
      setFileSaving(false);
      setTimeout(() => setFileSaveMsg(""), 3000);
    }
  }

  function toggleDir(dirPath) {
    setOpenDirs(prev => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath); else next.add(dirPath);
      return next;
    });
  }

  // ── Save agent.yaml ───────────────────────────────────────────────────────────
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
      const { data } = await api.put(`/admin/workspaces/${project.workspaceId}/projects/${projectId}/agents/${selectedAgent.id}`, payload);
      setAgents(a => a.map(ag => ag.id === data.agent.id ? data.agent : ag));
      setSelectedAgent(data.agent);
      setSaveMsg("Saved ✓");
    } catch (e) {
      setSaveMsg(e.response?.data?.error || "Save failed");
    } finally { setSaving(false); }
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

  // ── Save all (agent.yaml + oe-config + open tree file) ───────────────────────
  async function saveAll() {
    setSavingAll(true); setSaveAllMsg("");
    const errs = [];
    try {
      // Save agent.yaml (always, even if tree file is open)
      if (selectedAgent) {
        try {
          let agentName = selectedAgent.name;
          try { const d = yamlLoad(yamlContent); if (d?.name) agentName = d.name; } catch {}
          const payload = { name: agentName, description: selectedAgent.description || null, fileName: selectedAgent.fileName || "agent.yaml", yamlContent, isDefault: selectedAgent.isDefault || false };
          const { data } = await api.put(`/admin/workspaces/${project.workspaceId}/projects/${projectId}/agents/${selectedAgent.id}`, payload);
          setAgents(a => a.map(ag => ag.id === data.agent.id ? data.agent : ag));
          setSelectedAgent(data.agent);
          setSaveMsg("Saved ✓");
        } catch (e) { errs.push("Agent: " + (e.response?.data?.error || "failed")); }
      }
      // Save oe-config.json
      if (!hideKeys) {
        try {
          const parsed = JSON.parse(oeRaw);
          const { data } = await api.put(`/admin/workspaces/${project.workspaceId}/projects/${projectId}`, { oeConfig: parsed });
          setProject(p => ({ ...p, oeConfig: data.project.oeConfig }));
          setOeSaved(true); setTimeout(() => setOeSaved(false), 2000);
          setOeError("");
        } catch (e) { errs.push("Config: " + (e instanceof SyntaxError ? "invalid JSON" : (e.response?.data?.error || "failed"))); }
      }
      // Save open tree file (e.g. SKILL.md) if it has been edited
      if (selectedTreeFile && fileEditContent !== null && fileEditContent !== fileContent) {
        try {
          await api.put(`/admin/workspaces/${project.workspaceId}/projects/${projectId}/file`, { path: selectedTreeFile, content: fileEditContent });
          setFileContent(fileEditContent);
          setFileSaveMsg("Saved ✓");
        } catch (e) { errs.push(`${selectedTreeFile}: ` + (e.response?.data?.error || "failed")); }
      }
      setSaveAllMsg(errs.length === 0 ? "All saved ✓" : errs.join(" · "));
      setTimeout(() => setSaveAllMsg(""), 3000);
    } finally { setSavingAll(false); }
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
          <p className="text-white/50 text-[10px]">Agent</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {saveAllMsg && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${saveAllMsg.includes("failed") || saveAllMsg.includes("failed") ? "bg-red-500/20 text-red-200" : "bg-green-500/20 text-green-200"}`}>
              {saveAllMsg}
            </span>
          )}
          <button
            onClick={saveAll}
            disabled={savingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Icon d={ICONS.save} size="3.5" />
            {savingAll ? "Saving…" : "Save Agent"}
          </button>
        </div>
      </header>

      {/* 4-panel body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Panel 1 — file tree */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto py-1">
            {/* Root folder — click to show agent.yaml + oe-config.json */}
            <div
              onClick={() => setSelectedTreeFile(null)}
              className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer select-none ${!selectedTreeFile ? "text-indigo font-semibold" : "text-gray-600 hover:text-gray-900"}`}
            >
              <span className="text-base">{selectedTreeFile ? "📁" : "📂"}</span>
              <span className="text-sm font-semibold truncate">{rootName || project?.name}</span>
            </div>

            {/* File tree */}
            <FileTree
              nodes={tree}
              depth={0}
              openDirs={openDirs}
              onToggle={toggleDir}
              selectedFile={selectedTreeFile}
              onSelectFile={loadFile}
            />
          </div>
        </aside>

        {/* Panel 2 — file content viewer (when tree file selected) or agent.yaml editor */}
        <main className="flex-1 flex flex-col overflow-hidden border-r border-gray-200 min-w-0">
        {selectedTreeFile ? (
          <>
            <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white">
              <span className="text-base">{fileEmoji(selectedTreeFile.split("/").pop())}</span>
              <span className="text-sm font-bold text-gray-800 truncate">{selectedTreeFile}</span>
              {fileEditContent !== null && !fileLoading && (
                <span className="text-[10px] text-gray-400">{fileEditContent.split("\n").length} lines</span>
              )}
              {fileSaveMsg && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${fileSaveMsg.includes("✓") ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                  {fileSaveMsg}
                </span>
              )}
              {fileEditContent !== null && (
                <button onClick={saveTreeFile} disabled={fileSaving}
                  className="ml-auto btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs shrink-0">
                  <Icon d={ICONS.save} size="3.5" />
                  {fileSaving ? "Saving…" : "Save"}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-hidden p-3 flex flex-col">
              {fileLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-4 border-indigo border-t-transparent rounded-full animate-spin" />
                </div>
              ) : fileEditContent !== null ? (
                <textarea
                  value={fileEditContent}
                  onChange={e => setFileEditContent(e.target.value)}
                  spellCheck={false}
                  className="flex-1 w-full font-mono text-xs text-gray-200 bg-gray-950 rounded-lg p-4 outline-none resize-none leading-relaxed focus:ring-1 focus:ring-indigo/50"
                />
              ) : (
                <pre className="text-xs text-gray-200 bg-gray-950 rounded-lg p-4 min-h-full leading-relaxed overflow-x-auto whitespace-pre font-mono">{fileContent}</pre>
              )}
            </div>
          </>
        ) : (
        <>
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
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-gray-800 shrink-0">{selectedAgent.fileName || "agent.yaml"}</span>
                  {yamlContent && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                      {yamlContent.split("\n").length} lines
                    </span>
                  )}
                  {saveMsg && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${saveMsg.includes("✓") ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                      {saveMsg}
                    </span>
                  )}
                </div>
                <button onClick={saveAgent} disabled={saving}
                  className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs shrink-0 ml-2">
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
        </>
        )}
        </main>

        {/* Panel 3 — oe-config.json (hidden when a tree file is open) */}
        {!selectedTreeFile && (
        <aside className="w-[320px] shrink-0 bg-gray-50 flex flex-col overflow-hidden border-l border-gray-200">
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">oe-config.json</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">LLM · connectors · server</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHideKeys(v => !v)}
                title={hideKeys ? "Show sensitive values" : "Hide sensitive values"}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {hideKeys ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
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
        )}

      </div>

    </div>
  );
}
