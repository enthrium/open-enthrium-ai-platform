import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../utils/api";

function Spinner() {
  return <div className="w-5 h-5 border-[2.5px] border-indigo border-t-transparent rounded-full animate-spin" />;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        copied ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// ── Sidebar shared with other workspace pages ────────────────────────────────
function WorkspaceSidebar({ slug, workspace, navigate, activeTab }) {
  const navItems = [
    {
      id: "chat", label: "Chat",
      path: `/workspace/${slug}`,
      icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    },
    {
      id: "projects", label: "Agent Projects",
      path: `/workspace/${slug}/projects`,
      icon: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
    },
    {
      id: "embed", label: "Embed",
      path: `/workspace/${slug}/embed`,
      icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    },
  ];

  return (
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="flex-1 text-sm font-semibold text-gray-900 truncate min-w-0">{workspace?.name || "…"}</p>
        </div>
      </div>
      <div className="flex-1" />
      <div className="shrink-0 border-t border-gray-200 px-3 py-3 space-y-0.5">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm transition-colors ${
              activeTab === item.id
                ? "bg-indigo/10 text-indigo font-medium"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function WorkspaceEmbedPage() {
  const { slug }   = useParams();
  const navigate   = useNavigate();

  const [workspace,     setWorkspace]     = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [error,         setError]         = useState("");
  const [embedEnabled,  setEmbedEnabled]  = useState(false);
  const [showPreview,   setShowPreview]   = useState(false);

  useEffect(() => {
    api.get(`/workspaces/${slug}`)
      .then(r => {
        const ws = r.data.workspace;
        setWorkspace(ws);
        setEmbedEnabled(ws.embedEnabled ?? false);
      })
      .catch(() => setError("Failed to load workspace"))
      .finally(() => setLoading(false));
  }, [slug]);

  async function save(enabled) {
    setSaving(true);
    setError("");
    try {
      const { data } = await api.put(`/workspaces/${slug}`, { embedEnabled: enabled });
      setWorkspace(data.workspace);
      setEmbedEnabled(data.workspace.embedEnabled);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to save");
    } finally { setSaving(false); }
  }

  const origin   = window.location.origin;
  const embedUrl = `${origin}/embed/${slug}`;
  const iframeSnippet = `<iframe
  src="${embedUrl}"
  width="400"
  height="600"
  style="border:none; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.12);"
  allow="microphone"
></iframe>`;

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-white"><Spinner /></div>
  );

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <WorkspaceSidebar slug={slug} workspace={workspace} navigate={navigate} activeTab="embed" />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl flex flex-col gap-6">

            <div>
              <h2 className="text-xl font-bold text-gray-900">Embed into Website</h2>
              <p className="text-sm text-gray-400 mt-1">Let visitors chat with this workspace from any webpage — no login required.</p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
            )}

            {/* Enable toggle */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">Public Embed Access</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  When enabled, the embed URL is publicly accessible without login.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {saving && <Spinner />}
                {saved && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
                <button
                  onClick={() => { const next = !embedEnabled; setEmbedEnabled(next); save(next); }}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-60 ${
                    embedEnabled ? "bg-indigo" : "bg-gray-300"
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    embedEnabled ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            </div>

            {/* Embed URL */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
              <p className="text-sm font-semibold text-gray-800">Embed URL</p>
              <div className="flex items-center gap-3">
                <code className={`flex-1 text-xs font-mono px-3 py-2.5 rounded-lg border ${
                  embedEnabled
                    ? "bg-gray-50 border-gray-200 text-gray-800"
                    : "bg-gray-50 border-gray-200 text-gray-400 line-through"
                }`}>
                  {embedUrl}
                </code>
                <CopyButton text={embedUrl} />
                {embedEnabled && (
                  <a href={embedUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo text-white hover:bg-indigo/90 transition-colors whitespace-nowrap">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open
                  </a>
                )}
              </div>
              {!embedEnabled && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Enable "Public Embed Access" above to activate this URL.
                </p>
              )}
            </div>

            {/* iframe snippet */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">HTML Snippet</p>
                <CopyButton text={iframeSnippet} />
              </div>
              <pre className="text-xs font-mono bg-gray-950 text-gray-200 rounded-xl p-4 overflow-x-auto leading-relaxed">
                {iframeSnippet}
              </pre>
              <p className="text-xs text-gray-400">
                Paste this into any webpage to embed the chat widget. You can adjust <code className="font-mono">width</code> and <code className="font-mono">height</code> as needed.
              </p>
            </div>

            {/* Live preview */}
            {embedEnabled && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Live Preview</p>
                  <button
                    onClick={() => setShowPreview(v => !v)}
                    className="text-xs font-medium text-indigo hover:text-indigo/80 transition-colors"
                  >
                    {showPreview ? "Hide" : "Show preview"}
                  </button>
                </div>
                {showPreview && (
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center p-4">
                    <iframe
                      src={embedUrl}
                      width="400"
                      height="560"
                      style={{ border: "none", borderRadius: "12px", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}
                      title="Embed preview"
                    />
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
