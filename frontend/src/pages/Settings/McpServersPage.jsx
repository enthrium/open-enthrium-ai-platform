import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import ConfirmDialog from "../../components/ConfirmDialog";
import { Modal, Spinner, EmptyState, ErrorBanner } from "../../components/ui";

function StatusDot({ enabled }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${enabled ? "bg-green-500" : "bg-gray-400"}`} />
      {enabled ? "Active" : "Inactive"}
    </span>
  );
}

function ServerForm({ initial = {}, onSave, onCancel, saving, isDefault }) {
  const [name,   setName]   = useState(initial.name   || "");
  const [url,    setUrl]    = useState(initial.url    || "");
  const [apiKey, setApiKey] = useState(initial.apiKey || "");

  function submit(e) {
    e.preventDefault();
    onSave({ name, url, apiKey });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input className="input w-full" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Customer Data MCP" required />
      </div>
      {!isDefault && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input className="input w-full font-mono text-sm" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://mcp.example.com" required type="url" />
            <p className="text-xs text-gray-400 mt-1">HTTP endpoint of the MCP server (must expose <code className="bg-gray-100 px-1 rounded">/mcp</code>)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input w-full font-mono text-sm" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="Bearer token sent as Authorization header" autoComplete="off" />
          </div>
        </>
      )}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1 py-2">{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

const CONNECTOR_CONFIG_PLACEHOLDER = `{
  "connectors": [
    {
      "name": "my-database",
      "type": "postgresql",
      "host": "localhost",
      "port": 5432,
      "database": "mydb",
      "user": "postgres",
      "password": "secret"
    }
  ]
}`;

function ConnectorConfigModal({ server, onSave, onClose, saving }) {
  const [value, setValue] = useState(
    server.connectorConfig
      ? JSON.stringify(JSON.parse(server.connectorConfig), null, 2)
      : ""
  );
  const [jsonError, setJsonError] = useState("");

  function validate(v) {
    if (!v.trim()) { setJsonError(""); return; }
    try { JSON.parse(v); setJsonError(""); }
    catch (e) { setJsonError(e.message); }
  }

  function handleChange(e) {
    setValue(e.target.value);
    validate(e.target.value);
  }

  function submit(e) {
    e.preventDefault();
    if (jsonError) return;
    onSave(value.trim() || null);
  }

  return (
    <Modal title="Configure Built-in MCP Connectors" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-gray-500">
          Define which data sources the built-in OE MCP server can access. Config is applied immediately to the running MCP server.{" "}
          <a href="https://www.openenthrium.com/mcp" target="_blank" rel="noopener noreferrer" className="text-indigo hover:underline">
            View all connector types →
          </a>
        </p>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Connector Config (JSON)</label>
            {jsonError && <span className="text-xs text-red-500">{jsonError}</span>}
          </div>
          <textarea
            className="w-full font-mono text-xs bg-gray-900 text-gray-100 rounded-lg p-4 border border-gray-700 focus:outline-none focus:border-indigo resize-y"
            rows={16}
            value={value}
            onChange={handleChange}
            placeholder={CONNECTOR_CONFIG_PLACEHOLDER}
            spellCheck={false}
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2">Cancel</button>
          <button type="submit" disabled={saving || !!jsonError} className="btn-primary flex-1 py-2">
            {saving ? "Saving…" : "Save Config"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function McpServersPage() {
  const { user } = useAuth();
  if (user && user.role !== "admin") return <Navigate to="/workspaces" replace />;

  const [servers,          setServers]          = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState("");
  const [showAdd,          setShowAdd]          = useState(false);
  const [editingServer,    setEditingServer]    = useState(null);
  const [configuringServer,setConfiguringServer]= useState(null);
  const [saving,           setSaving]           = useState(false);
  const [configSaving,     setConfigSaving]     = useState(false);
  const [toDelete,         setToDelete]         = useState(null);
  const [deleteLoading,    setDeleteLoading]    = useState(false);
  const [togglingId,       setTogglingId]       = useState(null);

  useEffect(() => { fetchServers(); }, []);

  async function fetchServers() {
    try {
      const { data } = await api.get("/admin/mcp-servers");
      setServers(data.servers);
    } catch { setError("Failed to load MCP servers"); }
    finally { setLoading(false); }
  }

  async function handleAdd({ name, url, apiKey }) {
    setSaving(true);
    try {
      const { data } = await api.post("/admin/mcp-servers", { name, url, apiKey });
      setServers(s => [...s, data.server]);
      setShowAdd(false);
    } catch (e) { setError(e.response?.data?.error || "Failed to add server"); }
    finally { setSaving(false); }
  }

  async function handleEdit({ name, url, apiKey }) {
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/mcp-servers/${editingServer.id}`, { name, url, apiKey });
      setServers(s => s.map(sv => sv.id === editingServer.id ? data.server : sv));
      setEditingServer(null);
    } catch (e) { setError(e.response?.data?.error || "Failed to update server"); }
    finally { setSaving(false); }
  }

  async function handleToggle(srv) {
    setTogglingId(srv.id);
    try {
      const { data } = await api.put(`/admin/mcp-servers/${srv.id}`, { enabled: !srv.enabled });
      setServers(s => s.map(sv => sv.id === srv.id ? data.server : sv));
    } catch (e) { setError(e.response?.data?.error || "Failed to update server"); }
    finally { setTogglingId(null); }
  }

  async function handleSaveConfig(connectorConfig) {
    setConfigSaving(true);
    try {
      const { data } = await api.put(`/admin/mcp-servers/${configuringServer.id}`, { connectorConfig });
      setServers(s => s.map(sv => sv.id === configuringServer.id ? data.server : sv));
      setConfiguringServer(null);
    } catch (e) { setError(e.response?.data?.error || "Failed to save config"); }
    finally { setConfigSaving(false); }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await api.delete(`/admin/mcp-servers/${toDelete.id}`);
      setServers(s => s.filter(sv => sv.id !== toDelete.id));
      setToDelete(null);
    } catch (e) { setError(e.response?.data?.error || "Failed to delete server"); }
    finally { setDeleteLoading(false); }
  }

  return (
    <div>
      {error && <ErrorBanner message={error} onClose={() => setError("")} />}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">MCP Servers</h2>
            <p className="text-gray-500 text-sm mt-0.5">Configure HTTP MCP servers the AI can use for tool calls</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary px-4 py-2 text-sm">+ Add Server</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : servers.length === 0 ? (
          <EmptyState message="No MCP servers configured." action={() => setShowAdd(true)} actionLabel="Add a server →" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">URL</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Auth</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {servers.map(srv => (
                <tr key={srv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{srv.name}</span>
                      {srv.isDefault && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo/10 text-indigo">Built-in</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{srv.url}</code>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {srv.apiKey ? <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium">API Key set</span> : <span className="text-xs text-gray-400">None</span>}
                  </td>
                  <td className="px-6 py-4"><StatusDot enabled={srv.enabled} /></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-3">
                      {/* Play / Stop toggle icon */}
                      <button
                        onClick={() => handleToggle(srv)}
                        disabled={togglingId === srv.id}
                        title={srv.enabled ? "Stop" : "Start"}
                        className="p-1 rounded transition-colors disabled:opacity-40"
                      >
                        {togglingId === srv.id ? (
                          <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                        ) : srv.enabled ? (
                          /* Stop — red square */
                          <svg className="w-5 h-5 text-red-500 hover:text-red-700" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="5" y="5" width="14" height="14" rx="2"/>
                          </svg>
                        ) : (
                          /* Play — green triangle */
                          <svg className="w-5 h-5 text-green-500 hover:text-green-700" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 4l14 8-14 8V4z"/>
                          </svg>
                        )}
                      </button>
                      {srv.isDefault ? (
                        /* Built-in server: only Configure (sets connector JSON) */
                        <>
                          <span className="text-gray-300">|</span>
                          <button onClick={() => setConfiguringServer(srv)} className="text-xs font-medium text-indigo hover:text-indigo/80 transition-colors">Configure</button>
                        </>
                      ) : (
                        /* External servers: Edit (name/url/key) + Delete */
                        <>
                          <span className="text-gray-300">|</span>
                          <button onClick={() => setEditingServer(srv)} className="text-xs font-medium text-indigo hover:text-indigo/80 transition-colors">Edit</button>
                          <span className="text-gray-300">|</span>
                          <button onClick={() => setToDelete(srv)} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <Modal title="Add MCP Server" onClose={() => setShowAdd(false)}>
          <ServerForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} />
        </Modal>
      )}

      {editingServer && (
        <Modal title={`Edit — ${editingServer.name}`} onClose={() => setEditingServer(null)}>
          <ServerForm
            initial={editingServer}
            isDefault={editingServer.isDefault}
            onSave={handleEdit}
            onCancel={() => setEditingServer(null)}
            saving={saving}
          />
        </Modal>
      )}

      {configuringServer && (
        <ConnectorConfigModal
          server={configuringServer}
          onSave={handleSaveConfig}
          onClose={() => setConfiguringServer(null)}
          saving={configSaving}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete MCP Server"
          message="Remove MCP server"
          detail={toDelete.name}
          confirmLabel="Delete"
          variant="danger"
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => !deleteLoading && setToDelete(null)}
        />
      )}
    </div>
  );
}
