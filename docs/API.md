# rarcane API

`rarcane` exposes one MCP tool named `arcane` and equivalent CLI commands.

## MCP Tool

Required field: `action`.

Common fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `action` | string | yes | Domain such as `container`, `project`, `image`, or `status` |
| `subaction` | string | domain actions | Operation within the domain |
| `envId` | string | environment-scoped actions | Arcane environment id |
| `id` | string | item actions | Resource id |
| `params` | object | action-dependent | Body/control parameters |

Examples:

```json
{"action":"status"}
{"action":"container","subaction":"list","envId":"default"}
{"action":"container","subaction":"stop","envId":"default","id":"nginx","params":{"confirm":true}}
{"action":"image","subaction":"pull","envId":"default","params":{"image":"alpine:latest"}}
```

## CLI Parity

```bash
rarcane status
rarcane help container
rarcane call --action container --subaction list --env-id default
rarcane call --action container --subaction stop --env-id default --id nginx --confirm
rarcane call --action image --subaction pull --env-id default --params-json '{"image":"alpine:latest"}'
```

## Safety and Auth

- `help` is public.
- Read operations require `rarcane:read`.
- Mutating operations require `rarcane:write`.
- Destructive operations require explicit confirmation.
- Credentials are never accepted as tool parameters.
- Arcane API error strings are redacted before being returned.
