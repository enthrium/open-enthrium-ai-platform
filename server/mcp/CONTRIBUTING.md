# Contributing to Open Enthrium AI MCP Server

## Adding a Connector Adapter

Connector adapters live in the platform repo — contributions there work across MCP, Platform, and Runtime automatically.

→ **[open-enthrium-ai-platform](https://github.com/enthrium/open-enthrium-ai-platform/blob/main/CONTRIBUTING.md)**

---

## Adding a Sample Config

Sample `oe-mcp.json` configs are the main contribution to this repo. Each sample shows how to connect a real system via OE MCP.

### Step 1 — Create your sample folder

```
server/mcp/samples/your-connector/
└── oe-mcp.json    ← config with placeholder credentials + setup comments
```

### Step 2 — Test it locally

```bash
# stdio mode (Claude Code / VS Code)
node server/mcp/index.js --stdio server/mcp/samples/your-connector/oe-mcp.json

# HTTP serve mode (Cursor / Windsurf)
node server/mcp/index.js --serve server/mcp/samples/your-connector/oe-mcp.json
```

### Step 3 — Open a PR

Include the connector name and what the sample connects to.

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

Output: `server/mcp/dist/`

---

## Guidelines

- Never commit real credentials — use placeholders in `oe-mcp.json`
- Include setup instructions as comments in the YAML
- Test both transport modes before opening a PR
- Open an issue first if you're unsure whether a sample fits
