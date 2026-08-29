---
name: oe-mcp:run-agent
description: Run an OE Runtime SKILL.md agent or YAML agent directly from Claude Code via the run_agent tool. Use when the user wants to execute an automated workflow, schedule a task, or run a multi-step agent against their enterprise data.
---

You can run OE Runtime agents directly from Claude Code using the `run_agent` MCP tool — no terminal required.

## Step 1: Locate the agent
Ask for the path to the agent folder (containing `SKILL.md` + `agent.yaml`) or the `agent.yaml` file directly. Example:
- `/home/user/agents/daily-report/agent.yaml`
- `./skills/sql-databases/agent.yaml`

The agent directory must contain a valid `oe-config.json` with LLM credentials and connector config.

## Step 2: Run it
Call `run_agent` with the absolute path:
- `file`: absolute path to `agent.yaml`
- `params`: any `{{placeholder}}` values the agent expects
- `input`: optional initial message or context

## Step 3: Handle chains
If the agent has **auto chains** — they fire immediately and results are returned together.

If the agent has **manual chains** — they appear as pending. Ask the user: _"The agent wants to run a follow-up step. Approve?"_ then call `approve_chain` with the `chain_id`.

## Step 4: Report
Present the agent's output clearly. If the agent produced a report, format it. If it performed actions (sent an email, wrote to a database), confirm what was done.
