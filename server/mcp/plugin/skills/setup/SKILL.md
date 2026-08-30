---
name: setup
description: Set up OE MCP Server — create oe-mcp.json, configure connectors, and verify the connection. Use when the user wants to connect Claude Code to a database, file system, API, or other enterprise data source.
---

You are helping the user set up Open Enthrium MCP Server to connect Claude Code to their enterprise data.

## Step 1: Check existing config
Ask if they already have an `oe-mcp.json` file. If yes, ask for its path and set the `OE_MCP_CONFIG_PATH` environment variable. If no, proceed to Step 2.

## Step 2: Identify connectors
Ask what data sources they want to connect. Common choices:
- **Database** — PostgreSQL, MySQL, MongoDB, Redis
- **Files** — local filesystem or cloud drive (S3, Google Drive)
- **Code** — GitHub, GitLab
- **Messaging** — Slack, Teams
- **Email** — Gmail, SMTP
- **API** — any REST or GraphQL endpoint
- **SSH** — remote server access

## Step 3: Create oe-mcp.json
Based on their choices, create an `oe-mcp.json` file in a location they specify (e.g. `~/.oe-mcp/oe-mcp.json`).

Use placeholder credentials and clearly label each field the user needs to fill in:

```json
{
  "connectors": [
    {
      "name": "my-database",
      "type": "postgresql",
      "host": "YOUR_HOST",
      "port": 5432,
      "database": "YOUR_DATABASE",
      "user": "YOUR_USER",
      "password": "YOUR_PASSWORD"
    }
  ]
}
```

## Step 4: Set environment variable
Instruct them to add this to their shell profile (`~/.zshrc`, `~/.bashrc`, or Windows environment variables):

```bash
export OE_MCP_CONFIG_PATH="/path/to/oe-mcp.json"
```

Then reload Claude Code.

## Step 5: Verify
Ask them to type: _"What connectors do you have access to?"_

If OE MCP responds with their connector list — setup is complete.
If not — check that `OE_MCP_CONFIG_PATH` is set correctly and the credentials are filled in.
