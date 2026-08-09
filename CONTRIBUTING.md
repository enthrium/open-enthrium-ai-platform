# Contributing to Open Enthrium

Thanks for contributing! Adding a new connector is the most common contribution and takes only two steps.

---

## Adding a Connector

A connector works across all three products — **Platform**, **Runtime**, and **MCP** — automatically.

### Step 1 — Add your adapter file

Copy the template and implement the three functions:

```
server/src/utils/tools/adapters/_template.js  →  your-connector.js
```

```js
// server/src/utils/tools/adapters/your-connector.js
"use strict";

function getToolDefinitions(connector) {
  return [{
    type: "function",
    function: {
      name: `conn_${connector.id}_your_action`,
      description: `What this does on "${connector.name}"`,
      parameters: {
        type: "object",
        properties: {
          your_param: { type: "string", description: "..." },
        },
        required: ["your_param"],
      },
    },
  }];
}

function getAnthropicToolDefinitions(connector) {
  return getToolDefinitions(connector).map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

async function executeTool(action, args, connector, db) {
  const auth = JSON.parse(connector.auth || "{}");
  if (action === "your_action") {
    // your implementation
    return JSON.stringify({ result: "..." });
  }
  return `Unknown action: ${action}`;
}

module.exports = { getToolDefinitions, getAnthropicToolDefinitions, executeTool };
```

### Step 2 — Register the connector

Add one entry to `server/src/data/connectionTypes.json`:

```json
{
  "id": "your-connector",
  "label": "Your Connector",
  "color": "bg-blue-600",
  "initial": "YC",
  "cat": "Your Category"
}
```

> **`id`** must match your filename (without `.js`).  
> **`color`** is any Tailwind `bg-*` class.  
> **`cat`** groups the connector in the library (e.g. `Database`, `CRM & Sales`, `Messaging`).

### That's it

Restart the server — your connector is auto-discovered, seeded into the database, and shows as **Active** in the connector library. No registry edits, no seed script changes.

---

## Categories

| Category | Examples |
|---|---|
| Database | PostgreSQL, MongoDB |
| CRM & Sales | HubSpot, Salesforce |
| Email & Communication | Gmail, Zoho Mail |
| Cloud Storage | S3, Google Drive |
| Developer Tools | GitHub, GitLab |
| Project Management | Jira, Linear |
| Messaging | Slack, Telegram |
| Search | Algolia, Elasticsearch |
| AI & ML | OpenAI, Hugging Face |
| MCP | Any MCP Server |

---

## Guidelines

- **One file per connector.** Keep adapters focused — one service, one file.
- **Return strings from `executeTool`.** The engine passes the return value directly to the LLM.
- **Never store secrets.** Credentials come from `connector.auth` — never hardcode them.
- **Handle errors gracefully.** Return an error message string rather than throwing.
