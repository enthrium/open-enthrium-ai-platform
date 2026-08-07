# OE MCP Server — Changelog

All notable changes to the OE MCP Server are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
