# Contributing to Open Enterprise

Thank you for your interest in contributing. This document explains the codebase structure, connector architecture, what is actually tested, and what kinds of contributions get accepted.

## Before You Start

Open an issue first before writing code. This lets us align on whether the change fits the project direction before you invest time building it. PRs that arrive without a prior discussion may be closed even if the code is good.

---

## Repo Structure

```
open-enterprise-community/
├── server/                         # Express API, Prisma, agent engine, connectors
│   ├── src/
│   │   ├── index.js                # Server entry point
│   │   ├── routes/                 # API route handlers
│   │   ├── middleware/             # Auth, rate limiting
│   │   ├── engine/                 # Agent execution engine
│   │   ├── data/
│   │   │   └── connectionTypes.json  # 2,654 connector catalog entries
│   │   └── utils/tools/
│   │       ├── registry.js         # Maps connector type IDs → adapters
│   │       └── adapters/           # 34 working adapter implementations
│   ├── scripts/                    # Seed scripts and build utilities
│   ├── cli/
│   │   ├── index.js                # oe-runtime CLI entry point
│   │   ├── server.js               # oe-runtime HTTP server mode
│   │   └── samples/                # 21 sample agents (one per capability)
│   └── prisma/                     # Database schema
├── frontend/                       # React + Vite + Tailwind
│   └── src/
│       ├── App.jsx                 # Route definitions
│       ├── pages/                  # Page components
│       ├── components/             # Shared UI components
│       └── commercial-stub/        # Empty stub — replaced by commercial overlay
├── processor/                      # Document ingestion microservice
├── Dockerfile
├── entrypoint.sh
└── commercial/                     # NOT in this repo (gitignored)
                                    # Commercial edition overlay — private
```

**Note:** The `commercial/` folder is gitignored. It is part of the private commercial edition and is never committed here. Do not attempt to add it.

---

## Connector Architecture

There are three distinct layers — understanding them is essential before contributing a connector.

### Layer 1 — Catalog (`server/src/data/connectionTypes.json`)

**2,654 entries.** This is the UI display list — every connector type that appears in the Connectors screen with its name, color, category, and icon initial. Adding an entry here makes a connector *visible* in the UI. It does not make it functional.

### Layer 2 — Registry (`server/src/utils/tools/registry.js`)

**~75 explicitly registered types.** The registry maps a connector type ID (e.g. `"postgresql"`, `"slack"`, `"kafka"`) to an adapter. Any type not in the registry falls back to the `rest-api` adapter automatically — meaning it will work with any REST API as long as the user provides a `baseUrl` and auth credentials in their config.

### Layer 3 — Adapters (`server/src/utils/tools/adapters/`)

**34 adapter files.** Each adapter implements `getToolDefinitions()`, `getAnthropicToolDefinitions()`, and `executeTool()`. These are the actual working implementations.

| Adapter file | Covers |
|---|---|
| `database.js` | PostgreSQL, MySQL, MSSQL, Oracle, SQLite, Snowflake, BigQuery, and 15+ compatible variants |
| `rest-api.js` | Universal HTTP — GET/POST/PUT/PATCH/DELETE, all auth types, binary responses; **default fallback for any unregistered type** |
| `mongodb.js` | MongoDB CRUD + aggregation |
| `redis.js` | Redis get/set/list/pub-sub |
| `elasticsearch.js` | Elasticsearch search + index |
| `kafka.js` | Kafka, RabbitMQ, SQS, Pub/Sub, Service Bus |
| `mqtt.js` | MQTT, AWS IoT, HiveMQ |
| `ssh.js` | SSH command execution |
| `sftp.js` | SFTP + FTP file operations |
| `s3.js` | AWS S3, GCS, Azure Blob, MinIO, R2, Wasabi, Backblaze |
| `ldap.js` | LDAP, Active Directory, Azure AD, OpenLDAP |
| `graphql.js` | GraphQL queries + mutations |
| `web3.js` | Ethereum, Polygon, Solana and 8 other chains |
| `mcp-client.js` | MCP protocol servers |
| `slack.js` | Slack Web API |
| `github.js` | GitHub REST API |
| `gmail.js` | Gmail IMAP/SMTP |
| `gdrive.js` | Google Drive SDK |
| `onedrive.js` | OneDrive + SharePoint |
| `dropbox.js` | Dropbox API |
| `box.js` | Box API |
| `jira.js` | Jira Cloud REST API |
| `confluence.js` | Confluence REST API |
| `notion.js` | Notion API |
| `hubspot.js` | HubSpot CRM API |
| `freshdesk.js` | Freshdesk API |
| `zendesk.js` | Zendesk Support API |
| `zoho-mail.js` | Zoho Mail API |
| `image-gen.js` | Image generation (OpenAI, FLUX, Stable Diffusion) |
| `ocr.js` | OCR (Azure Vision, Google Vision, Textract) |
| `speech.js` | TTS/STT (ElevenLabs, OpenAI TTS, Azure Speech) |
| `video-gen.js` | Video generation (Runway, Kling, Pika) |
| `music-gen.js` | Music generation (Udio, kie.ai) |
| `search.js` | Web search (Perplexity, Google, Bing) |

### What "tested" means

Of the 2,654 catalog entries, **21 connector workflows have been tested end-to-end** via the sample agents in `server/cli/samples/`. Each sample is a real agent that was run against a live API:

`sql-databases` · `nosql-cache` · `file-storage` · `email` · `cloud-drives` · `ssh` · `rest-api` · `graphql` · `web-search` · `blockchain-web3` · `directory-identity` · `iot-messaging` · `message-queues` · `image-generation` · `ocr-vision` · `speech-audio` · `video-generation` · `music-generation` · `productivity-crm` · `team-messaging` · `telegram`

All remaining catalog entries either:
- Fall back to `rest-api.js` (works for any standard HTTP API with correct `baseUrl` + auth in config)
- Have a registered adapter but have not been run against a live service in CI

There is no automated test suite for connectors. Contributions that add a sample agent for an untested type are highly valued.

---

## What Gets Accepted

**Likely accepted:**
- New adapter files for connector types currently falling back to `rest-api.js`
- Sample agents (`server/cli/samples/<name>/agent.yaml` + `oe-config.json`) for real-world workflows
- Registry entries that map catalog types to an existing adapter
- Bug fixes with a clear reproduction case
- Documentation corrections and clarity improvements
- Performance fixes with measurable impact

**Unlikely accepted:**
- Large architectural changes without prior discussion
- New features that belong in the commercial edition
- Dependencies that significantly increase bundle size
- Opinionated refactors that don't fix a real problem
- Changes to `server/src/data/connectionTypes.json` without a corresponding adapter or registry entry

---

## Adding a New Adapter

1. Create `server/src/utils/tools/adapters/<name>.js`
2. Implement three exports: `getToolDefinitions(connector)`, `getAnthropicToolDefinitions(connector)`, `executeTool(action, args, connector, db)`
3. Register the type IDs in `server/src/utils/tools/registry.js`
4. Add a sample agent in `server/cli/samples/<name>/` with a working `agent.yaml` and a redacted `oe-config.json`
5. Run `yarn workspace @open-enterprise/server generate:postman` to regenerate the Postman collection

Look at `server/src/utils/tools/adapters/slack.js` for a simple SaaS adapter example, or `server/src/utils/tools/adapters/database.js` for a multi-dialect example.

---

## How to Submit a PR

1. Fork the repo and create a branch from `main`
2. Name your branch descriptively: `fix/connector-timeout`, `feat/slack-connector`, `docs/docker-setup`
3. Keep PRs focused — one fix or feature per PR
4. Fill in the PR template completely
5. All PRs require at least one approval from a maintainer before merging

---

## Code Standards

- Match the style of the surrounding code
- No commented-out code
- No `console.log` left in production paths
- If you add a new dependency, explain why an existing one couldn't work

---

## Reporting Bugs

Use the Bug Report issue template. Include:
- What you did
- What you expected
- What actually happened
- Your environment (OS, Docker version, LLM provider)

---

## Security Issues

Do **not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md).

---

## Questions

Open a GitHub Discussion rather than an issue if you have a question about how something works or whether an idea is worth pursuing.
