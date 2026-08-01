#!/usr/bin/env node
"use strict";

const path      = require("path");
const fs        = require("fs");
const { spawn } = require("child_process");

const BINARY = {
  win32:  "oe-mcp-win.exe",
  linux:  "oe-mcp-linux",
  darwin: "oe-mcp-macos",
}[process.platform];

if (!BINARY) {
  console.error(`OE MCP: unsupported platform "${process.platform}"`);
  process.exit(1);
}

const BIN_PATH = path.join(__dirname, "bin", BINARY);

if (!fs.existsSync(BIN_PATH)) {
  console.error("OE MCP: binary not found. Try reinstalling: npm install -g @openenterprise/oe-mcp");
  process.exit(1);
}

const child = spawn(BIN_PATH, process.argv.slice(2), { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("OE MCP:", err.message);
  process.exit(1);
});
