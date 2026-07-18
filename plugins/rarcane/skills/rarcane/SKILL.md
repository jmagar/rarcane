---
name: rarcane
description: Use when the user wants to inspect or manage Arcane Docker resources through rarcane, including projects, containers, images, networks, volumes, registries, vulnerability scans, image updates, environments, system operations, or GitOps syncs.
---

# rarcane

Use the `arcane` MCP tool for Arcane Docker management. Prefer read actions first. For destructive actions, explain the likely effect and pass `params.confirm=true` only after the user has clearly asked for the operation.

## Common Calls

```text
mcp__rarcane__arcane(action="status")
mcp__rarcane__arcane(action="elicit_name")
mcp__rarcane__arcane(action="scaffold_intent")
mcp__rarcane__arcane(action="container", subaction="list", envId="default")
mcp__rarcane__arcane(action="project", subaction="list", envId="default")
mcp__rarcane__arcane(action="system", subaction="docker-info", envId="default")
mcp__rarcane__arcane(action="container", subaction="stop", envId="default", id="nginx", params={"confirm":true})
```

## Domains

`elicit_name` and `scaffold_intent` are MCP-only elicitation workflows. The
latter returns a side-effect-free planning contract; it does not grant file
mutation permission.

| Domain | Typical Read Actions | Typical Write Actions |
|---|---|---|
| `environment` | `list`, `get`, `test` | `create`, `update`, `delete` |
| `project` | `list`, `get` | `create`, `up`, `down`, `restart`, `pull`, `destroy`, `redeploy`, `build` |
| `container` | `list`, `get`, `stats` | `create`, `start`, `stop`, `restart`, `update`, `delete` |
| `image` | `list`, `get` | `pull`, `delete`, `prune`, `scan` |
| `network` | `list`, `get` | `create`, `delete`, `prune` |
| `volume` | `list`, `get`, `browse`, `list-backups` | `create`, `delete`, `prune`, backup and restore actions |
| `system` | `docker-info`, `convert` | `prune`, `start-all`, `stop-all` |
| `image-update` | `check-all`, `check`, `check-batch`, `summary` | none |
| `vulnerability` | `summary`, `list`, `scanner-status`, `list-ignored` | `ignore`, `unignore` |
| `registry` | `list`, `get`, `test` | `create`, `update`, `delete` |
| `gitops` | `list`, `get`, `status`, `browse` | `create`, `update`, `delete`, `sync` |

## Safety

- Never pass Arcane API keys through MCP arguments.
- Do not call destructive subactions without explicit user intent.
- Include `envId` for environment-scoped actions.
- Use `help` with an optional domain when unsure.
