# OE MCP Server — Changelog

All notable changes to the OE MCP Server are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [v1.8.7] — 2026-08-29

### Changed
- **README rewritten** — `README.md` and `npm/README.md` simplified; removed connector catalog table, verbose test/memory narrative sections, binary vs node mode. Added SKILL.md mention in `run_agent` description. Added Part of Open Enthrium ecosystem table.

---

## [v1.8.6] — 2026-08-28

No changes to OE MCP in this release.

---

## [v1.8.5] — 2026-08-28

No changes to OE MCP in this release.

---

## [v1.8.4] — 2026-08-26

No changes to OE MCP in this release.

---

## [v1.8.3] — 2026-08-25

No changes to OE MCP in this release.

---

## [v1.8.2] — 2026-08-25

No changes to OE MCP in this release.

---

## [v1.8.1] — 2026-08-25

No changes to OE MCP in this release.

---

## [v1.8.0] — 2026-08-25

No changes to OE MCP in this release.

---

## [v1.7.5] — 2026-08-19

No changes to OE MCP in this release.

---

## [v1.7.4] — 2026-08-18

No changes to OE MCP in this release.

---

## [v1.7.3] — 2026-08-16

No changes to OE MCP in this release.

---

## [v1.7.2] — 2026-08-14

No changes to OE MCP in this release.

---

## [v1.7.1] — 2026-08-13

No changes to OE MCP in this release.

---

## [v1.7.0] — 2026-08-12

### Changed
- Version bump — no MCP-specific changes this release; see OE Runtime v1.7.0 for project system, webhook receiver, and universal command language

---

## [v1.6.9] — 2026-08-11

### Changed
- Version bump — no MCP-specific changes this release; see OE Runtime v1.6.9 for agent chain support

---

## [v1.6.8] — 2026-08-10

### Fixed
- Binary crash on startup — connector registry `fs.readdirSync` wrapped in try/catch; compiled binary falls back to static adapter map cleanly

---

## [v1.6.7] — 2026-08-09

### Added
- **CONTRIBUTING.md**: Simplified guide for adding sample configs and connector adapters
- Connector adapter auto-discovery — drop a `.js` file in `adapters/`, no registry edits needed

---

## [v1.6.6] — 2026-08-08

### Added
- `run_agent` MCP tool — run any OE Runtime YAML agent directly from Claude Code, Cursor, Windsurf, Codex, or any MCP-compatible AI app
- Auto-detects `oe-config.json` in the agent's directory; falls back to `oe-mcp.json` if not found
- Supports optional `params` object — key-value pairs passed to the agent as `--param` flags
- READMEs updated with `run_agent` documentation and usage examples

### Changed
- Removed inflated connector count claims from all docs (no more "2,600+")

---

## [v1.6.5] — 2026-08-08

### Added
- Persistent action log (`oe-mcp-log.json`) stored next to `oe-mcp.json` — every connector tool call appended automatically
- `log_list` MCP tool — returns recent log entries (newest first, default 50, supports `limit` param)
- `log_clear` MCP tool — wipes the log file
- Error path covered — failed calls logged with `result: error` and error message
- Memory and log tool calls excluded from logging (no noise)

---

## [v1.6.4] — 2026-08-07

### Changed
- Config format switched from `oe-mcp.yaml` to `oe-mcp.json`; YAML still accepted as fallback via file extension detection
- Fixed GitHub connector in all docs and samples: `token` → `repoUrl` + `personalAccessToken`
- Fixed SSH `privateKey` docs: path reference → inline PEM content
- Updated npm package description: "one YAML config" → "one JSON config"
- All 11 existing samples converted from YAML to JSON format

### Added
- 7 new connector samples: `telegram`, `notion`, `confluence`, `graphql`, `zoho-mail`, `sftp`, `dropbox`
- Samples now include `_setup` hint field with setup instructions

---

## [v1.6.3] — 2026-08-07

### Changed
- Version bump — aligned with platform and runtime release v1.6.3

---

## [v1.6.2] — 2026-08-06

### Fixed
- **README** — SSH connector example corrected to use inline `privateKey` PEM content; was incorrectly showing a file path in the `privateKey` field instead of `privateKeyPath`

---

## [v1.6.1] — 2026-08-04

### Changed
- Version bump — aligned with platform and runtime release v1.6.1

---

## [v1.6.0] — 2026-08-04

### Changed
- Version bump — aligned with platform and runtime release v1.6.0

---

## [v1.5.1] — 2026-08-02

### Fixed
- **Binary crash on startup** — `mcp/index.js` shebang and code were on a single line; ncc treated the entire file as a comment, producing an empty bundle that exited immediately with code 0 in all modes. Fixed by separating the shebang onto its own line.
- **CI build reliability** — removed `--frozen-lockfile` from CI yarn install and copy root `yarn.lock` into server directory during sync so dependencies resolve correctly on the build runner.

---

## [v1.4.8] — 2026-08-01

### Changed
- GitHub Release notes now populated automatically from this CHANGELOG on every release
- `release.yml` managed from the monorepo — no manual edits needed in this repo

---

## [v1.4.7] — 2026-08-01

### Added
- **Multi-platform binaries** — `oe-mcp-win.exe`, `oe-mcp-linux`, `oe-mcp-macos` built and attached to every GitHub Release; `oe-mcp-samples.zip` included
- **npm package** — `@openenthrium/oe-mcp` published to npm automatically on release; install with `npx @openenthrium/oe-mcp`
- **Automated website version bumps** — `mcp.html` download link versions update automatically on release tag

### Changed
- Source of truth moved to monorepo (`enthrium-commercial`); one tag fans out to all repos
- `README.md`, `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md`, `CHANGELOG.md` managed from monorepo

---

## [v1.4.1] — 2026-07-28

### Added
- **OE MCP Server** — standalone binary exposing enterprise connectors as MCP tools; AI apps (Claude Code, Cursor, Windsurf, Claude Desktop) connect via stdio or HTTP
- **`--stdio` mode** — Claude Code VS Code extension launches `oe-mcp` as a child process; no manual server start required
- **`--serve` mode** — `oe-mcp --serve --port 4040 oe-mcp.yaml` starts an HTTP MCP server for Cursor, Windsurf, and cloud deployments
- **Persistent memory tools** — `memory_set`, `memory_get`, `memory_delete`, `memory_list` available in every session; state survives restarts via `oe-mcp-memory.json`
- **Filesystem connector** — `list_dir`, `read_file`, `write_file`, `append_file`, `delete_file`, `make_dir`, `file_info`, `search_files`; directory traversal blocked by `safePath()`; 50 KB read limit
- **17 connector types** — PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, S3, Google Drive, GitHub, Jira, Slack, Gmail, SMTP, SSH, Filesystem, REST API, HubSpot, Kafka
- **Sample configs** — ready-to-use `oe-mcp.yaml` starters for PostgreSQL, MySQL, MongoDB, GitHub, Slack, Google Drive, SSH, filesystem, and a multi-connector example

### Changed
- Dedicated public repo `open-enthrium-ai-mcp-server` established with own CI pipeline
