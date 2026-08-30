#!/usr/bin/env node
"use strict";

const fs             = require("fs");
const path           = require("path");
const os             = require("os");
const yaml           = require("js-yaml");
const express        = require("express");
const cors           = require("cors");
const { randomUUID } = require("crypto");

const engine       = require("../src/engine");
const { ADAPTERS } = require("../src/utils/tools/registry");
const restApi      = require("../src/utils/tools/adapters/rest-api");

// ── persistent memory ──────────────────────────────────────────────────────

let MEMORY_FILE = path.join(path.dirname(process.execPath), "oe-mcp-memory.json");
let CONFIG_FILE = "oe-mcp.json";

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

// ── persistent log ─────────────────────────────────────────────────────────

let LOG_FILE = path.join(path.dirname(process.execPath), "oe-mcp-log.json");

function loadLogFile() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      return JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
    }
  } catch {}
  return [];
}

function appendLogEntry(entry) {
  const log = loadLogFile();
  log.push(entry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), "utf8");
}

// ── pending manual skills (in-memory) ──────────────────────────────────────
// chain_id → { remainingSkills, lastOutput, agentFile, configFile, depth }
const pendingChains = new Map();

function makeChainId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

// ── connector prep (for MCP connector tools) ───────────────────────────────

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

// ── config loader — tolerates literal newlines in private keys ────────────

function loadConfig(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  try { return JSON.parse(raw); } catch (_) {}
  let out = ""; let inStr = false; let esc = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (esc)                 { out += c; esc = false; continue; }
    if (c === "\\" && inStr) { out += c; esc = true;  continue; }
    if (c === '"')           { out += c; inStr = !inStr; continue; }
    if (inStr && c === "\r") continue;
    if (inStr && c === "\n") { out += "\\n"; continue; }
    out += c;
  }
  return JSON.parse(out);
}

// ── connector matching for agent runs ────────────────────────────────────

function matchConnectors(yamlConnectors, configConnectors) {
  let cfgArray;
  if (Array.isArray(configConnectors)) {
    cfgArray = configConnectors;
  } else if (configConnectors && typeof configConnectors === "object") {
    cfgArray = Object.entries(configConnectors).map(([name, cfg]) => ({
      connection_name: name, connection_type: cfg.type, ...cfg,
    }));
  } else {
    cfgArray = [];
  }

  return (yamlConnectors || []).map((yc, i) => {
    const ycName = yc.connection_name || yc.name;
    const ycType = yc.connection_type || yc.type;
    const cc = cfgArray.find(c => (c.connection_name || c.name) === ycName)
            || cfgArray.find(c => (c.connection_type || c.type) === ycType);
    if (!cc) return { id: i + 1, name: ycName, type: ycType, status: "active", authConfig: "{}", config: "{}" };
    const { connection_name, connection_type, name, type, ...creds } = cc;
    if (creds.privateKeyPath) {
      const keyPath = creds.privateKeyPath.replace(/^~/, os.homedir());
      creds.privateKey = fs.readFileSync(keyPath, "utf8").replace(/\r\n/g, "\n");
      delete creds.privateKeyPath;
    }
    if (creds.privateKey) creds.privateKey = creds.privateKey.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
    return {
      id:         i + 1,
      name:       connection_name || name || ycName,
      type:       connection_type || type || ycType,
      status:     "active",
      authConfig: JSON.stringify(creds),
      config:     JSON.stringify(creds),
    };
  });
}

// ── SKILL.md parser ────────────────────────────────────────────────────────

function parseSkillMd(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return null;
  const front = yaml.load(fmMatch[1]) || {};
  const body  = fmMatch[2].trim();
  const bodyLines  = body.split("\n");
  const stepStarts = [];
  bodyLines.forEach((line, i) => {
    if (/^##\s+Step\s+\d+/.test(line)) stepStarts.push(i);
  });
  if (stepStarts.length === 0) {
    return { name: front.name, description: front.description, instructions: body, steps: [{ name: "Run", content: body }] };
  }
  const steps = [];
  for (let s = 0; s < stepStarts.length; s++) {
    const header  = bodyLines[stepStarts[s]].replace(/^##\s+Step\s+\d+[:\s]*/, "").trim();
    const start   = stepStarts[s] + 1;
    const end     = s + 1 < stepStarts.length ? stepStarts[s + 1] : bodyLines.length;
    const content = bodyLines.slice(start, end).join("\n").trim();
    steps.push({ name: header, content });
  }
  const instrEnd = stepStarts[0];
  const instructions = bodyLines.slice(0, instrEnd).join("\n").trim();
  return { name: front.name, description: front.description, instructions, steps };
}

// ── skill runner ────────────────────────────────────────────────────────────

const MAX_SKILL_DEPTH = 5;

// pendingChains: chain_id → { remainingSkills, lastOutput, agentFile, configFile, depth }
// (reuses the existing pendingChains Map)

async function runSkillsMcp(skills, parentOutput, agentFile, configFile, depth) {
  if (!skills?.length || depth >= MAX_SKILL_DEPTH) {
    return { output: parentOutput || "", pending_skill_chain: null };
  }

  const config     = loadConfig(configFile);
  const parentYaml = agentFile ? (yaml.load(fs.readFileSync(agentFile, "utf8")) || {}) : {};
  const allConnectors = matchConnectors(parentYaml.connectors, config.connectors);

  let lastOutput = parentOutput || "";

  for (let i = 0; i < skills.length; i++) {
    const skill       = skills[i];
    const skillPath   = skill.path;
    const triggerType = (skill.trigger_type || skill.triggerType || "auto").toLowerCase();
    if (!skillPath) continue;

    const label = path.basename(skillPath);

    // Manual skill — pause and register pending
    if (triggerType === "manual") {
      const chainId = makeChainId();
      pendingChains.set(chainId, {
        remainingSkills: skills.slice(i),
        lastOutput,
        agentFile,
        configFile,
        depth,
      });
      return {
        output: lastOutput,
        pending_skill_chain: { chain_id: chainId, skill_name: label },
      };
    }

    // Auto skill — load SKILL.md and run it
    const resolved = skillPath.toLowerCase().endsWith(".md")
      ? skillPath
      : path.join(skillPath, "SKILL.md");
    const fullPath = agentFile
      ? path.join(path.dirname(agentFile), resolved)
      : resolved;

    if (!fs.existsSync(fullPath)) { console.warn(`⚠  SKILL.md not found: ${fullPath}`); continue; }

    const content   = fs.readFileSync(fullPath, "utf8");
    const skillSpec = parseSkillMd(content);
    if (!skillSpec) { console.warn(`⚠  Invalid SKILL.md: ${fullPath}`); continue; }

    // Skill-level connector scoping
    const connectorNames = skill.connectors;
    const connectors = Array.isArray(connectorNames)
      ? allConnectors.filter(c => connectorNames.includes(c.connection_name || c.name))
      : allConnectors;

    const contextInput = lastOutput
      ? `Context from previous step:\n\n${lastOutput}\n\nNow execute your task.`
      : "Execute your task as described.";

    const agentSpec = {
      systemPrompt: skillSpec.instructions || "",
      workflow:     skillSpec.steps        || [],
      params:       [],
      paramValues:  {},
      maxRounds:    25,
      input:        contextInput,
    };

    try {
      const { output } = await engine.run(agentSpec, config.llm, connectors, {
        onToolCall:   () => {},
        onToolResult: () => {},
        onError:      (err) => { throw err; },
      });
      lastOutput = output;
    } catch (err) {
      lastOutput = `Skill ${label} failed: ${err.message}`;
    }
  }

  return { output: lastOutput, pending_skill_chain: null };
}

// ── agent runner ────────────────────────────────────────────────────────────

async function runAgentMcp(agentFile, inputContext, params, configFile, depth = 0) {
  const agentYaml  = yaml.load(fs.readFileSync(agentFile, "utf8"));
  const config     = loadConfig(configFile);
  const connectors = matchConnectors(agentYaml.connectors, config.connectors);

  const agentSpec = {
    systemPrompt: agentYaml.systemPrompt || agentYaml.system_prompt || agentYaml.instructions || "",
    workflow:     agentYaml.steps        || agentYaml.workflow       || [],
    params:       agentYaml.params       || [],
    paramValues:  params || {},
    maxRounds:    agentYaml.maxRounds    || 25,
    input:        inputContext || null,
  };

  // Skip LLM call when no instructions or steps — go straight to skills
  const hasWork = (agentSpec.systemPrompt || "").trim() || agentSpec.workflow?.length;
  let output = typeof inputContext === "string" ? inputContext : "";

  if (hasWork) {
    const llmResult = await engine.run(agentSpec, config.llm, connectors, {
      onToolCall:   () => {},
      onToolResult: () => {},
      onError:      (err) => { throw err; },
    });
    output = llmResult.output;
  }

  const result = {
    agent:               agentYaml.name || path.basename(agentFile),
    output,
    pending_skill_chain: null,
  };

  if (agentYaml.skills?.length) {
    const skillResult = await runSkillsMcp(agentYaml.skills, output, agentFile, configFile, depth + 1);
    result.output = skillResult.output;
    if (skillResult.pending_skill_chain) {
      result.pending_skill_chain = skillResult.pending_skill_chain;
    }
  }

  return result;
}

function formatAgentResult(result) {
  const lines = [];
  lines.push(`Agent: ${result.agent}\n`);
  if (result.output) lines.push(result.output);

  if (result.pending_skill_chain) {
    lines.push(`\n${"─".repeat(40)}`);
    lines.push(`⏸  Skill awaiting approval`);
    lines.push(`  skill_name: ${result.pending_skill_chain.skill_name}`);
    lines.push(`  chain_id  : ${result.pending_skill_chain.chain_id}`);
    lines.push(`\n  → Call approve_chain with this chain_id to approve, skip, or abort.`);
  }

  return lines.join("\n");
}

// ── tool definitions ───────────────────────────────────────────────────────

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

const LOG_TOOLS = [
  {
    name:        "log_list",
    description: "List connector action log entries from oe-mcp-log.json. Most recent entries first.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max entries to return (default: 50)" },
      },
    },
  },
  {
    name:        "log_clear",
    description: "Clear all entries from the connector action log (oe-mcp-log.json).",
    inputSchema: { type: "object", properties: {} },
  },
];

const AGENT_TOOLS = [
  {
    name:        "run_agent",
    description: "Run an OE Runtime YAML agent from a file. Auto skills execute immediately. Manual skills pause and return a pending_skill_chain — use approve_chain to approve, skip, or abort.",
    inputSchema: {
      type: "object",
      properties: {
        file:   { type: "string",  description: "Absolute path to the agent.yaml file on disk" },
        params: { type: "object",  description: "Optional key-value params substituted into the agent prompt via {{key}}" },
        input:  { type: "string",  description: "Optional initial message or context passed to the agent" },
      },
      required: ["file"],
    },
  },
  {
    name:        "list_pending_skills",
    description: "List all manual skills currently paused and waiting for approval. Returns chain_id and skill_name for each.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name:        "approve_chain",
    description: "Approve, skip, or abort a paused manual skill. Get the chain_id from run_agent's pending_skill_chain. approved:true runs the skill; approved:false skips it and continues; abort:true stops the entire pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        chain_id: { type: "string",  description: "The chain_id from pending_skill_chain" },
        approved: { type: "boolean", description: "true to run the skill, false to skip it and continue" },
        abort:    { type: "boolean", description: "true to stop the entire pipeline immediately (overrides approved)" },
      },
      required: ["chain_id"],
    },
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
  toolList.push(...LOG_TOOLS);
  toolList.push(...AGENT_TOOLS);
  return { toolList, toolMap };
}

// ── tool handlers ──────────────────────────────────────────────────────────

function handleLogTool(name, args) {
  switch (name) {
    case "log_list": {
      const log   = loadLogFile();
      if (log.length === 0) return "No log entries.";
      const limit   = (args && args.limit) ? args.limit : 50;
      const entries = log.slice(-limit).reverse();
      return entries.map(e =>
        `[${e.ts}] ${e.connector} → ${e.tool} | result: ${e.result}${e.error ? ` | error: ${e.error}` : ""}`
      ).join("\n");
    }
    case "log_clear":
      fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2), "utf8");
      return "Log cleared.";
    default:
      return `Unknown log tool: ${name}`;
  }
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

async function handleAgentTool(name, args) {
  // ── run_agent ──────────────────────────────────────────────────────────────
  if (name === "run_agent") {
    const { file, params = {}, input = null } = args || {};
    if (!file) return "Error: file is required";
    if (!fs.existsSync(file)) return `Error: agent file not found: ${file}`;

    // Config: agent's directory first, then global CONFIG_FILE
    const agentDir  = path.dirname(path.resolve(file));
    const agentConf = path.join(agentDir, "oe-config.json");
    const confFile  = fs.existsSync(agentConf) ? agentConf : CONFIG_FILE;
    if (!fs.existsSync(confFile)) return `Error: config file not found: ${confFile}`;

    try {
      const result = await runAgentMcp(file, input, params, confFile, 0);
      return formatAgentResult(result);
    } catch (err) {
      return `Agent error: ${err.message}`;
    }
  }

  // ── list_pending_skills ────────────────────────────────────────────────────
  if (name === "list_pending_skills") {
    if (pendingChains.size === 0) return "No pending skills.";
    const lines = [];
    for (const [chainId, entry] of pendingChains) {
      const skillName = entry.remainingSkills?.[0]
        ? path.basename(entry.remainingSkills[0].path || "")
        : "unknown";
      lines.push(`chain_id  : ${chainId}\nskill_name: ${skillName}`);
    }
    return lines.join("\n\n---\n\n");
  }

  // ── approve_chain ──────────────────────────────────────────────────────────
  if (name === "approve_chain") {
    const { chain_id, approved = true, abort = false } = args || {};
    if (!chain_id) return "Error: chain_id is required";

    const pending = pendingChains.get(chain_id);
    if (!pending) return `Error: chain_id "${chain_id}" not found or already used`;

    pendingChains.delete(chain_id); // one-time use

    if (abort) return "Pipeline aborted.";

    const { remainingSkills, lastOutput, agentFile, configFile, depth } = pending;

    // approved:false → skip this skill, continue with rest
    const skills = approved
      ? (copy => { copy[0] = { ...copy[0], trigger_type: "auto" }; return copy; })([...remainingSkills])
      : remainingSkills.slice(1);

    if (!skills.length) {
      return approved
        ? "Skill approved but no skills to run."
        : "Skill skipped. Pipeline complete.";
    }

    try {
      const skillResult = await runSkillsMcp(skills, lastOutput, agentFile, configFile, depth);
      // When skipping, only surface new output if something actually ran in between
      const outputToReturn = approved
        ? skillResult.output
        : (skillResult.output !== lastOutput ? skillResult.output : null);

      const lines = [];
      if (outputToReturn) lines.push(outputToReturn);
      if (skillResult.pending_skill_chain) {
        lines.push(`\n${"─".repeat(40)}`);
        lines.push(`⏸  Skill awaiting approval`);
        lines.push(`  skill_name: ${skillResult.pending_skill_chain.skill_name}`);
        lines.push(`  chain_id  : ${skillResult.pending_skill_chain.chain_id}`);
        lines.push(`\n  → Call approve_chain with this chain_id to approve, skip, or abort.`);
      } else {
        lines.push("\nPipeline complete.");
      }
      return lines.join("\n");
    } catch (err) {
      return `Skill error: ${err.message}`;
    }
  }

  return `Unknown agent tool: ${name}`;
}

async function callTool(toolName, args, toolMap, store) {
  if (toolName.startsWith("memory_")) {
    return handleMemoryTool(toolName, args || {}, store);
  }
  if (toolName.startsWith("log_")) {
    return handleLogTool(toolName, args || {});
  }
  if (["run_agent", "list_pending_skills", "approve_chain"].includes(toolName)) {
    return handleAgentTool(toolName, args || {});
  }
  const entry = toolMap[toolName];
  if (!entry) return `Unknown tool: ${toolName}`;
  try {
    const result = await entry.adapter.executeTool(entry.action, args || {}, entry.connector, null);
    const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    appendLogEntry({
      ts:        new Date().toISOString(),
      connector: entry.connector.name,
      tool:      entry.action,
      input:     args || {},
      result:    "ok",
    });
    return text;
  } catch (err) {
    appendLogEntry({
      ts:        new Date().toISOString(),
      connector: entry.connector.name,
      tool:      entry.action,
      input:     args || {},
      result:    "error",
      error:     err.message,
    });
    throw err;
  }
}

// ── stdio MCP transport ────────────────────────────────────────────────────

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
  LOG_FILE    = path.join(path.dirname(path.resolve(configFile)), "oe-mcp-log.json");
  CONFIG_FILE = path.resolve(configFile);

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
