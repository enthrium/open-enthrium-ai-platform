#!/usr/bin/env node
"use strict";

const fs           = require("fs");
const path         = require("path");
const yaml         = require("js-yaml");
const express      = require("express");
const cors         = require("cors");
const { randomUUID } = require("crypto");

const { ADAPTERS } = require("../src/utils/tools/registry");
const restApi      = require("../src/utils/tools/adapters/rest-api");

// ── persistent memory ──────────────────────────────────────────────────────

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

// ── arg parsing ────────────────────────────────────────────────────────────

function usage() {
  console.log(`
 oe-mcp — Open Enthrium MCP Server

 Usage:
   oe-mcp [config] [--port <port>]

 Options:
   --port <port>    Port to listen on (default: 4040)
   --stdio          Run in stdio mode (for Claude Code / Claude Desktop)
   --help, -h       Show this help

 Config format (oe-mcp.json):
   {
     "connectors": [
       {
         "name": "sales-db",
         "type": "mysql",
         "host": "db.company.com",
         "port": 3306,
         "database": "sales",
         "user": "admin",
         "password": "secret"
       }
     ]
   }
`);
  process.exit(0);
}

function parseArgs(args) {
  const result = { config: "oe-mcp.json", port: null, stdio: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help" || args[i] === "-h")  usage();
    else if (args[i] === "--stdio")                { result.stdio = true; }
    else if (args[i] === "--port" && args[i + 1]) { result.port = parseInt(args[++i]); }
    else if (!args[i].startsWith("--"))            { result.config = args[i]; }
  }
  return result;
}

// ── connector prep ─────────────────────────────────────────────────────────

function prepareConnectors(connectors) {
  return (connectors || []).map((c, i) => {
    const { name, type, ...creds } = c;
    return {
      id:         i + 1,
      name:       name || `connector-${i + 1}`,
      type,
      status:     "active",
      authConfig: JSON.stringify(creds),
      config:     JSON.stringify(creds),
      ...creds,
    };
  });
}

// ── tool building ──────────────────────────────────────────────────────────

const MEMORY_TOOLS = [
  {
    name:        "memory_set",
    description: "Save a value to persistent memory. Survives server restarts.",
    inputSchema: {
      type: "object",
      properties: {
        key:   { type: "string" },
        value: { type: "string" },
      },
      required: ["key", "value"],
    },
  },
  {
    name:        "memory_get",
    description: "Retrieve a value from persistent memory by key.",
    inputSchema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] },
  },
  {
    name:        "memory_delete",
    description: "Delete a key from persistent memory.",
    inputSchema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] },
  },
  {
    name:        "memory_list",
    description: "List all keys stored in persistent memory.",
    inputSchema: { type: "object", properties: {} },
  },
];

function buildTools(connectors) {
  const toolList = [];
  const toolMap  = {};

  for (const connector of connectors) {
    const adapter = ADAPTERS[connector.type] || restApi;
    const defs    = adapter.getAnthropicToolDefinitions(connector);
    for (const def of defs) {
      const match  = def.name.match(/^conn_\d+_(.+)$/);
      const action = match ? match[1] : def.name;
      toolMap[def.name] = { adapter, action, connector };
      toolList.push({
        name:        def.name,
        description: def.description,
        inputSchema: def.input_schema || { type: "object", properties: {} },
      });
    }
  }

  toolList.push(...MEMORY_TOOLS);
  return { toolList, toolMap };
}

function handleMemoryTool(name, args, store) {
  switch (name) {
    case "memory_set":
      store[args.key] = args.value;
      saveMemoryFile(store);
      return `Saved: ${args.key} = "${args.value}"`;
    case "memory_get": {
      const val = store[args.key];
      return val !== undefined ? val : `Key "${args.key}" not found in memory.`;
    }
    case "memory_delete":
      if (args.key in store) {
        delete store[args.key];
        saveMemoryFile(store);
        return `Deleted: ${args.key}`;
      }
      return `Key "${args.key}" not found.`;
    case "memory_list": {
      const keys = Object.keys(store);
      return keys.length === 0 ? "Memory is empty." : keys.map(k => `${k}: ${store[k]}`).join("\n");
    }
    default:
      return `Unknown memory tool: ${name}`;
  }
}

async function callTool(toolName, args, toolMap, store) {
  if (toolName.startsWith("memory_")) {
    return handleMemoryTool(toolName, args || {}, store);
  }
  const entry = toolMap[toolName];
  if (!entry) return `Unknown tool: ${toolName}`;
  const result = await entry.adapter.executeTool(entry.action, args || {}, entry.connector, null);
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
}

// ── stdio MCP transport (no SDK dependency) ────────────────────────────────

function writeMsg(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function startStdio(toolList, toolMap, store) {
  let buf = "";

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      handleStdioMsg(msg, toolList, toolMap, store);
    }
  });

  process.stdin.resume();
}

function handleStdioMsg(msg, toolList, toolMap, store) {
  if (msg.id === undefined || msg.id === null) return;

  const respond = (result) => writeMsg({ jsonrpc: "2.0", id: msg.id, result });
  const error   = (code, message) => writeMsg({ jsonrpc: "2.0", id: msg.id, error: { code, message } });

  switch (msg.method) {
    case "initialize":
      respond({
        protocolVersion: "2024-11-05",
        capabilities:    { tools: {}, resources: {} },
        serverInfo:      { name: "oe-mcp", version: "1.0.0" },
      });
      break;

    case "tools/list":
      respond({ tools: toolList });
      break;

    case "tools/call": {
      const { name, arguments: args } = msg.params || {};
      callTool(name, args, toolMap, store)
        .then(text => respond({ content: [{ type: "text", text: String(text) }] }))
        .catch(err => respond({ content: [{ type: "text", text: `Error: ${err.message}` }], isError: true }));
      break;
    }

    case "resources/list": {
      const resources = Object.keys(store).map(key => ({
        uri:      `memory://${key}`,
        name:     key,
        mimeType: "text/plain",
      }));
      respond({ resources });
      break;
    }

    case "resources/read": {
      const uri = msg.params?.uri || "";
      const key = uri.replace("memory://", "");
      const text = store[key] !== undefined ? String(store[key]) : `Memory key "${key}" not found.`;
      respond({ contents: [{ uri, mimeType: "text/plain", text }] });
      break;
    }

    default:
      error(-32601, `Method not found: ${msg.method}`);
  }
}

// ── HTTP server ────────────────────────────────────────────────────────────

function startHttp(port, name, toolList, toolMap, store) {
  const app      = express();
  const sessions = {};

  app.use(cors());
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId || !sessions[sessionId]) {
      const sid = randomUUID();
      sessions[sid] = true;
      res.setHeader("mcp-session-id", sid);
    }
    const msg = req.body;
    if (!msg.id) { res.status(202).end(); return; }
    try {
      const result = await handleHttpMsg(msg, toolList, toolMap, store);
      res.json({ jsonrpc: "2.0", id: msg.id, result });
    } catch (err) {
      res.json({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: err.message } });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", name, tools: toolList.length, sessions: Object.keys(sessions).length });
  });

  app.listen(port, () => {
    console.log(`\n┌─────────────────────────────────────────┐`);
    console.log(`│  ${name.padEnd(39)}│`);
    console.log(`├─────────────────────────────────────────┤`);
    console.log(`│  MCP endpoint : http://localhost:${port}/mcp  │`);
    console.log(`│  Health check : http://localhost:${port}/health│`);
    console.log(`├─────────────────────────────────────────┤`);
    console.log(`│  Tools      : ${String(toolList.length).padEnd(26)}│`);
    console.log(`└─────────────────────────────────────────┘\n`);
  });
}

async function handleHttpMsg(msg, toolList, toolMap, store) {
  switch (msg.method) {
    case "initialize":
      return {
        protocolVersion: "2024-11-05",
        capabilities:    { tools: {}, resources: {} },
        serverInfo:      { name: "oe-mcp", version: "1.0.0" },
      };
    case "tools/list":
      return { tools: toolList };
    case "tools/call": {
      const { name, arguments: args } = msg.params || {};
      const text = await callTool(name, args, toolMap, store);
      return { content: [{ type: "text", text: String(text) }] };
    }
    default:
      throw new Error(`Method not found: ${msg.method}`);
  }
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const { config: configFile, port: cliPort, stdio } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(configFile)) {
    console.error(`\nError: config file not found: ${configFile}`);
    console.error(`Run with --help for format.\n`);
    process.exit(1);
  }

  MEMORY_FILE = path.join(path.dirname(path.resolve(configFile)), "oe-mcp-memory.json");

  const raw        = fs.readFileSync(configFile, "utf8");
  const ext        = path.extname(configFile).toLowerCase();
  const config     = (ext === ".yaml" || ext === ".yml") ? yaml.load(raw) : JSON.parse(raw);
  const connectors = prepareConnectors(config.connectors);
  const port       = cliPort || config.server?.port || 4040;
  const name       = config.server?.name || "OE MCP";

  const store = {};
  for (const m of (config.memory || [])) store[m.key] = m.value;
  Object.assign(store, loadMemoryFile());

  const { toolList, toolMap } = buildTools(connectors);

  if (stdio) {
    startStdio(toolList, toolMap, store);
    return;
  }

  startHttp(port, name, toolList, toolMap, store);
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
