# OE MCP Server · `@openenthrium/oe-mcp`

**Connect Claude Code, Cursor, Windsurf, Codex, Claude Desktop, and VS Code to enterprise data sources — databases, APIs, files, SSH, messaging, and more. One binary. One JSON config.**

[![npm](https://img.shields.io/npm/v/@openenthrium/oe-mcp?color=0284c7)](https://www.npmjs.com/package/@openenthrium/oe-mcp)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-4f46e5.svg)](https://github.com/enthrium/open-enthrium-ai-mcp-server/blob/main/LICENSE)
[![Website](https://img.shields.io/badge/Website-openenthrium.com-4f46e5)](https://www.openenthrium.com)

---

## Quick Start

**1. Create `oe-mcp.json`:**

```json
{
  "connectors": [
    { "name": "my-postgres",  "type": "postgresql",  "host": "localhost", "port": 5432, "database": "mydb", "user": "postgres", "password": "secret" },
    { "name": "my-github",    "type": "github",      "repoUrl": "https://github.com/your-org/your-repo", "personalAccessToken": "ghp_xxxxxxxxxxxx" },
    { "name": "my-slack",     "type": "slack",       "botToken": "xoxb-xxxxxxxxxxxx" },
    { "name": "my-codebase",  "type": "filesystem",  "basePath": "/home/user/projects/myapp" },
    { "name": "my-api",       "type": "rest-api",    "baseUrl": "https://api.company.com", "headers": { "Authorization": "Bearer xxxx" } }
  ],
  "memory": [
    { "key": "team", "value": "Platform Engineering" }
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

## Built-in Tools

### Memory — persists across sessions

| Tool | Description |
|---|---|
| `memory_set` | Store a key-value pair |
| `memory_get` | Retrieve a stored value |
| `memory_list` | List all stored pairs |
| `memory_delete` | Remove a stored key |

### Action Log — every connector call recorded

| Tool | Description |
|---|---|
| `log_list` | List recent connector calls (supports `limit`) |
| `log_clear` | Clear all log entries |

### Run AI Agents — no terminal required

Execute OE Runtime SKILL.md agents or YAML agents directly from Claude Code, Cursor, or any MCP client:

| Tool | Description |
|---|---|
| `run_agent` | Run an agent by file path — auto skills execute immediately; manual skills pause with `pending_skill_chain` |
| `list_pending_skills` | List all manual skills currently paused and waiting for approval |
| `approve_chain` | Approve, skip, or abort a paused manual skill by `chain_id` |

**`approve_chain` parameters:**

| Parameter | Description |
|---|---|
| `chain_id` | From `pending_skill_chain.chain_id` in a `run_agent` response |
| `approved` | `true` to run the skill (default), `false` to skip and continue |
| `abort` | `true` to stop the entire pipeline immediately |

**Example:** Tell Claude Code — _"Run the OE Skills orchestrator. Approve the hello-world skill, skip email, abort if anything asks for credentials."_ Claude handles the full approval loop using `run_agent` and `approve_chain`.

---

## Transport Modes

| Mode | Flag | Best for |
|---|---|---|
| **stdio** | `--stdio` | Claude Code, Cursor, Windsurf, Codex, Claude Desktop |
| **HTTP** | `--serve --port 4040` | Cloud deployments, team sharing |

---

## Supported Connectors

`postgresql` · `mysql` · `mongodb` · `redis` · `elasticsearch` · `s3` · `gdrive` · `github` · `slack` · `gmail` · `smtp` · `ssh` · `filesystem` · `rest-api` · `graphql` · `jira` · `hubspot` · `kafka` · `mqtt` · `notion` · `confluence` · `salesforce` · `telegram` · and 20+ more

---

## Part of Open Enthrium

| | |
|---|---|
| ⚡ **Agent Runtime** | [open-enthrium-ai-agent-runtime](https://github.com/enthrium/open-enthrium-ai-agent-runtime) — run SKILL.md agents as CLI or HTTP server |
| 🖥️ **Platform** | [open-enthrium-ai-platform](https://github.com/enthrium/open-enthrium-ai-platform) — full web app with workspaces, RAG, Agent Builder |
| 🌐 **Website** | [openenthrium.com](https://www.openenthrium.com) |

---

## License

[Apache-2.0](https://github.com/enthrium/open-enthrium-ai-mcp-server/blob/main/LICENSE) — free to use, modify, and deploy for any purpose, including commercial use.
No usage limits. No telemetry. No call-home.
