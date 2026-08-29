# OE MCP — Claude Code Plugin

Connect Claude Code to your enterprise data — databases, files, APIs, SSH, messaging, and more.

[![npm](https://img.shields.io/npm/v/@openenthrium/oe-mcp?color=0284c7)](https://www.npmjs.com/package/@openenthrium/oe-mcp)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-4f46e5.svg)](https://github.com/enthrium/open-enthrium-ai-mcp-server/blob/main/LICENSE)

---

## Install

```
/plugin install @claude-community/oe-mcp
```

Or from the marketplace: **Customize → Plugins → Browse → OE MCP**.

---

## Setup

**1. Create `oe-mcp.json`** — define your connectors:

```json
{
  "connectors": [
    { "name": "my-db",       "type": "postgresql",  "host": "localhost", "port": 5432, "database": "mydb", "user": "postgres", "password": "secret" },
    { "name": "my-codebase", "type": "filesystem",  "basePath": "/home/user/projects" },
    { "name": "my-github",   "type": "github",      "repoUrl": "https://github.com/your-org/repo", "personalAccessToken": "ghp_xxxx" }
  ]
}
```

**2. Set the config path** — add to your shell profile (`~/.zshrc`, `~/.bashrc`, or Windows env vars):

```bash
export OE_MCP_CONFIG_PATH="/path/to/oe-mcp.json"
```

**3. Reload Claude Code** — your connectors appear as tools automatically.

**4. Verify** — ask Claude: _"What connectors do you have access to?"_

---

## Bundled Skills

| Skill | Trigger |
|---|---|
| `/oe-mcp:setup` | Help creating `oe-mcp.json` and configuring connectors |
| `/oe-mcp:query-data` | Query databases, files, APIs, and cloud storage |
| `/oe-mcp:run-agent` | Run OE Runtime SKILL.md agents directly from Claude Code |

Skills are also triggered automatically by Claude based on context — just ask naturally.

---

## Supported Connectors

`postgresql` · `mysql` · `mongodb` · `redis` · `elasticsearch` · `s3` · `gdrive` · `github` · `slack` · `gmail` · `smtp` · `ssh` · `filesystem` · `rest-api` · `graphql` · `jira` · `hubspot` · `kafka` · `notion` · `confluence` · `salesforce` · `telegram` · and 20+ more

---

## Links

- [Full Documentation](https://www.openenthrium.com)
- [GitHub](https://github.com/enthrium/open-enthrium-ai-mcp-server)
- [OE Runtime](https://github.com/enthrium/open-enthrium-ai-agent-runtime) — run SKILL.md agents as CLI or HTTP server

---

## License

[Apache-2.0](https://github.com/enthrium/open-enthrium-ai-mcp-server/blob/main/LICENSE)
