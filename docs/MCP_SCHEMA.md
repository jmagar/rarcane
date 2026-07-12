# MCP Schema Contract

Generated from `src/actions.rs` and checked against the schema, README, skill docs, help text, and scope routing.

Run:

```bash
python3 scripts/check-schema-docs.py --write
python3 scripts/check-schema-docs.py --check
```

## Tool

| Field | Value |
|---|---|
| Tool name | `rarcane` |
| Schema resource | `rarcane://schema/mcp-tool` |
| Dispatch parameter | `action` |

## Actions

| Action | Scope | Description |
|---|---|---|
| `help` | public | Return the in-tool Arcane action reference. |
| `status` | `rarcane:read` | Return local rarcane status and Arcane configuration metadata. |
| `environment` | `rarcane:read` / `rarcane:write` | List, inspect, test, create, update, and delete Arcane remote environments. |
| `project` | `rarcane:read` / `rarcane:write` | List, inspect, deploy, build, and manage Arcane projects. |
| `container` | `rarcane:read` / `rarcane:write` | List, inspect, start, stop, restart, update, and remove containers. |
| `image` | `rarcane:read` / `rarcane:write` | List, inspect, pull, prune, scan, and remove container images. |
| `network` | `rarcane:read` / `rarcane:write` | List, inspect, create, prune, and remove Docker networks. |
| `volume` | `rarcane:read` / `rarcane:write` | List, inspect, browse, back up, restore, create, prune, and remove Docker volumes. |
| `system` | `rarcane:read` / `rarcane:write` | Retrieve Arcane system information and run supported system operations. |
| `image-update` | `rarcane:read` | Check image update status and summaries. |
| `vulnerability` | `rarcane:read` / `rarcane:write` | Inspect, ignore, and unignore vulnerability findings. |
| `registry` | `rarcane:read` / `rarcane:write` | List, inspect, test, create, update, and delete registry connections. |
| `gitops` | `rarcane:read` / `rarcane:write` | List, inspect, browse, sync, create, update, and delete GitOps syncs. |

## Drift Rules

- `ACTION_SPECS` in `src/actions.rs` is the canonical action and scope list.
- `src/mcp/schemas.rs` must derive its enum from `ACTION_SPECS`.
- The MCP tool schema must reject unknown top-level parameters and encode action-specific requirements that fit the single-tool dispatch model.
- `help` is intentionally public and must have no required scope.
- `src/mcp/tools.rs`, `README.md`, and `plugins/rarcane/skills/rarcane/SKILL.md` must mention every action.
- `src/mcp/rmcp_server.rs` owns stable resources and must keep `rarcane://schema/mcp-tool` wired to `tool_definitions()`.
- `src/mcp/prompts.rs` owns stable prompts and must keep `quick_start` covered by prompt tests.

## Resources

| URI | Source | Contract |
|---|---|---|
| `rarcane://schema/mcp-tool` | `src/mcp/rmcp_server.rs` | Returns `tool_definitions()` as `application/json`. |

## Prompts

| Prompt | Source | Contract |
|---|---|---|
| `quick_start` | `src/mcp/prompts.rs` | Guides a client to call `status` and `projects:list`. |

## Input Validation

- `action` is always required.
- Arcane domain actions require valid `subaction` values.
- Environment-scoped actions require `envId`.
- Destructive operations require explicit confirmation.
- Unknown top-level parameters are rejected by the schema.
