# rarcane

Rust MCP and CLI server for Arcane Docker management.

`rarcane` is a Rust implementation of the existing TypeScript `arcane-mcp` behavior. It proxies Arcane API operations through a consistent MCP tool and equivalent CLI commands while keeping auth, validation, destructive-operation confirmation, and response shaping in the Rust service layer.


## npm / npx

Run the stdio MCP server or CLI without a manual binary install:

```bash
npx -y arcane-rmcp --help
```

MCP clients can use the same launcher:

```json
{
  "mcpServers": {
    "rarcane": {
      "command": "npx",
      "args": ["-y", "arcane-rmcp"]
    }
  }
}
```

The naming pattern for this family is `repo=<service>-rmcp`, `npm=<service>-rmcp`, and `CLI=r<service>`. For Arcane that means repo/package `arcane-rmcp` and CLI/bin alias `rarcane`.

The npm package downloads the `rarcane` binary from GitHub Releases during `postinstall` and keeps the release tag aligned with `packages/arcane-rmcp/package.json`.

## Surfaces

| Surface | Status | Purpose |
|---|---:|---|
| MCP | Required | Agent-facing Docker/Arcane operations through the `arcane` tool |
| CLI | Required | Scriptable parity surface for debugging and automation |
| REST | Not shipped | Upstream-client servers do not expose a local REST action API |
| Web | Not shipped | Upstream-client servers do not serve an embedded web UI |

## Actions

The MCP tool is named `arcane`. Calls dispatch on `action` and, for most domains, `subaction`.

| Action | Examples | Scope |
|---|---|---|
| `help` | action reference | public |
| `status` | local rarcane and Arcane config status | `rarcane:read` |
| `environment` | `list`, `get`, `create`, `update`, `delete`, `test` | read/write |
| `project` | `list`, `get`, `create`, `up`, `down`, `restart`, `pull`, `destroy`, `redeploy`, `build` | read/write |
| `container` | `list`, `get`, `create`, `start`, `stop`, `restart`, `update`, `delete`, `stats` | read/write |
| `image` | `list`, `get`, `pull`, `delete`, `prune`, `scan` | read/write |
| `network` | `list`, `get`, `create`, `delete`, `prune` | read/write |
| `volume` | `list`, `get`, `create`, `delete`, `prune`, `browse`, backup/restore actions | read/write |
| `system` | `docker-info`, `prune`, `start-all`, `stop-all`, `convert` | read/write |
| `image-update` | `check-all`, `check`, `check-batch`, `summary` | read |
| `vulnerability` | `summary`, `list`, `scanner-status`, `ignore`, `unignore`, `list-ignored` | read/write |
| `registry` | `list`, `get`, `create`, `update`, `delete`, `test` | read/write |
| `gitops` | `list`, `get`, `create`, `update`, `delete`, `sync`, `status`, `browse` | read/write |

Destructive subactions require explicit `params.confirm=true` or CLI `--confirm`.

## Configuration

```bash
RARCANE_API_URL=https://arcane.example.com
RARCANE_API_KEY=...
RARCANE_MCP_HOST=127.0.0.1
RARCANE_MCP_PORT=3100
RARCANE_MCP_TOKEN=change-me
```

Arcane API keys are read from config/env only. Do not pass credentials in MCP arguments.

## Run

```bash
cargo run -- status
cargo run -- help container
cargo run -- call --action container --subaction list --env-id default
cargo run -- call --action system --subaction docker-info --env-id default
cargo run -- call --action container --subaction stop --env-id default --id my-container --confirm

cargo run -- serve
cargo run -- mcp
```

MCP example:

```json
{
  "action": "container",
  "subaction": "list",
  "envId": "default"
}
```

## Architecture

```text
ArcaneClient  (src/arcane.rs)      HTTP transport and redacted errors
      ↓
ArcaneService (src/app.rs)         action validation, confirmation, response normalization
      ↓
MCP shim      (src/mcp/tools.rs)   JSON args -> service -> Value
CLI shim      (src/cli.rs)         argv -> service -> stdout
```

## Development

```bash
cargo fmt --check
cargo test
cargo clippy -- -D warnings
cargo build --release
```

Useful docs:

- `docs/API.md` for action contracts
- `docs/CONFIG.md` for environment and auth
- `docs/QUICKSTART.md` for smoke tests
- `docs/MCP_SCHEMA.md` for schema drift rules
- `plugins/rarcane/skills/rarcane/SKILL.md` for agent usage guidance
