# OE MCP Server · `@openenthrium/oe-mcp`

**Connect Claude Code, Cursor, Windsurf, Codex, Claude Desktop, and VS Code to enterprise data sources — databases, APIs, files, SSH, messaging, and more. One binary. One JSON config.**

[![npm](https://img.shields.io/npm/v/@openenthrium/oe-mcp?color=0284c7)](https://www.npmjs.com/package/@openenthrium/oe-mcp)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-4f46e5.svg)](https://github.com/enthrium/open-enthrium-ai-mcp-server/blob/main/LICENSE)
[![Website](https://img.shields.io/badge/Website-openenthrium.com-4f46e5)](https://www.openenthrium.com/mcp.html)
[![Discord](https://img.shields.io/badge/Discord-Community-5865F2?logo=discord&logoColor=white)](https://discord.com/invite/vWsZ24Msn)

---

## What is OE MCP Server?

OE MCP Server is a standalone binary that implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) and exposes your enterprise data sources as tools that AI apps can use directly.

Connect Claude Code, Cursor, Windsurf, Codex, Claude Desktop, or VS Code to your PostgreSQL database, local filesystem, GitHub, Slack, Google Drive, SSH servers, and more — without writing any integration code.

- **No code.** Define connectors in a single JSON file.
- **45+ connector categories.** Enterprise systems supported out of the box.
- **Two transport modes.** `--stdio` for Claude Code, Cursor, Windsurf, Codex, and Claude Desktop (launched as a child process); `--serve` for cloud deployments or sharing one server across a team.
- **Persistent memory.** Built-in `memory_set / memory_get / memory_list / memory_delete` tools — context survives across sessions.
- **Self-hosted.** Runs on your own machine. No cloud dependency. Own your data.

---

## Quick Start

**1. Create your config file** (`oe-mcp.json`)

```json
{
  "connectors": [
    { "name": "my-postgres", "type": "postgresql",    "host": "localhost", "port": 5432, "database": "mydb", "user": "postgres", "password": "secret" },
    { "name": "my-mysql",    "type": "mysql",         "host": "localhost", "port": 3306, "database": "mydb", "user": "root",     "password": "secret" },
    { "name": "my-mongo",    "type": "mongodb",       "uri": "mongodb://localhost:27017", "database": "mydb" },
    { "name": "my-redis",    "type": "redis",         "host": "localhost", "port": 6379 },
    { "name": "my-s3",       "type": "s3",            "accessKeyId": "AKIAXXXXXXXX", "secretAccessKey": "xxxxxxxxxxxx", "region": "us-east-1", "bucket": "my-bucket" },
    { "name": "my-gdrive",   "type": "gdrive",        "clientId": "xxxx.apps.googleusercontent.com", "clientSecret": "xxxx", "refreshToken": "xxxx" },
    { "name": "my-github",   "type": "github",        "repoUrl": "https://github.com/your-org/your-repo", "personalAccessToken": "ghp_xxxxxxxxxxxx" },
    { "name": "my-slack",    "type": "slack",         "botToken": "xoxb-xxxxxxxxxxxx" },
    { "name": "my-gmail",    "type": "gmail",         "clientId": "xxxx.apps.googleusercontent.com", "clientSecret": "xxxx", "refreshToken": "xxxx" },
    { "name": "my-email",    "type": "smtp",          "host": "smtp.company.com", "port": 587, "user": "you@company.com", "password": "secret" },
    { "name": "my-server",   "type": "ssh",           "host": "server.company.com", "port": 22, "username": "ubuntu", "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT\n-----END OPENSSH PRIVATE KEY-----" },
    { "name": "my-codebase", "type": "filesystem",   "basePath": "/home/user/projects/myapp" },
    { "name": "my-api",      "type": "rest-api",      "baseUrl": "https://api.company.com", "headers": { "Authorization": "Bearer xxxx" } },
    { "name": "my-jira",     "type": "jira",          "host": "https://company.atlassian.net", "email": "you@company.com", "apiToken": "xxxx" },
    { "name": "my-hubspot",  "type": "hubspot",       "accessToken": "pat-xxxxxxxxxxxx" },
    { "name": "my-kafka",    "type": "kafka",         "brokers": ["localhost:9092"] },
    { "name": "my-elastic",  "type": "elasticsearch", "node": "https://localhost:9200", "apiKey": "xxxxxxxxxxxx" }
  ],
  "memory": [
    { "key": "team",        "value": "Platform Engineering" },
    { "key": "environment", "value": "production" }
  ]
}
```

**2. Add to your AI app's MCP config** (Claude Code, Cursor, Windsurf, Codex, Claude Desktop, VS Code)

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

> **Note:** `-y` skips npx's install confirmation prompt — without it, npx blocks waiting for keyboard input and the MCP connection never opens.

**3. Reload your AI app** — your connectors appear as tools automatically.

---

## Test Your Connection and Memory

### Test Connectors

Once connected, ask Claude in plain language:

> **"What connectors do you have access to?"**

Claude will list every connected tool with its available actions. Example response:

| Connector | Tools |
|---|---|
| **my-postgres** | `query` |
| **my-github** | `list_files`, `read_file`, `create_issue`, `get_issue`, `search_issues` |
| **my-slack** | `list_channels`, `post_message`, `search_messages` |
| **my-codebase** | `list_dir`, `read_file`, `write_file`, `search_files` |

You can also run `/mcp` in Claude Code to see the server status and total tool count.

### Test Memory

OE MCP has built-in persistent memory that survives restarts. Use plain language or direct tool calls:

**Save a memory:**
> _"Remember that our production database host is prod-db.company.com"_

Claude calls `memory_set` with `key = main_db_host`, `value = prod-db.company.com`.

**Retrieve a memory:**
> _"What is our production database host?"_

Claude calls `memory_get` with `key = main_db_host` and returns the stored value.

**List all memories:**
> _"What do you remember about our project?"_

Claude calls `memory_list` and returns all stored key-value pairs.

**Delete a memory:**
> _"Forget the production database host."_

Claude calls `memory_delete` with `key = main_db_host` to remove it.

Memory is stored in `oe-mcp-memory.json` next to your `oe-mcp.json` and persists across sessions and restarts.

---

## Run YAML Agents (`run_agent`)

OE MCP can run [OE Runtime](https://github.com/enthrium/open-enthrium-ai-agent-runtime) YAML agents directly from Claude Code, Cursor, Windsurf, Codex, or any MCP-compatible AI app — no terminal required.

**Just ask Claude:**
> _"Run my database analyst agent at /home/user/agents/db-analyst/agent.yaml"_

Claude calls `run_agent`, which executes:
```
npx -y @openenthrium/oe-runtime agent.yaml --config oe-config.json
```

And returns the full agent output back to your AI app.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `file` | string | ✅ | Absolute path to the `agent.yaml` file |
| `params` | object | ❌ | Key-value pairs passed to the agent as `--param key=value` flags |

**Config auto-detection:** OE MCP looks for `oe-config.json` in the same directory as `agent.yaml`. If found, it uses that config. Otherwise it falls back to the `oe-mcp.json` config.

> **Requires OE Runtime.** The agent directory must have a valid `oe-config.json` with `llm` and `connectors` configured. See [OE Runtime](https://github.com/enthrium/open-enthrium-ai-agent-runtime) for agent authoring docs.

---

## Supported Connectors

**Connectors across 45+ categories:**

| Category | Examples |
|---|---|
| **SQL Databases** | PostgreSQL, MySQL, MSSQL, Oracle, SQLite, Snowflake, BigQuery, Redshift |
| **NoSQL / Cache** | MongoDB, Redis, Elasticsearch, DynamoDB, Cassandra |
| **Object Storage** | AWS S3, GCS, Azure Blob, MinIO, Cloudflare R2 |
| **Cloud Drives** | Google Drive, OneDrive, Dropbox, Box |
| **Filesystem** | Local directories — list, read, write, search |
| **Email** | Gmail, Outlook, Zoho Mail, SMTP |
| **Team Messaging** | Slack, Microsoft Teams, Discord, Telegram |
| **CRM** | HubSpot, Salesforce, Notion, Airtable |
| **Issue Tracking** | GitHub, Jira, GitLab, Linear |
| **REST API** | Any HTTP/REST endpoint |
| **SSH / SFTP** | Remote command execution, file transfer |
| **Message Queues** | Kafka, AWS SQS, Google Pub/Sub, RabbitMQ |
| **+ more** | LDAP, OCR, Image Generation, Healthcare, ERP, Web3, ... |

---

## Transport Modes

| Mode | Flag | Best for |
|---|---|---|
| **stdio** | `--stdio` | Claude Code, Cursor, Windsurf, Codex, Claude Desktop — binary launched as child process by the AI app |
| **HTTP** | `--serve --port 4040` | Cloud deployments, multiple developers sharing one server |

---

## Built-in Memory

Every session includes persistent memory tools:

| Tool | Description |
|---|---|
| `memory_set` | Store a key-value pair across sessions |
| `memory_get` | Retrieve a stored value |
| `memory_list` | List all stored pairs |
| `memory_delete` | Remove a stored key |

Memory is stored in `oe-mcp-memory.json` next to your `oe-mcp.json` and survives restarts.

## Built-in Action Log

Every connector tool call is automatically logged to `oe-mcp-log.json`:

| Tool | Description |
|---|---|
| `log_list` | List recent connector action log entries (newest first, supports `limit` param) |
| `log_clear` | Clear all entries from the action log |

**Example log entry:**
```json
{
  "ts": "2026-08-08T04:59:33.289Z",
  "connector": "my-postgres",
  "tool": "query",
  "input": { "sql": "SELECT * FROM users LIMIT 10" },
  "result": "ok"
}
```

---

## Links

- [Full Documentation](https://www.openenthrium.com/mcp.html)
- [GitHub Repository](https://github.com/enthrium/open-enthrium-ai-mcp-server)
- [Discord Community](https://discord.com/invite/vWsZ24Msn)
- [OE Platform](https://www.openenthrium.com/platform.html) — full web app with Agent Builder, RAG, workspaces

---

## License

[Apache-2.0](https://github.com/enthrium/open-enthrium-ai-mcp-server/blob/main/LICENSE) — free to use, modify, and deploy for any purpose including commercial use.
