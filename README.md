<div align="center">

<h1>Open Enthrium AI Platform</h1>
<h3>Self-Hosted Web-Based AI Platform · Apache-2.0 · Open Source</h3>

**Run SKILL.md agents · Build an enterprise knowledge base with RAG · Private chat box on your own infrastructure.**
No code. No LangChain. No Python.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-4f46e5.svg)](LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/jumbocoder/open-enthrium-ai-platform?color=2496ED&logo=docker&logoColor=white)](https://hub.docker.com/r/jumbocoder/open-enthrium-ai-platform)
[![GitHub Release](https://img.shields.io/github/v/release/enthrium/open-enthrium-ai-platform?color=4f46e5&label=latest)](https://github.com/enthrium/open-enthrium-ai-platform/releases)
[![Website](https://img.shields.io/badge/Website-Open_Enthrium-4f46e5)](https://www.openenthrium.com)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-jumbocoder-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/jumbocoder/open-enthrium-ai-platform)

</div>

---

## What is Open Enthrium AI Platform?

A self-hosted, web-based open-source AI platform with three core capabilities:

- **SKILL.md agents** — run portable, declarative AI agents defined in Markdown. Drop a `SKILL.md` into any workspace; OE wires it to your connectors and executes it via the built-in runtime. The same skill runs unchanged on Claude, Cursor, Windsurf, or the CLI.
- **Enterprise knowledge base with RAG** — ingest documents (24+ formats), chunk and embed them into your chosen vector database, and retrieve with cited answers. All on your own infrastructure, no data leaving your network.
- **Private chat box** — a fully private AI assistant backed by your own LLM, your own knowledge base, and your own connectors. Embed it as a website widget or use it internally across workspaces.

**Self-hosted. No call-home. Own your data completely.**


---

## Quick Start

```bash
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -e JWT_SECRET=your-secret \
  -e SUPER_ADMIN_EMAIL=admin@yourdomain.com \
  -e SUPER_ADMIN_PASSWORD=your-password \
  -e LICENSE_TYPE=community \
  -v open-enthrium-data:/app/server/storage \
  jumbocoder/open-enthrium-ai-platform:latest
```

Open [http://localhost:3000](http://localhost:3000) and log in with your super admin credentials. Configure your LLM provider, embedding model, and vector database from the admin panel — no `.env` changes needed.

**Or run from source:**

> **Prerequisites:** Node.js v18+, Yarn v1.x

```bash
# 1. Clone the repo
git clone https://github.com/enthrium/open-enthrium-ai-platform.git
cd open-enthrium-ai-platform

# 2. Install dependencies
yarn install

# 3. Configure environment
cp server/.env.example server/.env
# Edit server/.env — required variables:
#   JWT_SECRET          — long random string (required)
#   SUPER_ADMIN_EMAIL   — first admin account email
#   SUPER_ADMIN_PASSWORD — first admin account password
#   LICENSE_TYPE        — "community" (default) or "commercial"
# Optional port overrides (defaults shown):
#   FRONTEND_PORT=3000
#   SERVER_PORT=3001
#   PROCESSOR_PORT=3002
#   MCP_PORT=3003

# 4. Set up the database (Prisma)
yarn workspace @open-enthrium/server db:push
yarn workspace @open-enthrium/server db:seed-masters

# 5. Start in development mode (server + processor + frontend)
yarn dev
```

---

## Connector Catalog

2,673 connectors across 45+ categories. Databases (PostgreSQL, MySQL, MongoDB, Snowflake, BigQuery), cloud storage (S3, GCS, Azure Blob), communication (Slack, Teams, Gmail, Telegram), developer tools (GitHub, Jira, Linear), CRM (HubSpot, Salesforce), AI media (DALL-E, ElevenLabs, Runway), IoT (MQTT, Kafka), blockchain (Ethereum, Polygon), and more.

All connectors are configurable from the admin panel — no `.env` changes, no code. The full catalog lives in [`server/src/data/connectionTypes.json`](server/src/data/connectionTypes.json).

---

## Contributing

Contributions are welcome. Before opening a PR:

1. **Open an issue** to discuss the change — especially for new features
2. **Fork** the repository and branch from `main`
3. **Test** your changes locally
4. **Open a PR** with a clear description of what and why

**Where contributions are most valuable:**
- New connector adapters ([`server/src/utils/tools/adapters/`](server/src/utils/tools/adapters/))
- New connector entries — add to [`server/src/data/connectionTypes.json`](server/src/data/connectionTypes.json) and re-run `yarn workspace @open-enthrium/server db:seed-masters`
- Agent SKILL.md examples for the community marketplace
- Bug fixes with clear reproduction steps

→ See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full guide.

---

## Community

| | |
|---|---|
| 🌐 Website | [Open Enthrium](https://www.openenthrium.com) |
| 🐳 Docker Hub | [hub.docker.com/r/jumbocoder/open-enthrium-ai-platform](https://hub.docker.com/r/jumbocoder/open-enthrium-ai-platform) |
| ⚡ OE Runtime | [open-enthrium-ai-agent-runtime](https://github.com/enthrium/open-enthrium-ai-agent-runtime) |
| 🔌 OE MCP | [open-enthrium-ai-mcp-server](https://github.com/enthrium/open-enthrium-ai-mcp-server) |
| 🐛 Issues | [github.com/enthrium/open-enthrium-ai-platform/issues](https://github.com/enthrium/open-enthrium-ai-platform/issues) |

---

## License

[Apache-2.0](LICENSE) — free to use, modify, and deploy for any purpose, including commercial use.
No usage limits. No telemetry. No call-home.

---

<div align="center">

**[⭐ Star this repo](https://github.com/enthrium/open-enthrium-ai-platform)** &nbsp;·&nbsp; **[🐳 Docker Hub](https://hub.docker.com/r/jumbocoder/open-enthrium-ai-platform)** &nbsp;·&nbsp; **[🌐 Website](https://www.openenthrium.com)**

</div>
