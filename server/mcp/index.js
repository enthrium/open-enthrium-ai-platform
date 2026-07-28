#!/usr/bin/env node
"use strict";

const fs      = require("fs");
const path    = require("path");
const yaml    = require("js-yaml");
const express = require("express");
const cors    = require("cors");
const { randomUUID } = require("crypto");

const { Server }                        = require("@modelcontextprotocol/sdk/server/index.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { StdioServerTransport }          = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const { ADAPTERS } = require("../src/utils/tools/registry");
const restApi      = require("../src/utils/tools/adapters/rest-api");

// ── persistent memory ─────────────────────────────────────────────────────────

// Resolved after config file is known — see main()
let MEMORY_FILE = path.join(path.dirname(process.execPath), "oe-mcp-memory.json");

function loadMemoryFile() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    }
  } catch {}
  return {};
}

function saveMemoryFile(store) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2), "utf8");
}

// ── helpers ───────────────────────────────────────────────────────────────────

function usage() {
  console.log(`
oe-mcp — Open Enterprise MCP Server v1.0.0

Usage:
  oe-mcp [config] [--port <port>]

Options:
  --port <port>    Port to listen on (default: 4040)
  --help, -h       Show this help

Examples:
  oe-mcp
  oe-mcp oe-mcp.yaml
  oe-mcp oe-mcp.yaml --port 8080

Config format (oe-mcp.yaml):
  server:
    port: 4040
    name: "My Company MCP"

  connectors:
    - name: sales-db
      type: oracle
      host: oracle.company.com
      port: 1521
      service: ORCL
      user: admin
      password: secret

  memory:
    - key: company_context
      value: "ACME Corp. Sales DB is Oracle."
`);
  process.exit(0);
}

function parseArgs(args) {
  const result = { config: "oe-mcp.yaml", port: null, stdio: false, serve: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help" || args[i] === "-h")  usage();
    else if (args[i] === "--stdio")                { result.stdio = true; }
    else if (args[i] === "--serve")                { result.serve = true; }
    else if (args[i] === "--port" && args[i + 1]) { result.port = parseInt(args[++i]); }
    else if (!args[i].startsWith("--"))            { result.config = args[i]; }
  }
  return result;
}

function prepareConnectors(connectors) {
  return (connectors || []).map((c, i) => {
    const { name, type, ...creds } = c;
    return {
      id:         i + 1,
      name:       name || `connector-${i + 1}`,
      type:       type,
      status:     "active",
      authConfig: JSON.stringify(creds),
      config:     JSON.stringify(creds),
      ...creds,
    };
  });
}

// ── memory tools ──────────────────────────────────────────────────────────────

const MEMORY_TOOLS = [
  {
    name:        "memory_set",
    description: "Save a value to persistent memory. Survives server restarts.",
    inputSchema: {
      type: "object",
      properties: {
        key:   { type: "string", description: "Memory key (e.g. 'customer_name', 'db_schema')" },
        value: { type: "string", description: "Value to store" },
      },
      required: ["key", "value"],
    },
  },
  {
    name:        "memory_get",
    description: "Retrieve a value from persistent memory by key.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Memory key to retrieve" },
      },
      required: ["key"],
    },
  },
  {
    name:        "memory_delete",
    description: "Delete a key from persistent memory.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Memory key to delete" },
      },
      required: ["key"],
    },
  },
  {
    name:        "memory_list",
    description: "List all keys currently stored in persistent memory.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

function handleMemoryTool(name, args, store) {
  switch (name) {
    case "memory_set": {
      store[args.key] = args.value;
      saveMemoryFile(store);
      return `Saved: ${args.key} = "${args.value}"`;
    }
    case "memory_get": {
      const val = store[args.key];
      return val !== undefined ? val : `Key "${args.key}" not found in memory.`;
    }
    case "memory_delete": {
      if (args.key in store) {
        delete store[args.key];
        saveMemoryFile(store);
        return `Deleted: ${args.key}`;
      }
      return `Key "${args.key}" not found.`;
    }
    case "memory_list": {
      const keys = Object.keys(store);
      if (keys.length === 0) return "Memory is empty.";
      return keys.map(k => `${k}: ${store[k]}`).join("\n");
    }
    default:
      return `Unknown memory tool: ${name}`;
  }
}

// ── build one MCP Server instance (one per session) ──────────────────────────
// connectors and store are shared by reference across all sessions

function buildMcpServer(connectors, store) {
  const mcpTools = [];
  const toolMap  = {};

  for (const connector of connectors) {
    const adapter = ADAPTERS[connector.type] || restApi;
    const defs    = adapter.getAnthropicToolDefinitions(connector);
    for (const def of defs) {
      const match  = def.name.match(/^conn_\d+_(.+)$/);
      const action = match ? match[1] : def.name;
      toolMap[def.name] = { adapter, action, connector };
      mcpTools.push({
        name:        def.name,
        description: def.description,
        inputSchema: def.input_schema || { type: "object", properties: {} },
      });
    }
  }

  mcpTools.push(...MEMORY_TOOLS);

  const mcpResources = Object.entries(store).map(([key]) => ({
    uri:      `memory://${key}`,
    name:     key,
    mimeType: "text/plain",
  }));

  const server = new Server(
    { name: "oe-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name.startsWith("memory_")) {
      const result = handleMemoryTool(name, args || {}, store);
      return { content: [{ type: "text", text: result }] };
    }

    const entry = toolMap[name];
    if (!entry) return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    try {
      const result = await entry.adapter.executeTool(entry.action, args || {}, entry.connector, null);
      const text   = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: mcpResources }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const key     = uri.replace("memory://", "");
    return {
      contents: [{
        uri,
        mimeType: "text/plain",
        text: store[key] !== undefined ? String(store[key]) : `Memory key "${key}" not found.`,
      }],
    };
  });

  return { server, mcpTools };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { config: configFile, port: cliPort, stdio, serve } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(configFile)) {
    console.error(`\nError: config file not found: ${configFile}`);
    console.error(`Create an oe-mcp.yaml file or pass a path. Run with --help for format.\n`);
    process.exit(1);
  }

  // Memory file lives next to the config yaml (consistent in both modes)
  MEMORY_FILE = path.join(path.dirname(path.resolve(configFile)), "oe-mcp-memory.json");

  const config     = yaml.load(fs.readFileSync(configFile, "utf8"));
  const connectors = prepareConnectors(config.connectors);
  const yamlMemory = config.memory || [];
  const port       = cliPort || config.server?.port || 4040;
  const name       = config.server?.name || "OE MCP";

  // Build shared store: yaml seeds + persisted file (file wins on conflict)
  const store = {};
  for (const m of yamlMemory) store[m.key] = m.value;
  Object.assign(store, loadMemoryFile());

  // Pre-build tool list for health/logging (use a temp server)
  const { mcpTools } = buildMcpServer(connectors, store);
  const memoryKeys   = Object.keys(store);

  // ── stdio mode (for Claude Code / Claude Desktop) ─────────────────────────

  if (stdio) {
    const { server } = buildMcpServer(connectors, store);
    const transport  = new StdioServerTransport();
    await server.connect(transport);
    return;
  }

  // ── express HTTP server ───────────────────────────────────────────────────

  const app      = express();
  const sessions = {}; // sessionId → StreamableHTTPServerTransport

  app.use(cors());
  app.use(express.json());

  // POST /mcp — initialize new session or handle message in existing session
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];

    if (sessionId && sessions[sessionId]) {
      await sessions[sessionId].handleRequest(req, res, req.body);
      return;
    }

    // New session: create transport + fresh Server (shares connectors & store)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const { server } = buildMcpServer(connectors, store);
    await server.connect(transport);

    const sid = transport.sessionId;
    sessions[sid] = transport;
    transport.onclose = () => delete sessions[sid];

    await transport.handleRequest(req, res, req.body);
  });

  // GET /mcp — SSE stream for an existing session
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId || !sessions[sessionId]) {
      return res.status(400).json({ error: "Invalid or missing session ID" });
    }
    await sessions[sessionId].handleRequest(req, res);
  });

  // DELETE /mcp — close a session
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (sessionId && sessions[sessionId]) {
      await sessions[sessionId].close();
      delete sessions[sessionId];
    }
    res.status(200).json({ ok: true });
  });

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status:      "ok",
      name,
      tools:       mcpTools.length,
      connectors:  connectors.length,
      memory:      memoryKeys.length,
      sessions:    Object.keys(sessions).length,
      memoryFile:  MEMORY_FILE,
    });
  });

  app.listen(port, () => {
    console.log(`\n┌─────────────────────────────────────────┐`);
    console.log(`│  ${name.padEnd(39)}│`);
    console.log(`├─────────────────────────────────────────┤`);
    console.log(`│  MCP endpoint : http://localhost:${port}/mcp  │`);
    console.log(`│  Health check : http://localhost:${port}/health│`);
    console.log(`├─────────────────────────────────────────┤`);
    console.log(`│  Tools      : ${String(mcpTools.length).padEnd(26)}│`);
    console.log(`│  Connectors : ${String(connectors.length).padEnd(26)}│`);
    console.log(`│  Memory keys: ${String(memoryKeys.length).padEnd(26)}│`);
    console.log(`│  Memory file: oe-mcp-memory.json        │`);
    console.log(`└─────────────────────────────────────────┘\n`);
    if (memoryKeys.length > 0) {
      console.log(`  Loaded memory keys: ${memoryKeys.join(", ")}\n`);
    }
  });
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
