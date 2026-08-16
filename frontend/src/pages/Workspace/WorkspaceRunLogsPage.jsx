import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { Spinner } from "../../components/ui";
import ConfirmDialog from "../../components/ConfirmDialog";

const HEADER_STYLE = { background: "linear-gradient(145deg,#13103a 0%,#1e1b4b 40%,#2e2a80 80%,#4f46e5 100%)" };

const PERIODS = [
  { id: "7d",  label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

function statusBadge(status) {
  const s = {
    success:   { bg: "bg-green-100 text-green-700",   dot: "bg-green-500"  },
    error:     { bg: "bg-red-100 text-red-600",       dot: "bg-red-500"    },
    running:   { bg: "bg-blue-100 text-blue-600",     dot: "bg-blue-500"   },
    cancelled: { bg: "bg-gray-100 text-gray-500",     dot: "bg-gray-400"   },
  };
  const style = s[status] || { bg: "bg-gray-100 text-gray-500", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      {status}
    </span>
  );
}

export default function WorkspaceRunLogsPage() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [runs, setRuns]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(null);
  const [period, setPeriod]       = useState("all");
  const [clearing, setClearing]     = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  function fetchRuns(p) {
    setLoading(true);
    const q = p !== "all" ? `?period=${p}` : "";
    api.get(`/workspaces/${slug}/project-runs${q}`)
      .then(r => setRuns(r.data.runs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!slug) return;
    api.get(`/workspaces/${slug}`).then(r => setWorkspace(r.data.workspace)).catch(() => {});
    fetchRuns("all");
  }, [slug]);
  useEffect(() => { if (slug) fetchRuns(period); }, [period]);

  useEffect(() => {
    if (!slug) return;
    const id = setInterval(() => {
      const q = period !== "all" ? `?period=${period}` : "";
      api.get(`/workspaces/${slug}/project-runs${q}`)
        .then(r => setRuns(r.data.runs || []))
        .catch(() => {});
    }, 6000);
    return () => clearInterval(id);
  }, [slug, period]);

  async function clearRuns() {
    setClearing(true);
    setConfirmClear(false);
    try {
      await api.delete(`/workspaces/${slug}/project-runs`);
      setRuns([]);
      setExpanded(null);
    } catch { /* ignore */ }
    finally { setClearing(false); }
  }

  const fmt = (dt) => dt ? new Date(dt).toLocaleString() : "—";
  const duration = (r) => {
    if (!r.completedAt) return "—";
    const ms = new Date(r.completedAt) - new Date(r.startedAt);
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };
  const triggeredByLabel = (r) =>
    r.triggeredBy ? (r.triggeredBy.name || r.triggeredBy.email) : "Manual";

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header — same gradient as WorkspaceProjectsPage */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4" style={HEADER_STYLE}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/workspace/${slug}/projects`)}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-white font-semibold">{workspace?.name || "…"}</h1>
            <p className="text-white/50 text-xs">Run Logs</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
            {/* Period filter */}
            <div className="flex gap-1 bg-white/10 rounded-lg p-1">
              {PERIODS.map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === p.id ? "bg-white text-gray-900 shadow-sm" : "text-white/70 hover:text-white"}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button onClick={() => fetchRuns(period)} className="text-xs text-white/70 hover:text-white font-medium px-1">↻</button>

            {/* Clear */}
            {runs.length > 0 && (
              <button onClick={() => setConfirmClear(true)} disabled={clearing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/80 border border-white/20 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
                {clearing
                  ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                }
                Clear
              </button>
            )}

            {/* Export */}
            {runs.length > 0 && (
              <div className="flex gap-0 border border-white/20 rounded-lg overflow-hidden bg-white/10">
                <button onClick={() => {
                  const headers = ["Project", "Agent", "Status", "Triggered By", "Started", "Duration", "Output", "Error"];
                  const rows = runs.map(r => [
                    r.project?.name || "", r.agent?.name || "", r.status,
                    triggeredByLabel(r), fmt(r.startedAt), duration(r),
                    r.output || "", r.error || "",
                  ]);
                  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
                  a.download = `run-logs-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                }} className="px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition-colors">.csv</button>

                <button onClick={() => {
                  const lines = [`# Run Logs`, `*Generated: ${new Date().toLocaleString()} — ${runs.length} runs*`, ""];
                  runs.forEach((r, i) => {
                    lines.push(`## ${i+1}. ${r.project?.name || "—"} › ${r.agent?.name || "—"}`);
                    lines.push(`- **Status:** ${r.status} · **By:** ${triggeredByLabel(r)} · **Started:** ${fmt(r.startedAt)} · **Duration:** ${duration(r)}`);
                    if (r.output) lines.push("", "```", r.output, "```");
                    if (r.error)  lines.push("", "**Error:**", "```", r.error, "```");
                    lines.push("", "---", "");
                  });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown" }));
                  a.download = `run-logs-${new Date().toISOString().slice(0,10)}.md`;
                  a.click();
                }} className="px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 border-l border-white/20 transition-colors">.md</button>

                <button onClick={() => {
                  const escape = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
                  const blocks = runs.map((r,i) =>
                    `<div class="run"><h2>${i+1}. ${escape(r.project?.name)} › ${escape(r.agent?.name)}</h2>` +
                    `<div class="meta"><span class="status ${r.status}">${escape(r.status)}</span> · ${escape(triggeredByLabel(r))} · ${escape(fmt(r.startedAt))} · ${escape(duration(r))}</div>` +
                    `${r.output ? `<pre>${escape(r.output)}</pre>` : ""}${r.error ? `<pre class="error">${escape(r.error)}</pre>` : ""}</div>`
                  ).join("");
                  const w = window.open("","_blank");
                  w.document.write(`<html><head><title>Run Logs</title><style>body{font-family:system-ui,sans-serif;font-size:13px;padding:32px;max-width:900px;margin:auto}.run{margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}h2{font-size:14px;font-weight:600;margin:0;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb}.meta{padding:8px 14px;font-size:12px;color:#6b7280}.status{font-weight:600}.status.success{color:#15803d}.status.error{color:#dc2626}pre{margin:0;padding:12px 14px;font-size:11px;white-space:pre-wrap;word-break:break-word;font-family:monospace}pre.error{background:#fef2f2;color:#dc2626}@media print{.run{page-break-inside:avoid}}</style></head><body><h1>Run Logs</h1><p style="color:#888;font-size:12px">Generated: ${new Date().toLocaleString()} · ${runs.length} runs</p>${blocks}</body></html>`);
                  w.document.close(); w.print();
                }} className="px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 border-l border-white/20 transition-colors">.pdf</button>
              </div>
            )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-indigo" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">No runs yet</p>
            <p className="text-xs text-gray-400">Project runs for this workspace will appear here</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Project", "Agent", "Status", "Triggered By", "Started", "Duration", "Logs"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map(r => (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[140px] truncate">{r.project?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{r.agent?.name || "—"}</td>
                      <td className="px-4 py-3">{statusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-gray-500">{triggeredByLabel(r)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(r.startedAt)}</td>
                      <td className="px-4 py-3 text-gray-500">{duration(r)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${expanded === r.id ? "bg-indigo text-white border-indigo" : "bg-white text-indigo border-indigo/40 hover:border-indigo"}`}>
                          {expanded === r.id ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Output</span>
                            <div className="flex gap-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
                              <button onClick={() => {
                                const headers = ["Project", "Agent", "Status", "Triggered By", "Started", "Duration", "Output", "Error"];
                                const row = [r.project?.name || "", r.agent?.name || "", r.status, triggeredByLabel(r), fmt(r.startedAt), duration(r), r.output || "", r.error || ""];
                                const csv = [headers, row].map(cols => cols.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
                                const a = document.createElement("a");
                                a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
                                a.download = `run-${r.id}-${new Date().toISOString().slice(0,10)}.csv`;
                                a.click();
                              }} className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">.csv</button>

                              <button onClick={() => {
                                const lines = [
                                  `# ${r.project?.name || "Project"} › ${r.agent?.name || "Agent"} — Run Log`,
                                  `- **Status:** ${r.status}  **By:** ${triggeredByLabel(r)}  **Started:** ${fmt(r.startedAt)}  **Duration:** ${duration(r)}`,
                                  "",
                                ];
                                if (r.output) { lines.push("## Output", "```", r.output, "```", ""); }
                                if (r.error)  { lines.push("## Error",  "```", r.error,  "```", ""); }
                                const a = document.createElement("a");
                                a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown" }));
                                a.download = `run-${r.id}-${new Date().toISOString().slice(0,10)}.md`;
                                a.click();
                              }} className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 border-l border-gray-200 transition-colors">.md</button>

                              <button onClick={() => {
                                const escape = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
                                const w = window.open("","_blank");
                                w.document.write(`<html><head><title>${escape(r.project?.name)} › ${escape(r.agent?.name)}</title><style>body{font-family:system-ui,sans-serif;font-size:13px;padding:32px;max-width:900px;margin:auto}h1{font-size:18px;font-weight:700;margin-bottom:4px}h2{font-size:13px;font-weight:600;color:#4b5563;margin:16px 0 6px}.meta{font-size:12px;color:#6b7280;margin-bottom:20px}pre{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;font-size:11px;white-space:pre-wrap;word-break:break-word;font-family:monospace}pre.error{background:#fef2f2;border-color:#fecaca;color:#dc2626}@media print{pre{page-break-inside:avoid}}</style></head><body><h1>${escape(r.project?.name||"Project")} › ${escape(r.agent?.name||"Agent")}</h1><div class="meta">Status: <strong>${escape(r.status)}</strong> · By: ${escape(triggeredByLabel(r))} · ${escape(fmt(r.startedAt))} · ${escape(duration(r))}</div>${r.output?`<h2>Output</h2><pre>${escape(r.output)}</pre>`:""}${r.error?`<h2>Error</h2><pre class="error">${escape(r.error)}</pre>`:""}</body></html>`);
                                w.document.close(); w.print();
                              }} className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 border-l border-gray-200 transition-colors">.pdf</button>
                            </div>
                          </div>
                          {r.input && (
                            <div className="mb-2">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Input</p>
                              <pre className="text-xs text-gray-500 whitespace-pre-wrap font-mono bg-white border border-gray-200 rounded-lg p-3 max-h-32 overflow-y-auto">{r.input}</pre>
                            </div>
                          )}
                          {r.output && <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">{r.output}</pre>}
                          {r.error  && <pre className={`text-xs text-red-600 whitespace-pre-wrap font-mono bg-red-50 border border-red-200 rounded-lg p-3 max-h-64 overflow-y-auto ${r.output ? "mt-2" : ""}`}>{r.error}</pre>}
                          {!r.output && !r.error && <p className="text-xs text-gray-400 italic">No output recorded.</p>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear Run Logs"
          message="All project run logs for this workspace will be permanently deleted."
          confirmLabel="Clear All"
          loading={clearing}
          onConfirm={clearRuns}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
