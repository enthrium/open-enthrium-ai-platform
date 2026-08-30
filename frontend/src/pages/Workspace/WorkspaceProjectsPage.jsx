import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import { load as yamlLoad } from "js-yaml";
import ConfirmDialog from "../../components/ConfirmDialog";

function Spinner() {
  return <div className="w-5 h-5 border-2 border-indigo border-t-transparent rounded-full animate-spin" />;
}

function pluralize(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// ─── CRC-32 table (for ZIP store method) ──────────────────────────────────────
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = CRC32_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Build ZIP (store, no compression) ────────────────────────────────────────
function buildZip(files) {
  const enc = new TextEncoder();
  const localHeaders = [];
  const entries = [];
  let offset = 0;

  for (const { name, content } of files) {
    const nameBytes    = enc.encode(name);
    const contentBytes = typeof content === "string" ? enc.encode(content) : content;
    const checksum     = crc32(contentBytes);
    const size         = contentBytes.length;

    const lh = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0,  0x04034b50, true);
    dv.setUint16(4,  20,         true);
    dv.setUint16(6,  0,          true);
    dv.setUint16(8,  0,          true); // store
    dv.setUint16(10, 0,          true);
    dv.setUint16(12, 0,          true);
    dv.setUint32(14, checksum,   true);
    dv.setUint32(18, size,       true);
    dv.setUint32(22, size,       true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0,          true);
    lh.set(nameBytes, 30);

    localHeaders.push(lh);
    entries.push({ nameBytes, checksum, size, offset, contentBytes });
    offset += lh.length + size;
  }

  const centralDirs = entries.map(({ nameBytes, checksum, size, offset: lo }) => {
    const cd = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(cd.buffer);
    dv.setUint32(0,  0x02014b50,       true);
    dv.setUint16(4,  20,               true);
    dv.setUint16(6,  20,               true);
    dv.setUint32(16, checksum,         true);
    dv.setUint32(20, size,             true);
    dv.setUint32(24, size,             true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint32(42, lo,               true);
    cd.set(nameBytes, 46);
    return cd;
  });

  const cdSize = centralDirs.reduce((s, c) => s + c.length, 0);
  const eocd   = new Uint8Array(22);
  const edv    = new DataView(eocd.buffer);
  edv.setUint32(0,  0x06054b50,      true);
  edv.setUint16(8,  entries.length,  true);
  edv.setUint16(10, entries.length,  true);
  edv.setUint32(12, cdSize,          true);
  edv.setUint32(16, offset,          true);

  const parts = [];
  for (let i = 0; i < entries.length; i++) parts.push(localHeaders[i], entries[i].contentBytes);
  parts.push(...centralDirs, eocd);

  const total = parts.reduce((s, p) => s + p.length, 0);
  const out   = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

// ─── Read ZIP (store=0 and deflate=8) ─────────────────────────────────────────
async function readZip(buf) {
  const view = new DataView(buf);
  const dec  = new TextDecoder();
  const files = {};
  let i = 0;
  while (i < buf.byteLength - 4) {
    if (view.getUint32(i, true) !== 0x04034b50) { i++; continue; }
    const method    = view.getUint16(i + 8,  true);
    const cSize     = view.getUint32(i + 18, true);
    const nameLen   = view.getUint16(i + 26, true);
    const extraLen  = view.getUint16(i + 28, true);
    const name      = dec.decode(new Uint8Array(buf, i + 30, nameLen));
    const dataStart = i + 30 + nameLen + extraLen;
    if (!name.endsWith("/")) {
      const compressed = new Uint8Array(buf, dataStart, cSize);
      if (method === 0) {
        files[name] = dec.decode(compressed);
      } else if (method === 8) {
        const ds     = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        writer.write(compressed); writer.close();
        const chunks = [];
        const reader = ds.readable.getReader();
        while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
        const total = chunks.reduce((s, c) => s + c.length, 0);
        const out   = new Uint8Array(total); let pos = 0;
        for (const c of chunks) { out.set(c, pos); pos += c.length; }
        files[name] = dec.decode(out);
      }
    }
    i = dataStart + cSize;
  }
  // Strip common root-folder prefix (e.g. "my-project/" wrapping everything)
  const keys = Object.keys(files);
  if (keys.length > 0) {
    const firstSlash = keys[0].indexOf("/");
    if (firstSlash > 0) {
      const prefix = keys[0].slice(0, firstSlash + 1);
      if (keys.every(k => k.startsWith(prefix))) {
        const stripped = {};
        for (const [k, v] of Object.entries(files)) stripped[k.slice(prefix.length)] = v;
        return stripped;
      }
    }
  }
  return files;
}

// ─── Robust JSON parse (BOM + control chars inside strings) ───────────────────
function robustJsonParse(text) {
  let s = (text || "").replace(/^﻿/, "");
  try { return JSON.parse(s); } catch {}
  let fixed = "", inStr = false, esc = false;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (esc)         { fixed += ch; esc = false; continue; }
    if (ch === "\\") { fixed += ch; esc = true;  continue; }
    if (ch === '"')  { fixed += ch; inStr = !inStr; continue; }
    if (inStr && cp < 0x20) {
      if (cp === 9)  { fixed += "\\t"; continue; }
      if (cp === 10) { fixed += "\\n"; continue; }
      if (cp === 13) { fixed += "\\r"; continue; }
      fixed += `\\u${cp.toString(16).padStart(4, "0")}`;
      continue;
    }
    fixed += ch;
  }
  return JSON.parse(fixed);
}

// ─── Sensitive key masking (for ZIP export) ────────────────────────────────────
const SENSITIVE_KEY_RE = /key|password|secret|token|auth|pass|credential|connection_string|apikey|private/i;
function maskForExport(val) {
  if (Array.isArray(val)) return val.map(maskForExport);
  if (val && typeof val === "object")
    return Object.fromEntries(Object.entries(val).map(([k, v]) =>
      [k, SENSITIVE_KEY_RE.test(k) && typeof v === "string" && v.length > 0 ? "YOUR_API_KEY" : maskForExport(v)]
    ));
  return val;
}

// ─── Manifest editor dialog ────────────────────────────────────────────────────
function ManifestDialog({ project, workspaceId, onSave, onClose }) {
  const initial = (() => {
    try {
      const m = JSON.parse(project.manifest || "{}");
      const { agents: _a, name: _n, version: _v, description: _d, author: _au, tags: _t, ...rest } = m;
      const full = {
        name:        _n  ?? project.name ?? "",
        version:     _v  ?? "1.0.0",
        description: _d  ?? project.description ?? "",
        author:      _au ?? "",
        tags:        Array.isArray(_t) ? _t : [],
        ...rest,
        agents:      _a  ?? [],
      };
      return JSON.stringify(full, null, 2);
    } catch { return "{}"; }
  })();
  const [raw,    setRaw]    = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function save() {
    setError("");
    let parsed;
    try { parsed = JSON.parse(raw); } catch { setError("Invalid JSON"); return; }
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/workspaces/${workspaceId}/projects/${project.id}`, { manifest: parsed });
      onSave(data.project);
    } catch (e) { setError(e.response?.data?.error || "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl" style={{ height: "80vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">oe-project.json</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">{project.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo text-white hover:bg-indigo/90 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {error && (
          <div className="mx-5 mt-3 shrink-0 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</div>
        )}
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <textarea
            value={raw}
            onChange={e => { setRaw(e.target.value); setError(""); }}
            spellCheck={false}
            autoFocus
            className="flex-1 w-full font-mono text-xs text-gray-200 bg-gray-950 rounded-xl p-4 outline-none resize-none leading-relaxed focus:ring-1 focus:ring-indigo/40"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Templates dialog ──────────────────────────────────────────────────────────
function TemplatesDialog({ onImport, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");

  useEffect(() => {
    api.get("/admin/templates")
      .then(r => setTemplates(r.data.templates || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter(t =>
    !search ||
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl" style={{ height: "80vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Built-in Templates</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">{templates.length} templates · click one to import</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo/50 focus:ring-1 focus:ring-indigo/20"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No templates found.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map((t, i) => (
                <button key={i} onClick={() => onImport(t)}
                  className="text-left p-4 border border-gray-200 rounded-xl hover:border-indigo/40 hover:bg-indigo/5 transition-all group">
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo transition-colors">{t.name}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>}
                  <p className="text-[10px] text-gray-400 mt-2">{t.agentCount ?? 0} skill{(t.agentCount ?? 0) !== 1 ? "s" : ""}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Run Modal ────────────────────────────────────────────────────────────────
function RunModal({ project, slug, onClose, onRunStart, onRunEnd }) {
  // ── single-skill state ────────────────────────────────────────────────────────
  const [agents,        setAgents]        = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [selectedId,    setSelectedId]    = useState(null);
  const [triggerType,   setTriggerType]   = useState("manual");
  const [input,         setInput]         = useState("");
  const [running,       setRunning]       = useState(false);
  const [steps,         setSteps]         = useState([]);
  const [output,        setOutput]        = useState("");
  const [runId,         setRunId]         = useState(null);
  const [finished,      setFinished]      = useState(false);

  // ── chain state ───────────────────────────────────────────────────────────────
  const [chainMode,    setChainMode]    = useState(false);
  const [chainSteps,   setChainSteps]   = useState([]); // [{agent, triggerType, status, output, toolCalls, duration}]
  const [chainRunning, setChainRunning] = useState(false);
  const [chainDone,    setChainDone]    = useState(false);
  const [liveOutput,   setLiveOutput]   = useState("");
  const [approval,     setApproval]     = useState(null); // {stepIndex, skillName} | null
  const [approvalText, setApprovalText] = useState("");

  const abortRef           = useRef(null);
  const bottomRef          = useRef(null);
  const approvalResolveRef = useRef(null);
  const currentStepRef     = useRef(-1);

  // ── helpers ───────────────────────────────────────────────────────────────────
  function resolveTriggerType(ags, id) {
    if (!ags.length) return "manual";
    const idx = ags.findIndex(a => a.id === id);
    try {
      const doc    = yamlLoad(ags[0].yamlContent) || {};
      const skills = doc.skills || [];
      const entry  = skills[idx] || skills[0] || {};
      return (entry.trigger_type || entry.triggerType || "manual").toLowerCase();
    } catch { return "manual"; }
  }

  function allTriggerTypes(ags) {
    return ags.map((a, i) => resolveTriggerType(ags, a.id));
  }

  // ── load agents ───────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get(`/workspaces/${slug}/projects/${project.id}/agents`)
      .then(r => {
        const ags = r.data.agents || [];
        setAgents(ags);
        const def = ags.find(a => a.isDefault) || ags[0];
        if (def) { setSelectedId(def.id); setTriggerType(resolveTriggerType(ags, def.id)); }
      })
      .catch(() => {})
      .finally(() => setLoadingAgents(false));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [steps, output, chainSteps, liveOutput]);

  // ── stream one skill, return final output ─────────────────────────────────────
  async function streamSkill(agentId, skillInput, skillTriggerType = "manual") {
    const token = localStorage.getItem("oe_token");
    const ctrl  = new AbortController();
    abortRef.current = ctrl;
    setLiveOutput("");

    const res = await fetch(
      `/api/workspaces/${slug}/projects/${project.id}/agents/${agentId}/run`,
      { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: skillInput, triggerType: skillTriggerType }), signal: ctrl.signal }
    );

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = ""; let finalOutput = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n"); buf = parts.pop();
      for (const part of parts) {
        const line = part.startsWith("data: ") ? part : part.split("\n").find(l => l.startsWith("data: "));
        if (!line) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.tool_call) {
            const idx = currentStepRef.current;
            setChainSteps(s => s.map((st, i) => i === idx ? { ...st, toolCalls: [...(st.toolCalls||[]), evt.tool_call] } : st));
          }
          if (evt.done)  { finalOutput = evt.output || ""; setLiveOutput(evt.output || ""); }
          if (evt.error) throw new Error(evt.error);
        } catch(e) { if (e.message && !e.message.startsWith("JSON")) throw e; }
      }
    }
    return finalOutput;
  }

  // ── approval pause/resume ─────────────────────────────────────────────────────
  function waitForApproval(skillName, prevOutput) {
    setApprovalText(prevOutput);
    setApproval({ skillName });
    return new Promise(resolve => { approvalResolveRef.current = resolve; });
  }
  function handleApprove() { setApproval(null); approvalResolveRef.current?.(approvalText); }

  // ── run full chain ────────────────────────────────────────────────────────────
  async function runChain() {
    const types  = allTriggerTypes(agents);
    const initSteps = agents.map((a, i) => ({ agent: a, triggerType: types[i], status: "pending", output: "", toolCalls: [], duration: null }));
    setChainMode(true); setChainRunning(true); setChainDone(false); setChainSteps(initSteps);
    onRunStart(project.id);

    let currentInput = input.trim() || "Run";

    for (let i = 0; i < initSteps.length; i++) {
      currentStepRef.current = i;
      const step = initSteps[i];

      // Manual: pause for human review (skip first step — needs no prior output to review)
      if (step.triggerType === "manual" && i > 0) {
        setChainSteps(s => s.map((st, idx) => idx === i ? { ...st, status: "awaiting" } : st));
        currentInput = await waitForApproval(step.agent.name, currentInput);
      }

      setChainSteps(s => s.map((st, idx) => idx === i ? { ...st, status: "running" } : st));
      const t0 = Date.now();
      try {
        const out      = await streamSkill(step.agent.id, currentInput, step.triggerType);
        const duration = ((Date.now() - t0) / 1000).toFixed(1) + "s";
        setChainSteps(s => s.map((st, idx) => idx === i ? { ...st, status: "done", output: out, duration } : st));
        currentInput = out;
      } catch(e) {
        const msg = e.name === "AbortError" ? "Stopped" : e.message;
        setChainSteps(s => s.map((st, idx) => idx === i ? { ...st, status: "error", output: msg } : st));
        break;
      }
    }

    setChainRunning(false); setChainDone(true);
    onRunEnd(project.id);
  }

  // ── single skill run (existing) ───────────────────────────────────────────────
  async function startRun() {
    if (!selectedId || running) return;
    setRunning(true); setSteps([]); setOutput(""); setRunId(null); setFinished(false);
    onRunStart(project.id);
    const token = localStorage.getItem("oe_token");
    const ctrl  = new AbortController(); abortRef.current = ctrl;
    try {
      const res = await fetch(
        `/api/workspaces/${slug}/projects/${project.id}/agents/${selectedId}/run`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ input: input.trim() || "Run", triggerType }), signal: ctrl.signal }
      );
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop();
        for (const part of parts) {
          const line = part.startsWith("data: ") ? part : part.split("\n").find(l => l.startsWith("data: "));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.tool_call) setSteps(s => [...s, { type: "tool", text: evt.tool_call }]);
            if (evt.done)      { setRunId(evt.runId); setOutput(evt.output || ""); setSteps(s => [...s, { type: "done" }]); setFinished(true); }
            if (evt.error)     { setSteps(s => [...s, { type: "error", text: evt.error }]); setFinished(true); }
          } catch {}
        }
      }
    } catch(e) {
      if (e.name !== "AbortError") { setSteps(s => [...s, { type: "error", text: e.message }]); setFinished(true); }
    } finally { setRunning(false); onRunEnd(project.id); }
  }

  function stopRun() {
    abortRef.current?.abort();
    if (runId) api.post(`/workspaces/${slug}/projects/${project.id}/runs/${runId}/cancel`).catch(()=>{});
  }

  const isMulti   = agents.length > 1;
  const toolSteps = steps.filter(s => s.type === "tool");
  const hasError  = steps.some(s => s.type === "error");
  const errorMsg  = steps.find(s => s.type === "error")?.text;
  const busy      = running || chainRunning;

  // ── status icon helper ────────────────────────────────────────────────────────
  function StepIcon({ status }) {
    if (status === "done")     return <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>;
    if (status === "running")  return <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />;
    if (status === "awaiting") return <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    if (status === "error")    return <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
    return <div className="w-4 h-4 rounded-full border-2 border-gray-200" />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col w-full sm:max-w-xl"
        style={{ maxHeight: "90vh" }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            {busy && <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 text-sm truncate">{project.name}</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {chainRunning ? `Running chain… (${chainSteps.filter(s=>s.status==="done").length}/${chainSteps.length})` :
                 chainDone    ? "Chain complete" :
                 running      ? "Running…" :
                 finished     ? (hasError ? "Failed" : "Completed") : "Skill Runner"}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={busy}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Controls (hidden while chain running) ──────────────────────────── */}
        {!chainMode && (
          <div className="shrink-0 px-5 py-4 space-y-3 border-b border-gray-100">
            {loadingAgents ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                Loading skills…
              </div>
            ) : agents.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No skills in this project. Open it to add one.
              </p>
            ) : isMulti ? (
              <>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Skill</label>
                  <select value={selectedId || ""} onChange={e => { const id = Number(e.target.value); setSelectedId(id); setTriggerType(resolveTriggerType(agents, id)); }}
                    disabled={running}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 disabled:opacity-50 bg-white">
                    {agents.map((a,i) => {
                      const tt = resolveTriggerType(agents, a.id);
                      return <option key={a.id} value={a.id}>{a.name} ({tt})</option>;
                    })}
                  </select>
                </div>
                {/* Chain summary */}
                <div className="flex flex-wrap gap-1 items-center">
                  {agents.map((a,i) => {
                    const tt = resolveTriggerType(agents, a.id);
                    return (
                      <React.Fragment key={a.id}>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tt==="auto"?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>{a.name}</span>
                        {i < agents.length-1 && <span className="text-gray-300 text-xs">→</span>}
                      </React.Fragment>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium text-gray-700">{agents[0]?.name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${triggerType==="auto"?"bg-emerald-100 text-emerald-700":"bg-gray-100 text-gray-500"}`}>{triggerType}</span>
              </div>
            )}

            {/* Input — only for single skill manual or single-skill run in multi */}
            {!isMulti && (triggerType === "auto" ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-xs text-emerald-700 font-medium">Auto — runs from SKILL.md, no input needed</p>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Input <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <textarea value={input} onChange={e => setInput(e.target.value)} disabled={running} rows={2}
                  placeholder="What should the skill do?"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 resize-none disabled:opacity-50 placeholder-gray-300" />
              </div>
            ))}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2">
              {running ? (
                <button onClick={stopRun} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                  Stop
                </button>
              ) : (
                <>
                  {isMulti && (
                    <button onClick={runChain} disabled={loadingAgents || agents.length === 0}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo text-white hover:bg-indigo/90 transition-colors disabled:opacity-40 shadow-sm">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Run Chain
                    </button>
                  )}
                  <button onClick={startRun} disabled={!selectedId || loadingAgents || agents.length === 0}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40 shadow-sm shadow-emerald-200">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    {triggerType === "auto" ? "Run Auto" : "Run Skill"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Chain execution view ────────────────────────────────────────────── */}
        {chainMode && (
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            {/* Chain steps list */}
            <div className="shrink-0 px-5 py-4 border-b border-gray-100 space-y-2">
              {chainSteps.map((st, i) => (
                <div key={st.agent.id} className="flex items-center gap-3">
                  <StepIcon status={st.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold truncate ${st.status==="running"?"text-emerald-700":st.status==="error"?"text-red-600":st.status==="awaiting"?"text-amber-600":"text-gray-700"}`}>
                        {st.agent.name}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${st.triggerType==="auto"?"bg-emerald-100 text-emerald-600":"bg-amber-100 text-amber-600"}`}>
                        {st.triggerType}
                      </span>
                      {st.duration && <span className="text-[10px] text-gray-400">{st.duration}</span>}
                      {st.toolCalls?.length > 0 && <span className="text-[10px] text-indigo/60">{st.toolCalls.length} tool{st.toolCalls.length>1?"s":""}</span>}
                    </div>
                    {st.status === "error" && <p className="text-xs text-red-500 mt-0.5 truncate">{st.output}</p>}
                  </div>
                  {/* connector arrow */}
                  {i < chainSteps.length - 1 && (
                    <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>

            {/* Approval panel */}
            {approval && (
              <div className="shrink-0 px-5 py-4 border-b border-amber-100 bg-amber-50 space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold text-amber-800">Review required — <span className="font-bold">{approval.skillName}</span></p>
                </div>
                <p className="text-xs text-amber-700">Edit the output below before passing it to the next skill, then approve.</p>
                <textarea value={approvalText} onChange={e => setApprovalText(e.target.value)} rows={5}
                  className="w-full text-xs border border-amber-200 rounded-lg px-3 py-2 outline-none focus:border-amber-400 resize-y bg-white font-mono" />
                <div className="flex justify-end">
                  <button onClick={handleApprove}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve & Continue
                  </button>
                </div>
              </div>
            )}

            {/* Live output of current step */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {liveOutput && (
                <>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    {chainSteps[currentStepRef.current]?.agent?.name} — Output
                  </p>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    {liveOutput}
                  </pre>
                </>
              )}
              {chainDone && !liveOutput && (
                <p className="text-xs text-gray-400 text-center py-4">Chain complete.</p>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Stop chain */}
            {chainRunning && !approval && (
              <div className="shrink-0 px-5 py-3 border-t border-gray-100 flex justify-end">
                <button onClick={() => abortRef.current?.abort()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                  Stop Chain
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Single-skill output panel ───────────────────────────────────────── */}
        {!chainMode && steps.length > 0 && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Steps</p>
              <div className="space-y-1.5">
                {toolSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-[10px] text-gray-300 w-4 text-right shrink-0">{i + 1}</span>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-indigo/5 border border-indigo/10 rounded-lg">
                      <svg className="w-3 h-3 text-indigo shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-xs font-mono text-indigo">{s.text}</span>
                    </div>
                  </div>
                ))}
                {running && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5">
                    <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay:`${i*.15}s`}}/>)}</div>
                    <span className="text-xs text-emerald-600 font-medium">Running…</span>
                  </div>
                )}
                {finished && !hasError && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 px-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                    Done
                  </div>
                )}
                {hasError && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{errorMsg}</div>}
              </div>
            </div>
            {output && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Output</p>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">{output}</pre>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function WorkspaceProjectsPage() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const canManage  = user?.role === "admin" || user?.role === "manager";

  const [workspace,      setWorkspace]      = useState(null);
  const [projects,       setProjects]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [importing,      setImporting]      = useState(false);
  const [showCreate,     setShowCreate]     = useState(false);
  const [newName,        setNewName]        = useState("");
  const [creating,       setCreating]       = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showTemplates,  setShowTemplates]  = useState(false);
  const [copying,        setCopying]        = useState(null); // project id

  // delete dialog
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting,      setDeleting]      = useState(false);

  // manifest editor dialog
  const [editManifest, setEditManifest] = useState(null);

  // download
  const [downloading, setDownloading] = useState(null);

  // run modal
  const [runModal,           setRunModal]           = useState(null); // project
  const [runningProjectIds,  setRunningProjectIds]  = useState(new Set());
  function handleRunStart(id) { setRunningProjectIds(s => new Set([...s, id])); }
  function handleRunEnd(id)   { setRunningProjectIds(s => { const n = new Set(s); n.delete(id); return n; }); }

  // inline rename
  const [editingId,  setEditingId]  = useState(null);
  const [editName,   setEditName]   = useState("");
  const [renaming,   setRenaming]   = useState(false);
  const editInputRef                = useRef();

  const fileInputRef = useRef(); // multi-file
  const zipInputRef  = useRef(); // zip

  // close import menu on outside click
  const importMenuRef = useRef();
  useEffect(() => {
    function onClickOutside(e) {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target)) {
        setShowImportMenu(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const wsRes = await api.get(`/workspaces/${slug}`);
        const ws    = wsRes.data.workspace;
        setWorkspace(ws);
        const prRes = await api.get(`/workspaces/${slug}/projects`);
        setProjects(prRes.data.projects || []);
      } catch { setError("Failed to load projects"); }
      finally  { setLoading(false); }
    })();
  }, [slug]);

  // ── Core import logic (shared by all 4 import paths) ─────────────────────────
  // Returns true when a stored apiKey is not a real key and should be replaced from platform settings
  function isPlaceholderKey(key) {
    if (!key) return true;
    const k = key.trim();
    if (!k) return true;
    if (k === "••••••••" || k === "********") return true;
    // Common template placeholders: YOUR_OPENAI_API_KEY, <YOUR_KEY>, sk-xxx...xxx, etc.
    if (/^(YOUR_|<|{|\[)/i.test(k)) return true;
    if (/API[_-]?KEY|YOUR[_-]?KEY|REPLACE[_-]?ME|PLACEHOLDER|EXAMPLE/i.test(k)) return true;
    return false;
  }

  async function processImport(fileMap) {
    // Parse oe-config.json (optional)
    let oeConfig = null;
    if (fileMap["oe-config.json"]) {
      try { oeConfig = robustJsonParse(fileMap["oe-config.json"]); } catch {}
    }

    // Fetch real LLM settings and merge into oe-config when apiKey is absent or masked
    try {
      const { data: sd } = await api.get("/settings/oe-config");
      if (sd.llm) {
        if (!oeConfig) {
          // No oe-config at all — create default
          oeConfig = { llm: sd.llm, connectors: [] };
        } else if (!oeConfig.llm) {
          // Has oe-config but no llm block
          oeConfig.llm = sd.llm;
        } else if (isPlaceholderKey(oeConfig.llm.apiKey)) {
          // Has llm block but key is missing, masked, or a placeholder — replace with full platform config
          oeConfig.llm = { ...sd.llm };
        }
      }
    } catch {}

    // Helper: read name/description from a SKILL.md's YAML frontmatter or first heading
    function parseSkillMdName(content, fallback) {
      if (!content) return fallback;
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        try {
          const fm = yamlLoad(fmMatch[1]) || {};
          if (fm.name) return fm.name;
        } catch {}
      }
      const heading = content.split("\n").find(l => /^#\s/.test(l));
      if (heading) return heading.replace(/^#+\s+/, "").trim();
      return fallback;
    }

    // Helper: find SKILL.md for a given virtual path (handles root and subdir agents)
    function findSkillMd(skillPath) {
      // Normalize: "./" or "." → root, "./main-task" → "main-task"
      const norm = (skillPath || "./").replace(/^\.\//, "").replace(/\/$/, "");
      const key  = norm === "" ? "SKILL.md" : `${norm}/SKILL.md`;
      return fileMap[key] || fileMap[key.toLowerCase()] || "";
    }

    // ── explicit oe-project.json manifest ───────────────────────────────────────
    if (fileMap["oe-project.json"]) {
      let manifest = {};
      try { manifest = robustJsonParse(fileMap["oe-project.json"]); } catch {}
      const agents = [];
      for (const [idx, entry] of (manifest.agents || []).entries()) {
        const baseName = (entry.file || "agent.yaml").replace(/^\.\//, "");
        const content  = fileMap[baseName] || "";
        let agentName  = entry.name || baseName.replace(/\.ya?ml$/, "");
        try { const d = yamlLoad(content); if (d?.name) agentName = d.name; } catch {}
        agents.push({ name: agentName, description: entry.description || null, fileName: baseName, yamlContent: content, skillContent: findSkillMd(baseName), isDefault: entry.default || idx === 0 });
      }
      const projectName = manifest.name || agents[0]?.name || `Project ${projects.length + 1}`;
      const { data } = await api.post(`/admin/workspaces/${workspace.id}/projects`, { name: projectName, description: manifest.description || null, manifest, oeConfig, agents });
      setProjects(ps => [data.project, ...ps]);
      return;
    }

    // ── auto-detect from root agent.yaml ────────────────────────────────────────
    // Find the root-level agent.yaml (no "/" in the filename)
    const rootYamlEntry = Object.entries(fileMap).find(([f]) =>
      (f.endsWith(".yaml") || f.endsWith(".yml")) && !f.includes("/")
    );

    if (rootYamlEntry) {
      const [rootFname, rootYamlContent] = rootYamlEntry;
      let rootDoc = {};
      try { rootDoc = yamlLoad(rootYamlContent) || {}; } catch {}

      const skillPaths = (rootDoc.skills || []).map(s => s.path || "./");
      const agents = [];

      if (skillPaths.length === 0 || (skillPaths.length === 1 && (skillPaths[0] === "./" || skillPaths[0] === "."))) {
        // ── Single-agent: skill lives alongside agent.yaml ───────────────────
        const skillContent = findSkillMd("./");
        const name = parseSkillMdName(skillContent, rootDoc.name || rootFname.replace(/\.ya?ml$/, ""));
        agents.push({ name, description: rootDoc.description || null, fileName: rootFname, yamlContent: rootYamlContent, skillContent, isDefault: true });
      } else {
        // ── Multi-agent: one agent per skills[].path ─────────────────────────
        for (const [idx, sp] of skillPaths.entries()) {
          const norm         = sp.replace(/^\.\//, "").replace(/\/$/, "");
          const skillContent = findSkillMd(sp);
          const name         = parseSkillMdName(skillContent, norm || `Agent ${idx + 1}`);
          agents.push({ name, description: null, fileName: rootFname, yamlContent: rootYamlContent, skillContent, isDefault: idx === 0 });
        }
      }

      const projectName = rootDoc.name || agents[0]?.name || `Project ${projects.length + 1}`;
      const manifest    = { version: "1.0.0", description: rootDoc.description || "", author: "", tags: [], agents: agents.map((a, i) => ({ name: a.name, file: `./${a.fileName}`, default: i === 0 })) };
      const { data } = await api.post(`/admin/workspaces/${workspace.id}/projects`, { name: projectName, description: rootDoc.description || null, manifest, oeConfig, agents });
      setProjects(ps => [data.project, ...ps]);
      return;
    }

    // ── Fallback: standalone SKILL.md with no agent.yaml ────────────────────────
    const mdFiles = Object.entries(fileMap).filter(([f]) => f.toLowerCase().endsWith(".md"));
    if (mdFiles.length > 0) {
      const agents = mdFiles.map(([fname, content], idx) => ({
        name: parseSkillMdName(content, fname.replace(/\.md$/i, "")),
        description: null, fileName: fname, yamlContent: "", skillContent: content, isDefault: idx === 0,
      }));
      const projectName = agents[0]?.name || `Project ${projects.length + 1}`;
      const manifest    = { version: "1.0.0", description: "", author: "", tags: [], agents: agents.map((a, i) => ({ name: a.name, file: `./${a.fileName}`, default: i === 0 })) };
      const { data } = await api.post(`/admin/workspaces/${workspace.id}/projects`, { name: projectName, description: null, manifest, oeConfig, agents });
      setProjects(ps => [data.project, ...ps]);
    }
  }

  // ── Import: Select Files ──────────────────────────────────────────────────────
  async function handleImportFiles(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setImporting(true);
    try {
      const fileMap = {};
      await Promise.all(files.map(f => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload  = ev => { fileMap[f.name] = ev.target.result; res(); };
        r.onerror = rej;
        r.readAsText(f);
      })));
      await processImport(fileMap);
    } catch (err) { alert(err.message || "Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  }

  // ── Import: Select Folder (File System Access API — no "upload" warning) ──────
  async function handleImportFolder() {
    setShowImportMenu(false);
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "read" });
      const fileMap = {};
      // Recursively collect files: root level = all; subdirs = SKILL.md only
      async function collectDir(handle, base) {
        try {
          for await (const [name, h] of handle.entries()) {
            if (name.startsWith(".")) continue;
            const key = base ? `${base}/${name}` : name;
            if (h.kind === "file") {
              if (!base || name.toLowerCase() === "skill.md") {
                fileMap[key] = await (await h.getFile()).text();
              }
            } else if (h.kind === "directory") {
              await collectDir(h, key);
            }
          }
        } catch {}
      }
      await collectDir(dirHandle, "");
      setImporting(true);
      try { await processImport(fileMap); }
      finally { setImporting(false); }
    } catch (e) {
      if (e.name !== "AbortError") console.error("Folder import failed", e);
    }
  }

  // ── Import: ZIP file ──────────────────────────────────────────────────────────
  async function handleImportZip(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf     = await file.arrayBuffer();
      const fileMap = await readZip(buf);
      await processImport(fileMap);
    } catch (err) { alert(err.message || "ZIP import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  }

  // ── Import: Template ──────────────────────────────────────────────────────────
  async function handleImportTemplate(template) {
    setShowTemplates(false);
    setImporting(true);
    try {
      const { data } = await api.get(`/admin/templates/${template.id}`);
      await processImport(data.fileMap || {});
    } catch (err) { alert(err.message || "Template import failed"); }
    finally { setImporting(false); }
  }

  // ── Create project with default agent + SKILL.md + oe-config ────────────────
  async function createProject(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const projectName = newName.trim();

      // Fetch real LLM settings for oe-config (dedicated export endpoint)
      let llmCfg = { provider: "openai", model: "gpt-4o", apiKey: "" };
      try {
        const { data: sd } = await api.get("/settings/oe-config");
        if (sd.llm) llmCfg = sd.llm;
      } catch {}

      const defaultYaml = `name: ${projectName}\ndescription: Describe what this agent does\ninstructions: You are a helpful assistant.\nsteps:\n  - name: Main\n    content: |\n      Answer the user's question.\n`;

      const defaultSkill = `---
name: ${projectName}
description: Describe what this skill does
license: Apache-2.0
metadata:
  author: Open Enthrium
  version: "1.0"
---

You are a helpful assistant.

## Steps

### Step 1: Understand the request
Read the user's input carefully and identify what they need.

### Step 2: Respond
Provide a clear, accurate, and helpful response.
`;

      const oeConfig = { llm: llmCfg, connectors: [] };
      const agents   = [{ name: projectName, description: null, fileName: "agent.yaml", yamlContent: defaultYaml, skillContent: defaultSkill, isDefault: true }];
      const manifest = { version: "1.0.0", description: "Describe what this project does", author: "", tags: [], agents: [{ name: projectName, file: "./agent.yaml", default: true }] };

      const { data } = await api.post(`/admin/workspaces/${workspace.id}/projects`, {
        name: projectName, description: "Describe what this project does", manifest, oeConfig, agents,
      });
      setShowCreate(false);
      setNewName("");
      navigate(`/workspace/${slug}/projects/${data.project.id}`);
    } catch (err) {
      setError(err.response?.data?.error || "Create failed");
    } finally { setCreating(false); }
  }

  // ── Copy project ──────────────────────────────────────────────────────────────
  async function copyProject(e, project) {
    e.stopPropagation();
    setCopying(project.id);
    try {
      const { data: detail } = await api.get(`/admin/workspaces/${workspace.id}/projects/${project.id}`);
      const src    = detail.project;
      const agents = (src.agents || []).map(a => ({
        name: a.name, description: a.description || null,
        fileName: a.fileName, yamlContent: a.yamlContent || "",
        skillContent: a.skillContent || "", isDefault: a.isDefault,
      }));
      let manifest = null;
      try { manifest = JSON.parse(src.manifest || "null"); } catch {}
      let oeConfig  = null;
      try { oeConfig  = JSON.parse(src.oeConfig  || "null"); } catch {}

      const { data } = await api.post(`/admin/workspaces/${workspace.id}/projects`, {
        name: `${src.name} (copy)`, description: src.description || null, manifest, oeConfig, agents,
      });
      setProjects(ps => [data.project, ...ps]);
    } catch { setError("Copy failed"); }
    finally { setCopying(null); }
  }

  // ── Delete project ────────────────────────────────────────────────────────────
  function deleteProject(e, project) {
    e.stopPropagation();
    setConfirmDelete(project);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/workspaces/${workspace.id}/projects/${confirmDelete.id}`);
      setProjects(ps => ps.filter(p => p.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch { setError("Delete failed"); }
    finally { setDeleting(false); }
  }

  // ── Inline rename ─────────────────────────────────────────────────────────────
  function startEdit(e, project) {
    e.stopPropagation();
    setEditingId(project.id);
    setEditName(project.name);
    setTimeout(() => { editInputRef.current?.focus(); editInputRef.current?.select(); }, 10);
  }

  async function commitRename(project) {
    if (!editName.trim() || renaming) return;
    if (editName.trim() === project.name) { setEditingId(null); return; }
    setRenaming(true);
    try {
      const { data } = await api.put(`/admin/workspaces/${workspace.id}/projects/${project.id}`, { name: editName.trim() });
      setProjects(ps => ps.map(p => p.id === project.id ? { ...p, name: data.project.name } : p));
      setEditingId(null);
    } catch { setError("Rename failed"); }
    finally { setRenaming(false); }
  }

  // ── Download project as ZIP ───────────────────────────────────────────────────
  async function downloadProject(e, project) {
    e.stopPropagation();
    setDownloading(project.id);
    try {
      const { data } = await api.get(`/admin/workspaces/${workspace.id}/projects/${project.id}`);
      const proj   = data.project;
      const skills = proj.agents || [];
      const files  = [];

      // ── oe-config.json — mask sensitive keys before export ────────────────────
      if (proj.oeConfig) {
        try {
          const masked = maskForExport(JSON.parse(proj.oeConfig));
          files.push({ name: "oe-config.json", content: JSON.stringify(masked, null, 2) });
        } catch {}
      }

      const isSingle = skills.length <= 1;

      if (isSingle) {
        // Single-skill: agent.yaml + SKILL.md at root
        const skill = skills[0];
        if (skill?.yamlContent) files.push({ name: "agent.yaml", content: skill.yamlContent });
        if (skill?.skillContent) files.push({ name: "SKILL.md",  content: skill.skillContent });
      } else {
        // Multi-skill: shared agent.yaml at root, each skill in its own subfolder
        // All skills share the same agent.yaml — write it once from the first skill
        if (skills[0]?.yamlContent) files.push({ name: "agent.yaml", content: skills[0].yamlContent });

        // Parse agent.yaml to get skills[].path so ZIP folders match what findSkillMd expects on re-import
        let yamlPaths = [];
        try {
          const doc = yamlLoad(skills[0]?.yamlContent || "") || {};
          yamlPaths = (doc.skills || []).map(s => (s.path || "").replace(/^\.\//, "").replace(/\/$/, ""));
        } catch {}

        for (const [idx, skill] of skills.entries()) {
          if (!skill.skillContent) continue;
          // Use the yaml path if available (so re-import resolves correctly), else fall back to slugified name
          const folder = yamlPaths[idx]
            || skill.name.toLowerCase().replace(/[^a-z0-9/]+/g, "-").replace(/^-|-$/g, "");
          files.push({ name: `${folder}/SKILL.md`, content: skill.skillContent });
        }
      }

      const zipBytes = buildZip(files);
      const blob     = new Blob([zipBytes], { type: "application/zip" });
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement("a");
      a.href         = url;
      a.download     = `${proj.name.replace(/[^a-z0-9]/gi, "-")}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { setError("Download failed"); }
    finally { setDownloading(null); }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50"><Spinner /></div>
  );
  if (error) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
      <p className="text-red-500">{error}</p>
      <button onClick={() => navigate("/workspaces")} className="btn-secondary px-4 py-2 text-sm">Back</button>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200"
        style={{ background: "linear-gradient(145deg,#13103a 0%,#1e1b4b 40%,#2e2a80 80%,#4f46e5 100%)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/workspaces")}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-white font-semibold">{workspace?.name}</h1>
            <p className="text-white/50 text-xs">Agents</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && showCreate ? (
            <form onSubmit={createProject} className="flex items-center gap-2">
              <input
                autoFocus
                className="px-3 py-1.5 text-sm rounded-lg bg-white/10 text-white placeholder-white/40 border border-white/20 outline-none focus:border-white/50 w-48"
                placeholder="Project name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <button type="submit" disabled={creating}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-indigo hover:bg-white/90 transition-colors disabled:opacity-50">
                {creating ? "…" : "Create"}
              </button>
              <button type="button" onClick={() => { setShowCreate(false); setNewName(""); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20 transition-colors">
                Cancel
              </button>
            </form>
          ) : (
            <>
              {/* Logs button — visible to all users */}
              <button
                onClick={() => navigate(`/workspace/${slug}/run-logs`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Logs
              </button>

              {/* Management controls — admin/manager only */}
              {canManage && (
                <>
                  {/* Import dropdown */}
                  <div className="relative" ref={importMenuRef}>
                    <button
                      onClick={() => setShowImportMenu(v => !v)}
                      disabled={importing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                    >
                      {importing ? <Spinner /> : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      )}
                      Import
                      <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showImportMenu && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20">
                        {/* Select Files */}
                        <button
                          onClick={() => { setShowImportMenu(false); fileInputRef.current?.click(); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="text-left">
                            <div>Select Files</div>
                            <div className="text-[10px] text-gray-400">.json / .yaml / .yml / .md</div>
                          </div>
                        </button>

                        {/* Select Folder */}
                        <button
                          onClick={handleImportFolder}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                          </svg>
                          Select Folder
                        </button>

                        {/* Import ZIP */}
                        <button
                          onClick={() => { setShowImportMenu(false); zipInputRef.current?.click(); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          Import ZIP
                        </button>

                        <div className="my-1 border-t border-gray-100" />

                        {/* Import Templates */}
                        <button
                          onClick={() => { setShowImportMenu(false); setShowTemplates(true); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-indigo/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                          </svg>
                          <span className="text-indigo font-medium">Templates</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Hidden file inputs */}
                  <input ref={fileInputRef} type="file" multiple accept=".json,.yaml,.yml,.md" className="hidden" onChange={handleImportFiles} />
                  <input ref={zipInputRef}  type="file" accept=".zip"                       className="hidden" onChange={handleImportZip} />

                  <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo text-white hover:bg-indigo/90 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Project
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
            <svg className="w-16 h-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm">No projects yet.</p>
            {canManage && <p className="text-xs">Import a SKILL.md project or create a new one.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => editingId !== project.id && navigate(`/workspace/${slug}/projects/${project.id}`)}
                className={`group bg-white border rounded-xl p-5 cursor-pointer transition-all flex flex-col ${
                  runningProjectIds.has(project.id)
                    ? "border-emerald-400 shadow-lg shadow-emerald-100 ring-2 ring-emerald-300 ring-offset-1"
                    : "border-gray-200 hover:border-indigo/40 hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-2 flex-1">
                  <div className="flex-1 min-w-0">
                    {canManage && editingId === project.id ? (
                      <input
                        ref={editInputRef}
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={() => commitRename(project)}
                        onKeyDown={e => {
                          if (e.key === "Enter")  { e.preventDefault(); commitRename(project); }
                          if (e.key === "Escape") { e.stopPropagation(); setEditingId(null); }
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-full text-sm font-semibold border border-indigo/40 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-indigo/30"
                      />
                    ) : (
                      <>
                        <h3 className="font-semibold text-gray-800 truncate group-hover:text-indigo transition-colors">
                          {project.name}
                        </h3>
                        {(() => {
                          try {
                            const v = JSON.parse(project.manifest || "{}").version;
                            return v ? <span className="text-[10px] text-gray-400">v{v}</span> : null;
                          } catch { return null; }
                        })()}
                      </>
                    )}
                    {/* Description — skip generic placeholders */}
                    <div className="min-h-[2.5rem] mt-1">
                      {editingId !== project.id && (() => {
                        const raw = project.description ||
                          (() => { try { return JSON.parse(project.manifest || "{}").description || ""; } catch { return ""; } })();
                        const PLACEHOLDERS = ["describe what this project does", "describe what this skill does", "describe what this agent does"];
                        const desc = PLACEHOLDERS.includes((raw || "").toLowerCase().trim()) ? "" : raw;
                        return desc ? <p className="text-xs text-gray-500 line-clamp-2">{desc}</p> : null;
                      })()}
                    </div>
                  </div>

                  {/* Action buttons — admin/manager only */}
                  {canManage && (
                    <div className="grid grid-cols-3 gap-0.5 shrink-0">
                      {/* Download */}
                      <button
                        onClick={e => downloadProject(e, project)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-indigo transition-all"
                        title="Download as ZIP"
                        disabled={downloading === project.id}
                      >
                        {downloading === project.id
                          ? <div className="w-3.5 h-3.5 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        }
                      </button>
                      {/* Copy */}
                      <button
                        onClick={e => copyProject(e, project)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-indigo transition-all"
                        title="Duplicate"
                        disabled={copying === project.id}
                      >
                        {copying === project.id
                          ? <div className="w-3.5 h-3.5 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        }
                      </button>
                      {/* Rename */}
                      <button
                        onClick={e => startEdit(e, project)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-indigo transition-all"
                        title="Rename"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {/* Delete */}
                      <button
                        onClick={e => deleteProject(e, project)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 transition-all col-span-2"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-auto pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {pluralize(project._count?.agents ?? 0, "skill")}
                  </span>
                  {project._count?.runs > 0 && (
                    <span className="text-xs text-gray-400">
                      {pluralize(project._count.runs, "run")}
                    </span>
                  )}
                  <div className="flex-1" />
                  {runningProjectIds.has(project.id) ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] font-semibold text-emerald-600">Running…</span>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setRunModal(project); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-200"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Run
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manifest editor */}
      {editManifest && (
        <ManifestDialog
          project={editManifest}
          workspaceId={workspace.id}
          onSave={updated => {
            let name = updated.name;
            let description = updated.description;
            try {
              const m = JSON.parse(updated.manifest || "{}");
              if (m.name) name = m.name;
              if (m.description !== undefined) description = m.description || null;
            } catch {}
            setProjects(ps => ps.map(p => p.id === updated.id
              ? { ...p, name, description, manifest: updated.manifest }
              : p
            ));
            setEditManifest(null);
          }}
          onClose={() => setEditManifest(null)}
        />
      )}

      {/* Templates dialog */}
      {showTemplates && (
        <TemplatesDialog
          onImport={handleImportTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* Run modal */}
      {runModal && (
        <RunModal
          project={runModal}
          slug={slug}
          onClose={() => !runningProjectIds.has(runModal.id) && setRunModal(null)}
          onRunStart={handleRunStart}
          onRunEnd={id => { handleRunEnd(id); setProjects(ps => ps.map(p => p.id === id ? { ...p, _count: { ...p._count, runs: (p._count?.runs ?? 0) + 1 } } : p)); }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Project"
          message={`"${confirmDelete.name}" and all its skills will be permanently removed.`}
          confirmLabel="Delete"
          confirmText={confirmDelete.name}
          variant="danger"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => !deleting && setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
