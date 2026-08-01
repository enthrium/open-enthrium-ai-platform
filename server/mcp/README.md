<div align="center">

<h1>Open Enterprise AI MCP Server</h1>
<h3>aka OE MCP · Enterprise MCP Server · Apache-2.0 · Claude Code · Cursor · Windsurf · Claude Desktop</h3>

**Connect any AI coding assistant to your enterprise data — databases, files, APIs, and more — via a single binary.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-4f46e5.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/openenterprise-info/open-enterprise-ai-mcp-server?color=4f46e5&label=latest)](https://github.com/openenterprise-info/open-enterprise-ai-mcp-server/releases)
[![Windows](https://img.shields.io/badge/Windows-Download-0078D4?logo=windows&logoColor=white)](https://github.com/openenterprise-info/open-enterprise-ai-mcp-server/releases/latest/download/oe-mcp-win.exe)
[![Linux](https://img.shields.io/badge/Linux-Download-E95420?logo=linux&logoColor=white)](https://github.com/openenterprise-info/open-enterprise-ai-mcp-server/releases/latest/download/oe-mcp-linux)
[![macOS](https://img.shields.io/badge/macOS-Download-000000?logo=apple&logoColor=white)](https://github.com/openenterprise-info/open-enterprise-ai-mcp-server/releases/latest/download/oe-mcp-macos)
[![npm](https://img.shields.io/npm/v/@openenterprise/oe-mcp?color=0284c7&label=npm)](https://www.npmjs.com/package/@openenterprise/oe-mcp)
[![Website](https://img.shields.io/badge/Website-openenterprise.info-4f46e5)](https://www.openenterprise.info)
[![Discord](https://img.shields.io/badge/Discord-Community-5865F2?logo=discord&logoColor=white)](https://discord.com/invite/vWsZ24Msn)

</div>

---

## What is OE MCP Server?

OE MCP Server is a standalone binary that implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) and exposes your enterprise data sources as tools that AI apps can use directly.

Connect Claude Code, Cursor, Windsurf, or Claude Desktop to your PostgreSQL database, local filesystem, GitHub, Slack, Google Drive, SSH servers, and more — without writing any integration code.

- **No code.** Define connectors in a single YAML file.
- **45+ connector categories.** 2,600+ enterprise systems supported out of the box.
- **Two transport modes.** `--stdio` for Claude Code VS Code / desktop apps; `--serve` for Cursor, Windsurf, and cloud deployments.
- **Persistent memory.** Built-in `memory_set / memory_get / memory_list / memory_delete` tools — context survives across sessions.
- **Self-hosted.** Runs on your own machine. No cloud dependency. Own your data.

---

## Quick Start via npm (Recommended)

No binary download needed — `npx` handles everything automatically:

**macOS / Linux:**
```json
{
  "mcpServers": {
    "oe-mcp": {
      "command": "npx",
      "args": ["@openenterprise/oe-mcp", "--stdio", "/path/to/oe-mcp.yaml"]
    }
  }
}
```

**Windows:** use `npx.cmd` instead of `npx`:
```json
{
  "mcpServers": {
    "oe-mcp": {
      "command": "npx.cmd",
      "args": ["@openenterprise/oe-mcp", "--stdio", "C:\\path\\to\\oe-mcp.yaml"]
    }
  }
}
```

Add this to `~/.mcp.json` (Claude Code) and reload VS Code. Done.

---

## Download (Standalone Binary)

Prefer a standalone binary? Download for your platform:

| Platform | Binary |
|---|---|
| **Windows** | [oe-mcp-win.exe](https://github.com/openenterprise-info/open-enterprise-ai-mcp-server/releases/latest/download/oe-mcp-win.exe) |
| **Linux** | [oe-mcp-linux](https://github.com/openenterprise-info/open-enterprise-ai-mcp-server/releases/latest/download/oe-mcp-linux) |
| **macOS** | [oe-mcp-macos](https://github.com/openenterprise-info/open-enterprise-ai-mcp-server/releases/latest/download/oe-mcp-macos) |
| **Sample configs** | [oe-mcp-samples.zip](https://github.com/openenterprise-info/open-enterprise-ai-mcp-server/releases/latest/download/oe-mcp-samples.zip) — ready-to-use `oe-mcp.yaml` for common connectors |

---

## Quick Start (Binary)

**1. Download the binary for your OS**

```bash
# Linux / macOS — make executable
chmod +x oe-mcp-linux
```

**2. Create your config file** (`oe-mcp.yaml`)

```yaml
connectors:
  - name: my-postgres
    type: postgresql
    host: localhost
    port: 5432
    database: mydb
    user: postgres
    password: secret

  - name: my-codebase
    type: filesystem
    basePath: /home/user/projects/myapp

memory:
  - key: project_context
    value: "This is our main application database."
```

**3. Connect your AI app** — see sections below for Claude Code, Cursor, and Windsurf.

---

## Claude Code (VS Code Extension)

**Option A — via npm (recommended, no binary download needed):**

macOS / Linux:
```json
{
  "mcpServers": {
    "oe-mcp": {
      "command": "npx",
      "args": ["@openenterprise/oe-mcp", "--stdio", "/path/to/oe-mcp.yaml"]
    }
  }
}
```

Windows:
```json
{
  "mcpServers": {
    "oe-mcp": {
      "command": "npx.cmd",
      "args": ["@openenterprise/oe-mcp", "--stdio", "C:\\path\\to\\oe-mcp.yaml"]
    }
  }
}
```

**Option B — via downloaded binary:**

```json
{
  "mcpServers": {
    "oe-mcp": {
      "type": "stdio",
      "command": "/path/to/oe-mcp-win.exe",
      "args": ["--stdio", "/path/to/oe-mcp.yaml"]
    }
  }
}
```

Reload VS Code — the MCP tools appear automatically in Claude Code.

---

## Cursor / Windsurf / Claude Desktop (HTTP mode)

Start the server manually, then point your AI app at the URL.

```bash
# Start the MCP server
oe-mcp-win.exe --serve --port 4040 oe-mcp.yaml
# OE MCP Server listening on http://localhost:4040/mcp
```

In Cursor settings → MCP → Add server:
```
http://localhost:4040/mcp
```

In Claude Desktop `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "oe-mcp": {
      "url": "http://localhost:4040/mcp"
    }
  }
}
```

---

## Cloud Deployment (MCP as a Service)

Deploy `oe-mcp-linux` to any cloud server — AWS EC2, fly.io, Railway, DigitalOcean — and multiple developers connect to it via URL. No binary needed on each developer machine.

```bash
# On your cloud server
./oe-mcp-linux --serve --port 4040 /etc/oe-mcp/oe-mcp.yaml
```

Each developer adds to their Cursor / Windsurf:
```
http://your-server.com:4040/mcp
```

---

## Config File Reference (`oe-mcp.yaml`)

```yaml
connectors:
  - name: <display-name>       # must be unique; shown as the tool prefix
    type: <connection-type>    # see Connector Catalog below
    # ... connector-specific credentials

memory:
  - key: <key>
    value: <value>             # seed defaults; overridden at runtime via memory_set
```

### Example — Multiple Connectors

```yaml
connectors:

  # ── SQL Databases ──────────────────────────────────────
  - name: my-postgres
    type: postgresql
    host: db.company.com
    port: 5432
    database: production
    user: readonly
    password: secret

  - name: my-mysql
    type: mysql
    host: localhost
    port: 3306
    database: mydb
    user: root
    password: secret

  # ── NoSQL ──────────────────────────────────────────────
  - name: my-mongo
    type: mongodb
    uri: mongodb://localhost:27017
    database: mydb

  - name: my-redis
    type: redis
    host: localhost
    port: 6379

  - name: my-elastic
    type: elasticsearch
    node: https://localhost:9200
    apiKey: xxxxxxxxxxxx

  # ── Object Storage ─────────────────────────────────────
  - name: my-s3
    type: s3
    accessKeyId: AKIAXXXXXXXX
    secretAccessKey: xxxxxxxxxxxx
    region: us-east-1
    bucket: my-bucket

  # ── Cloud Drives ───────────────────────────────────────
  - name: my-gdrive
    type: gdrive
    clientId: xxxx.apps.googleusercontent.com
    clientSecret: xxxx
    refreshToken: xxxx

  # ── Code & Issue Tracking ──────────────────────────────
  - name: my-github
    type: github
    token: ghp_xxxxxxxxxxxx

  - name: my-jira
    type: jira
    host: https://company.atlassian.net
    email: you@company.com
    apiToken: xxxx

  # ── Team Messaging ─────────────────────────────────────
  - name: my-slack
    type: slack
    botToken: xoxb-xxxxxxxxxxxx

  # ── Email ──────────────────────────────────────────────
  - name: my-gmail
    type: gmail
    clientId: xxxx.apps.googleusercontent.com
    clientSecret: xxxx
    refreshToken: xxxx

  - name: my-smtp
    type: smtp
    host: smtp.company.com
    port: 587
    user: you@company.com
    password: secret

  # ── SSH / Remote Server ────────────────────────────────
  - name: my-server
    type: ssh
    host: server.company.com
    port: 22
    username: ubuntu
    privateKey: /path/to/key.pem

  # ── Filesystem ─────────────────────────────────────────
  - name: my-codebase
    type: filesystem
    basePath: /home/user/projects

  # ── REST API ───────────────────────────────────────────
  - name: my-api
    type: rest-api
    baseUrl: https://api.company.com
    headers:
      Authorization: Bearer xxxx

  # ── CRM ────────────────────────────────────────────────
  - name: my-hubspot
    type: hubspot
    accessToken: pat-xxxxxxxxxxxx

  # ── Message Queues ─────────────────────────────────────
  - name: my-kafka
    type: kafka
    brokers:
      - localhost:9092

memory:
  - key: team
    value: "Platform Engineering"
  - key: environment
    value: "production"
```

---

## Built-in Tools

### Connector Tools

Each connector exposes a set of tools prefixed with the connector name. Examples:

| Connector | Tools |
|---|---|
| `postgresql` / `mysql` / `mongodb` | `query` — run SQL or aggregation queries |
| `filesystem` | `list_dir`, `read_file`, `write_file`, `append_file`, `delete_file`, `make_dir`, `file_info`, `search_files` |
| `github` | `list_repos`, `get_file`, `create_issue`, `list_issues`, `list_prs`, `get_pr`, `search_code` |
| `slack` | `list_channels`, `post_message`, `get_messages`, `get_thread` |
| `ssh` | `execute_command`, `upload_file`, `download_file`, `list_files` |
| `gdrive` | `list_files`, `get_file`, `create_file`, `update_file`, `search_files` |
| `rest-api` | `request` — any HTTP method against any endpoint |

### Memory Tools

Built-in memory tools available in every session:

| Tool | Description |
|---|---|
| `memory_set` | Store a key-value pair that persists across sessions |
| `memory_get` | Retrieve a stored value by key |
| `memory_list` | List all stored key-value pairs |
| `memory_delete` | Remove a stored key |

Memory is stored in `oe-mcp-memory.json` next to your `oe-mcp.yaml` and survives restarts.

**Example usage in Claude Code:**
> "Remember that our main database is on prod-db.company.com"
> → Claude calls `memory_set` with key `main_db_host` and value `prod-db.company.com`

---

## Connector Catalog

**2,600+ connectors across 45+ categories:**

| Category | Examples |
|---|---|
| **SQL Databases** | PostgreSQL, MySQL, MSSQL, Oracle, SQLite, Snowflake, BigQuery, Redshift |
| **NoSQL / Cache** | MongoDB, Redis, Elasticsearch, DynamoDB, Cassandra |
| **Object Storage** | AWS S3, GCS, Azure Blob, MinIO, Cloudflare R2 |
| **Cloud Drives** | Google Drive, OneDrive, Dropbox, Box |
| **Filesystem** | Local directories — list, read, write, search |
| **Email** | Gmail, Outlook, Zoho Mail, SMTP |
| **Team Messaging** | Slack, Microsoft Teams, Discord, Telegram |
| **CRM / Productivity** | HubSpot, Salesforce, Notion, Airtable |
| **Issue Tracking** | GitHub, Jira, GitLab, Linear |
| **REST API** | Any HTTP/REST endpoint |
| **GraphQL** | Any GraphQL endpoint |
| **SSH / SFTP** | Remote command execution, file transfer |
| **Message Queues** | Kafka, AWS SQS, Google Pub/Sub, RabbitMQ |
| **Search** | Perplexity, Google Search, Bing |
| **LDAP / Directory** | Active Directory, OpenLDAP |
| **OCR / Vision** | Azure Vision, Google Vision, AWS Textract |
| **Image Generation** | OpenAI, FLUX, Stable Diffusion |
| **Speech & Audio** | ElevenLabs, OpenAI TTS, Azure Speech |
| **Web3 / Blockchain** | Ethereum, Polygon, Solana |
| **Helpdesk** | Zendesk, Freshdesk, ServiceNow |
| **+ more** | Healthcare (FHIR), ERP (SAP), Marketing, Analytics, ... |

> **Binary vs Node.js mode**
>
> The standalone binary works for all connector categories **except** Oracle, MSSQL, SQLite, and Snowflake — these use native C++ addons that cannot be bundled into a single executable.
>
> If you need any of these four, run with Node.js instead:
> ```bash
> git clone https://github.com/openenterprise-info/open-enterprise-ai-mcp-server.git
> cd open-enterprise-ai-mcp-server/server
> yarn install
> # stdio mode (Claude Code)
> node mcp/index.js --stdio /path/to/oe-mcp.yaml
> # serve mode (Cursor, Windsurf, cloud)
> node mcp/index.js --serve --port 4040 /path/to/oe-mcp.yaml
> ```
> All other connectors (PostgreSQL, MySQL, MongoDB, Redis, S3, Slack, GitHub, REST API, SSH, filesystem, etc.) work directly with the binary — no Node.js required.

---

## Sample Configs

Download [oe-mcp-samples.zip](https://github.com/openenterprise-info/open-enterprise-ai-mcp-server/releases/latest/download/oe-mcp-samples.zip) for ready-to-use configs:

`postgres` · `mysql` · `mongodb` · `github` · `slack` · `gdrive` · `ssh` · `filesystem` · `oracle` · `multi-connector`

Each sample includes the complete `oe-mcp.yaml` with setup instructions in comments.

---

## Transport Modes

| Mode | Flag | Best for |
|---|---|---|
| **stdio** | `--stdio` | Claude Code VS Code extension, Claude Desktop — binary launched as child process automatically |
| **HTTP** | `--serve` | Cursor, Windsurf, cloud deployments, multiple developers sharing one server |

Both modes are supported in the same binary — just pass the appropriate flag.

---

## Part of Open Enterprise

OE MCP Server is part of the [Open Enterprise](https://openenterprise.info) platform.

| | |
|---|---|
| ⚡ **Agent Runtime** | [open-enterprise-ai-agent-runtime](https://github.com/openenterprise-info/open-enterprise-ai-agent-runtime) — run YAML agents as CLI or HTTP server |
| 🖥️ **Platform (Docker)** | [open-enterprise-ai-platform](https://github.com/openenterprise-info/open-enterprise-ai-platform) — full web app with workspaces, RAG, Agent Builder, DLP |
| 🌐 **Website** | [openenterprise.info](https://openenterprise.info) |

---

## License

[Apache-2.0](LICENSE) — free to use, modify, and deploy for any purpose, including commercial use.
No usage limits. No telemetry. No call-home.

---

<div align="center">

**[⭐ Star this repo](https://github.com/openenterprise-info/open-enterprise-ai-mcp-server)** &nbsp;·&nbsp; **[🌐 Website](https://www.openenterprise.info)** &nbsp;·&nbsp; **[⚡ Agent Runtime](https://github.com/openenterprise-info/open-enterprise-ai-agent-runtime)**

</div>
