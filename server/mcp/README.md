<div align="center">

<h1>Open Enthrium AI MCP Server</h1>
<h3>Enterprise MCP Server · Apache-2.0 · Claude Code · Cursor · Windsurf · Codex · Claude Desktop · VS Code</h3>

**Connect any AI coding assistant to your enterprise data — databases, files, APIs, and more — via a single binary.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-4f46e5.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/enthrium/open-enthrium-ai-mcp-server?color=4f46e5&label=latest)](https://github.com/enthrium/open-enthrium-ai-mcp-server/releases)
[![Windows](https://img.shields.io/badge/Windows-Download-0078D4?logo=windows&logoColor=white)](https://github.com/enthrium/open-enthrium-ai-mcp-server/releases/latest/download/oe-mcp-win.exe)
[![Linux](https://img.shields.io/badge/Linux-Download-E95420?logo=linux&logoColor=white)](https://github.com/enthrium/open-enthrium-ai-mcp-server/releases/latest/download/oe-mcp-linux)
[![macOS](https://img.shields.io/badge/macOS-Download-000000?logo=apple&logoColor=white)](https://github.com/enthrium/open-enthrium-ai-mcp-server/releases/latest/download/oe-mcp-macos)
[![npm](https://img.shields.io/npm/v/@openenthrium/oe-mcp?color=0284c7&label=npm)](https://www.npmjs.com/package/@openenthrium/oe-mcp)
[![Website](https://img.shields.io/badge/Website-openenthrium.com-4f46e5)](https://www.openenthrium.com)
[![Discord](https://img.shields.io/badge/Discord-Community-5865F2?logo=discord&logoColor=white)](https://discord.com/invite/vWsZ24Msn)

</div>

---

## What is OE MCP Server?

A standalone binary that implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) and exposes your enterprise data sources as tools that AI apps can use directly. No code. Define connectors in a single JSON file.

- **45+ connector categories** — PostgreSQL, MongoDB, S3, GitHub, Slack, Gmail, SSH, REST API, and more
- **Two transport modes** — `--stdio` for Claude Code / Cursor / Windsurf; `--serve` for cloud or team deployments
- **Persistent memory** — `memory_set / memory_get / memory_list / memory_delete` survive across sessions
- **Action log** — every connector call logged automatically with timestamp, tool, input, and result
- **Run AI agents** — `run_agent` executes any OE Runtime SKILL.md agent or YAML agent directly from Claude Code, Cursor, or any MCP client
- **Self-hosted** — runs on your own machine, no cloud dependency, no call-home

---

## Quick Start via npm (Recommended)

**1. Create `oe-mcp.json`:**

```json
{
  "connectors": [
    {
      "name": "my-postgres",
      "type": "postgresql",
      "host": "localhost",
      "port": 5432,
      "database": "mydb",
      "user": "postgres",
      "password": "secret"
    },
    {
      "name": "my-codebase",
      "type": "filesystem",
      "basePath": "/home/user/projects/myapp"
    }
  ],
  "memory": [
    { "key": "project_context", "value": "This is our main application." }
  ]
}
```

**2. Add to your AI app's MCP config:**

macOS / Linux:
```json
{
  "mcpServers": {
    "oe-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@openenthrium/oe-mcp", "--stdio", "/path/to/oe-mcp.json"]
    }
  }
}
```

Windows:
```json
{
  "mcpServers": {
    "oe-mcp": {
      "type": "stdio",
      "command": "npx.cmd",
      "args": ["-y", "@openenthrium/oe-mcp", "--stdio", "C:\\path\\to\\oe-mcp.json"]
    }
  }
}
```

> **`-y` is required** — without it npx blocks waiting for keyboard input and the MCP connection never opens.

**3. Reload your AI app** — connectors appear as tools automatically.

Ask Claude: _"What connectors do you have access to?"_ to verify.

---

## Download (Standalone Binary)

| Platform | Binary |
|---|---|
| **Windows** | [oe-mcp-win.exe](https://github.com/enthrium/open-enthrium-ai-mcp-server/releases/latest/download/oe-mcp-win.exe) |
| **Linux** | [oe-mcp-linux](https://github.com/enthrium/open-enthrium-ai-mcp-server/releases/latest/download/oe-mcp-linux) |
| **macOS** | [oe-mcp-macos](https://github.com/enthrium/open-enthrium-ai-mcp-server/releases/latest/download/oe-mcp-macos) |
| **Sample configs** | [oe-mcp-samples.zip](https://github.com/enthrium/open-enthrium-ai-mcp-server/releases/latest/download/oe-mcp-samples.zip) |

---

## Built-in Tools

### Memory

Persistent memory that survives restarts — stored in `oe-mcp-memory.json`:

| Tool | Description |
|---|---|
| `memory_set` | Store a key-value pair across sessions |
| `memory_get` | Retrieve a stored value by key |
| `memory_list` | List all stored key-value pairs |
| `memory_delete` | Remove a stored key |

> _"Remember that our production database is on prod-db.company.com"_ → Claude calls `memory_set`

### Action Log

Every connector call is logged automatically to `oe-mcp-log.json`:

| Tool | Description |
|---|---|
| `log_list` | List recent connector calls (newest first, supports `limit`) |
| `log_clear` | Clear all log entries |

### Run AI Agents

Execute OE Runtime SKILL.md agents or YAML agents directly from Claude Code, Cursor, or any MCP client — no terminal required:

| Tool | Description |
|---|---|
| `run_agent` | Run an agent by file path. Returns output + any pending chains. |
| `list_pending_chains` | List manual chains waiting for approval |
| `approve_chain` | Approve or reject a pending manual chain by `chain_id` |

**`run_agent` parameters:**

| Parameter | Required | Description |
|---|---|---|
| `file` | ✅ | Absolute path to `agent.yaml` |
| `params` | ❌ | Key-value pairs substituted via `{{key}}` in the agent |
| `input` | ❌ | Optional initial message passed to the agent |

OE MCP looks for `oe-config.json` in the agent's directory first, then falls back to `oe-mcp.json`.

---

## Transport Modes

| Mode | Flag | Best for |
|---|---|---|
| **stdio** | `--stdio` | Claude Code, Cursor, Windsurf, Codex, Claude Desktop — launched as child process |
| **HTTP** | `--serve --port 4040` | Cloud deployments, sharing one server across a team |

HTTP mode — start the server, then add the URL to Cursor / Windsurf / Claude Desktop:
```bash
oe-mcp-linux --serve --port 4040 /path/to/oe-mcp.json
# → http://your-server.com:4040/mcp
```

---

## Sample Configs

Download [oe-mcp-samples.zip](https://github.com/enthrium/open-enthrium-ai-mcp-server/releases/latest/download/oe-mcp-samples.zip) — ready-to-use `oe-mcp.json` for common connectors:

`postgres` · `mysql` · `mongodb` · `github` · `slack` · `gdrive` · `ssh` · `filesystem` · `oracle` · `salesforce` · `servicenow` · `telegram` · `notion` · `confluence` · `graphql` · `zoho-mail` · `sftp` · `dropbox` · `multi-connector`

---

## Part of Open Enthrium

| | |
|---|---|
| ⚡ **Agent Runtime** | [open-enthrium-ai-agent-runtime](https://github.com/enthrium/open-enthrium-ai-agent-runtime) — run SKILL.md agents as CLI or HTTP server |
| 🖥️ **Platform** | [open-enthrium-ai-platform](https://github.com/enthrium/open-enthrium-ai-platform) — full web app with workspaces, RAG, Agent Builder |
| 🌐 **Website** | [openenthrium.com](https://www.openenthrium.com) |

---

## Contributing

→ See **[CONTRIBUTING.md](CONTRIBUTING.md)** for how to add sample configs and connector adapters.

---

## License

[Apache-2.0](LICENSE) — free to use, modify, and deploy for any purpose, including commercial use.
No usage limits. No telemetry. No call-home.

---

<div align="center">

**[⭐ Star this repo](https://github.com/enthrium/open-enthrium-ai-mcp-server)** &nbsp;·&nbsp; **[🌐 Website](https://www.openenthrium.com)** &nbsp;·&nbsp; **[⚡ Agent Runtime](https://github.com/enthrium/open-enthrium-ai-agent-runtime)**

</div>
