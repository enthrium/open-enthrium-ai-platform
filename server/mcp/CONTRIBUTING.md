# Contributing to Open Enterprise AI MCP Server

Thank you for your interest in contributing. This document covers the repo structure, what belongs here vs the platform repo, and how to submit a contribution.

## Before You Start

Open an issue first before writing code. PRs without prior discussion may be closed even if the code is good.

---

## What Belongs Here vs the Platform Repo

This repo contains the **standalone MCP server binary** — the MCP protocol implementation, transport modes, memory tools, and sample configs.

| Contribution | Where it goes |
|---|---|
| New connector adapter (e.g. Salesforce, SAP) | [open-enterprise-community](https://github.com/openenterprise-info/open-enterprise-community) → `server/src/utils/tools/adapters/` |
| New sample `oe-mcp.yaml` config | **This repo** → `server/mcp/samples/<name>/` |
| Bug in MCP server, stdio/serve transport, memory tools | **This repo** → `server/mcp/index.js` |
| Bug in agent execution engine or adapters | [open-enterprise-community](https://github.com/openenterprise-info/open-enterprise-community) |
| Runtime binary or agent samples | [open-enterprise-ai-agent-runtime](https://github.com/openenterprise-info/open-enterprise-ai-agent-runtime) |

---

## Repo Structure

```
open-enterprise-ai-mcp-server/
├── server/
│   ├── mcp/
│   │   ├── index.js          # MCP server — stdio + HTTP serve modes, memory tools
│   │   ├── sea-config.json   # Node.js SEA build config
│   │   └── samples/          # Ready-to-use oe-mcp.yaml configs
│   │       └── <name>/
│   │           └── oe-mcp.yaml
│   ├── src/                  # Shared adapter source (synced from community)
│   │   └── utils/tools/
│   │       ├── registry.js
│   │       └── adapters/
│   ├── scripts/
│   │   └── inject-sea.js     # Node.js SEA binary build script
│   └── package.json
└── .github/
    └── workflows/
        └── release.yml       # Builds binaries + uploads samples on tag
```

---

## Adding a Sample Config

Sample `oe-mcp.yaml` configs are the most valuable contribution to this repo. Each sample shows how to connect a specific system via OE MCP.

1. Create a folder under `server/mcp/samples/<connector-name>/`
2. Add `oe-mcp.yaml` with realistic placeholder credentials
3. Include setup instructions as comments in the YAML
4. Test locally: `node server/mcp/index.js --stdio server/mcp/samples/<name>/oe-mcp.yaml`
5. Open a PR with the connector name and what it connects to

**Existing samples for reference:**
`postgres` · `mysql` · `mongodb` · `github` · `slack` · `gdrive` · `ssh` · `filesystem` · `oracle` · `multi-connector`

---

## Building the Binary Locally

Requires Node.js 22+.

```bash
cd server
yarn install
yarn build:mcp-win    # Windows
yarn build:mcp-linux  # Linux
yarn build:mcp-macos  # macOS
```

The binary is output to `server/mcp/dist/`.

---

## Transport Modes

The MCP server supports two transport modes — both implemented in `server/mcp/index.js`:

- **stdio** (`--stdio`) — Claude Code VS Code extension launches the binary as a child process
- **HTTP serve** (`--serve`) — Cursor, Windsurf, and cloud deployments connect via URL

Contributions that improve either transport or add new memory tool capabilities are welcome.

---

## How to Submit a PR

1. Fork the repo and create a branch from `main`
2. Name your branch: `feat/servicenow-sample`, `fix/stdio-encoding`, `docs/cursor-setup`
3. Keep PRs focused — one fix or feature per PR
4. All PRs require at least one approval before merging

---

## Code Standards

- Match the style of the surrounding code
- No commented-out code
- No `console.log` left in production paths

---

## Reporting Bugs

Include: what you did, what you expected, what happened, your OS, binary version, and AI app (Claude Code / Cursor / Windsurf).

---

## Security Issues

Do **not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md).
