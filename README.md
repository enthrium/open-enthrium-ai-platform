<div align="center">

<h1>Open Enthrium</h1>
<h3>Open-Source AI Ecosystem · Apache-2.0 · Self-Hosted</h3>

**Build, deploy, and govern AI Agents, Assistants, RAG, MCP, Workspaces, and Enterprise Automation.**
No code. No LangChain. No Python. 2,673+ enterprise connectors.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-4f46e5.svg)](LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/openenterprise/open-enterprise-community?color=2496ED&logo=docker&logoColor=white)](https://hub.docker.com/r/openenterprise/open-enterprise-community)
[![GitHub Release](https://img.shields.io/github/v/release/enthrium/open-enthrium-ai-platform?color=4f46e5&label=latest)](https://github.com/enthrium/open-enthrium-ai-platform/releases)
[![Website](https://img.shields.io/badge/Website-Open_Enthrium-4f46e5)](https://www.openenthrium.com)
[![Discord](https://img.shields.io/badge/Discord-Community-5865F2?logo=discord&logoColor=white)](https://discord.com/invite/vWsZ24Msn)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-openenterprise-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/openenterprise/open-enterprise-community)

</div>

---

## What is Open Enthrium AI Platform?

A self-hosted, web-based open-source AI platform for building and running autonomous AI agents without writing code. Deploy it on your own infrastructure and connect to 2,673+ enterprise systems — databases, APIs, cloud storage, messaging, SSH, and IoT — without custom integration code.

- **No code.** Agents are declarative YAML files.
- **Self-hosted.** Deploy on your own infrastructure. Own your data completely. No call-home.
- **Human approval gates.** Build human-in-the-loop agentic workflows without writing code.
- **Enterprise-ready.** Multi-workspace, RAG, MCP, DLP governance, and 2,673 connectors out of the box.


---

## Quick Start

```bash
docker run -d \
  -p 3001:3001 \
  -e JWT_SECRET=your-secret \
  -e SUPER_ADMIN_EMAIL=admin@yourdomain.com \
  -e SUPER_ADMIN_PASSWORD=your-password \
  -v open-enthrium-data:/app/server/storage \
  openenterprise/open-enterprise-community:latest
```

Open [http://localhost:3001](http://localhost:3001) and log in with your super admin credentials. Configure your LLM provider, embedding model, and vector database from the admin panel — no `.env` changes needed.

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
# Edit server/.env — set JWT_SECRET, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD

# 4. Set up the database (Prisma)
yarn workspace @open-enthrium/server db:push
yarn workspace @open-enthrium/server db:seed-masters

# 5. Start in development mode (server + processor + frontend)
yarn dev
```

---

## Platform Capabilities

| Feature | Description |
|---|---|
| **AI Assistant / Chat** | SSE streaming chat with RAG, tool calling, @connector and @agent routing |
| **Workspaces** | Multi-tenant workspaces with per-workspace LLM, embedding, and vector DB overrides |
| **RBAC** | Role-based access control — admin, member, viewer per workspace |
| **Agent Builder** | Conversational YAML designer with visual flow and step validation |
| **Marketplace** | Browse and deploy community agent templates (Security, Sales, Marketing, DevOps, Analytics) |
| **Agent Chains** | Sequential agent execution with `always / on_success / on_critical / on_warning` conditions |
| **Cron Scheduling** | Schedule any agent on a cron expression |
| **RAG** | Document ingestion, chunking, embedding, vector upsert, cited retrieval |
| **8 Vector DBs** | LanceDB (default), Pinecone, Qdrant, Chroma, Weaviate, PgVector, Milvus, Zilliz |
| **MCP** | Connect to MCP servers — 25 catalog entries included |
| **Human Approval Gates** | Pause any workflow step for human review and approval |
| **DLP / Governance** | Block, warn, redact, and audit content policies *(Enterprise)* |
| **Observability** | Per-user / per-workspace token usage, cost dashboards, activity log *(Enterprise)* |
| **Connector Library** | Browse all 2,673 connectors by category with dynamic credential forms |

---

## Connector Catalog

**2,673 connectors across 45+ categories:**

| Category | Connectors |
|---|---|
| **Databases** | PostgreSQL, MySQL, MSSQL, Oracle, SQLite, Snowflake, BigQuery, Redshift, CockroachDB, TiDB, Supabase, PlanetScale |
| **NoSQL** | MongoDB, Redis, Elasticsearch, DynamoDB, Cassandra, Couchbase, FaunaDB |
| **Object Storage** | AWS S3, Google Cloud Storage, Azure Blob, MinIO, Cloudflare R2, Backblaze B2 |
| **Cloud Drives** | Google Drive, OneDrive, SharePoint, Dropbox, Box |
| **CRM** | HubSpot, Salesforce, Pipedrive, Zoho CRM, Freshsales |
| **Support** | Zendesk, Freshdesk, Intercom, ServiceNow, Help Scout |
| **Project Management** | Jira, Asana, Linear, Monday.com, Trello, ClickUp |
| **Developer Tools** | GitHub, GitLab, Bitbucket, CircleCI, Jenkins, Vercel |
| **Communication** | Slack, Microsoft Teams, Discord, Telegram, WhatsApp Business |
| **Email** | Gmail, Outlook, Zoho Mail, SMTP/IMAP, SendGrid, Mailchimp |
| **Finance** | Stripe, QuickBooks, Xero, Plaid, Square, Paddle |
| **HR** | BambooHR, Workday, ADP, Greenhouse, Lever |
| **E-commerce** | Shopify, WooCommerce, BigCommerce, Magento |
| **Image Generation** | OpenAI gpt-image-1, FLUX, Stable Diffusion, Ideogram |
| **Speech & Audio** | ElevenLabs, OpenAI TTS, Azure Speech, Google TTS |
| **Video Generation** | Runway, Kling, Pika |
| **Music Generation** | kie.ai, Udio |
| **Search** | Perplexity, Google Custom Search, Bing |
| **OCR / Vision** | Azure Vision, Google Vision, AWS Textract, Tesseract |
| **Message Queues** | Kafka, RabbitMQ, AWS SQS, Azure Service Bus, Google Pub/Sub |
| **IoT** | MQTT, AWS IoT, HiveMQ, Mosquitto |
| **Blockchain / Web3** | Ethereum, Polygon, Solana, Avalanche, Infura, Alchemy |
| **Directory** | LDAP, Active Directory, Azure AD, OpenLDAP |
| **Healthcare** | FHIR, Epic, Cerner |
| **ERP** | SAP, Oracle ERP, Microsoft Dynamics |
| **Marketing** | Google Ads, Facebook Ads, HubSpot Marketing, Marketo, ActiveCampaign |
| **Analytics** | Google Analytics, Mixpanel, Amplitude, Segment, PostHog |
| **+ 17 more** | Legal, Education, GIS, Logistics, Real Estate, Government, ... |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Yes | — | Signs and verifies login tokens. Keep the same value across restarts. |
| `SUPER_ADMIN_EMAIL` | Yes | — | Email for the super admin account |
| `SUPER_ADMIN_PASSWORD` | Yes | — | Password for the super admin account |
| `FRONTEND_PORT` | No | `3000` | Vite dev server port |
| `SERVER_PORT` | No | `3001` | API server port |
| `PROCESSOR_PORT` | No | `3002` | Document processor port |

All LLM, embedding, and vector database settings are configured from the admin panel — no `.env` changes needed after initial setup.

---

## Contributing

Contributions are welcome. Before opening a PR:

1. **Open an issue** to discuss the change — especially for new features
2. **Fork** the repository and branch from `main`
3. **Test** your changes locally
4. **Open a PR** with a clear description of what and why

**Where contributions are most valuable:**
- New connector adapters (`server/src/utils/tools/adapters/`)
- Agent YAML examples for the community marketplace
- Bug fixes with clear reproduction steps

---

## Community

| | |
|---|---|
| 🌐 Website | [Open Enthrium](https://www.openenthrium.com) |
| 🐳 Docker Hub | [hub.docker.com/r/openenterprise/open-enterprise-community](https://hub.docker.com/r/openenterprise/open-enterprise-community) |
| ⚡ OE Runtime | [open-enthrium-ai-agent-runtime](https://github.com/enthrium/open-enthrium-ai-agent-runtime) |
| 🔌 OE MCP | [open-enthrium-ai-mcp-server](https://github.com/enthrium/open-enthrium-ai-mcp-server) |
| 🐛 Issues | [github.com/enthrium/open-enthrium-ai-platform/issues](https://github.com/enthrium/open-enthrium-ai-platform/issues) |
| 💬 Discord | [discord.com/invite/vWsZ24Msn](https://discord.com/invite/vWsZ24Msn) |

---

## License

[Apache-2.0](LICENSE) — free to use, modify, and deploy for any purpose, including commercial use.
No usage limits. No telemetry. No call-home.

---

<div align="center">

**[⭐ Star this repo](https://github.com/enthrium/open-enthrium-ai-platform)** &nbsp;·&nbsp; **[🐳 Docker Hub](https://hub.docker.com/r/openenterprise/open-enterprise-community)** &nbsp;·&nbsp; **[🌐 Website](https://www.openenthrium.com)**

</div>
