# rarcane — Claude Code instructions

## What this project is

A reusable Rust template for building MCP servers with the rmcp crate. The binary is named `rarcane`. All stub identifiers (`Arcane*`, `RARCANE_*`) are renamed when the template is used for a real service.

## Long-Lived Branches

- `marketplace-no-mcp` is an intentional long-lived marketplace variant branch,
  not stale cleanup. It keeps the rarcane plugin/skill surface available while
  removing bundled MCP server registration for environments where the MCP server
  is already connected through the Labby gateway.
- Do not merge `marketplace-no-mcp` into `main` by default, and do not delete it
  as stale unless Jacob explicitly retires the no-MCP marketplace variant.

## Module map

| File | Role |
|------|------|
| `src/rarcane.rs` | `ArcaneClient` — HTTP/API transport stub; one method per remote operation |
| `src/app.rs` | `ArcaneService` — business layer; all logic lives here, never in shims |
| `src/server.rs` | `AppState`, `AuthPolicy`, `build_auth_layer` — HTTP server state and auth policy |
| `src/server/routes.rs` | Axum router: `/mcp`, `/health`, `/status`, OAuth discovery routes |
| `src/api.rs` | REST API handlers: `POST /v1/rarcane`, `GET /health`, `GET /status` |
| `src/mcp.rs` | MCP protocol layer — re-exports from `mcp/` submodules |
| `src/mcp/tools.rs` | MCP shim: parse JSON args → call service → return `Value` |
| `src/mcp/schemas.rs` | Tool JSON schema derived from `ACTION_SPECS` |
| `src/mcp/rmcp_server.rs` | `ServerHandler` impl: tools, resources, prompts, scope checks |
| `src/mcp/prompts.rs` | MCP prompts (`quick_start`) |
| `src/config.rs` | `Config`, `ArcaneConfig`, `McpConfig`, `AuthConfig`, env loading |
| `src/cli.rs` | CLI shim: parse args → call service → print |
| `src/cli/doctor.rs` | Pre-flight checks: env, connectivity, config validation |
| `src/cli/setup.rs` | Interactive first-run / plugin setup wizard |
| `src/cli/watch.rs` | Polls `/health` and emits state-change lines for plugin monitor |
| `src/mcp/transport.rs` | Streamable HTTP transport wiring and session lifecycle |
| `src/token_limit.rs` | Token budget enforcement for MCP response payloads |
| `src/main.rs` | Mode dispatch: HTTP server / stdio / CLI |
| `src/lib.rs` | Public API + `testing` helpers for integration tests |
| `tests/cli_parse.rs` | CLI argument parsing tests |
| `tests/tool_dispatch.rs` | MCP tool dispatch tests (service-layer, no real credentials) |

## The thin-shim rule — enforce this hard

`src/mcp/tools.rs` and `src/cli.rs` contain **zero business logic**. They only:
1. Parse their input format (JSON args or CLI flags)
2. Call the corresponding `ArcaneService` method
3. Return the result

If you find yourself computing, filtering, transforming, or validating data in `tools.rs` or `cli.rs`, stop and move it to `app.rs`.

## How to add an action (4-file checklist)

1. **`src/rarcane.rs`** — add `pub async fn your_action(&self, ...) -> Result<Value>` with the actual HTTP/API call (or stub).

2. **`src/app.rs`** — add a delegating method: `pub async fn your_action(&self, ...) -> Result<Value> { self.client.your_action(...).await }`.

3. **`src/actions.rs`** — add the action to `ACTION_SPECS`, including scope and transport.

4. **`src/mcp/schemas.rs`** — add any new parameters to `tool_definitions()`; the action enum comes from `ACTION_SPECS`.

5. **`src/mcp/tools.rs`** — add a match arm in `dispatch_example()`: `"your_action" => { ... state.service.your_action(...).await }`. Also add to `HELP_TEXT`.

6. **`src/cli.rs`** — add a `Command` variant, a parse arm in `parse_args()`, and a dispatch arm in `run()`.

7. **`tests/tool_dispatch.rs`** — add a test.

8. **`CHANGELOG.md`** — add an entry under `[Unreleased]` describing the new action.

For actions with parameters, extract them with `string_arg(&args, "param_name")` in `tools.rs`.

## Auth model

`AuthPolicy` is an enum with three states:

| Variant | When | Effect |
|---------|------|--------|
| `AuthPolicy::LoopbackDev` | `no_auth=true` or host is loopback (`localhost`, `127.*`, `::1`) via `McpConfig::is_loopback()` | No auth middleware; scope checks bypassed |
| `AuthPolicy::TrustedGatewayUnscoped` | `RARCANE_NOAUTH=true` on non-loopback behind an authz-enforcing gateway | No auth middleware; scope checks bypassed |
| `AuthPolicy::Mounted { auth_state: None }` | Default non-loopback | Static bearer token required |
| `AuthPolicy::Mounted { auth_state: Some(_) }` | `auth_mode = "oauth"` | Full Google OAuth + RS256 JWT issuance |

Auth is selected in `build_auth_policy()` in `main.rs`. Scopes are `rarcane:read` and `rarcane:write` (write satisfies read). `help` requires no scope. Unknown actions get `DENY_SCOPE`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RARCANE_API_URL` | — | Upstream service base URL |
| `RARCANE_API_KEY` | — | Upstream service API key |
| `RARCANE_MCP_HOST` | `127.0.0.1` | Bind host |
| `RARCANE_MCP_PORT` | `40110` | Bind port |
| `RARCANE_MCP_NO_AUTH` | `false` | Disable auth (loopback only) |
| `RARCANE_MCP_TOKEN` | — | Static bearer token |
| `RARCANE_MCP_ALLOWED_HOSTS` | — | Extra comma-separated Host header values |
| `RARCANE_MCP_ALLOWED_ORIGINS` | — | Extra comma-separated CORS origins |
| `RARCANE_MCP_PUBLIC_URL` | — | Public URL for OAuth metadata endpoints |
| `RARCANE_MCP_AUTH_MODE` | `bearer` | `bearer` or `oauth` |
| `RARCANE_MCP_GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `RARCANE_MCP_GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `RARCANE_MCP_AUTH_ADMIN_EMAIL` | — | OAuth admin email |
| `RUST_LOG` | `info` | Log filter |

## Elicitation

The `elicit_name` action demonstrates MCP elicitation (spec 2025-06-18). The server calls `peer.elicit::<T>()` to ask the MCP client for user input mid-call. The type `T` must:
- Derive `JsonSchema`, `Serialize`, `Deserialize`
- Be an object (struct), not a primitive
- Be registered with `rmcp::elicit_safe!(T)`

`ElicitationError::CapabilityNotSupported` is handled gracefully — clients that don't support it get a fallback message instead of an error.

## Build commands

```bash
cargo build --release     # produces target/release/rarcane
cargo test                # all tests
cargo clippy -- -D warnings  # lint (must pass)
cargo fmt                 # format

just dev                  # RARCANE_MCP_HOST=127.0.0.1 RARCANE_MCP_NO_AUTH=true cargo run -- serve mcp (loopback only, no auth)
just test                 # cargo test
just lint                 # cargo clippy -- -D warnings
just fmt                  # cargo fmt
just gen-token            # openssl rand -hex 32
just health               # curl http://localhost:40110/health | jq .
```

## Test helpers

`src/lib.rs` exports `testing::loopback_state()` and `testing::bearer_state(token)` (behind `features = ["test-support"]` or `cfg(test)`). Use these in integration tests — they build `AppState` without real credentials.

## CLI ↔ MCP action parity

Every action in the MCP tool must also be reachable from the CLI, and vice versa.
Both shims call the same `ArcaneService` methods, so parity is automatic when the
shims are complete.

**Exception — MCP-only features:** `elicit_name` and MCP resources/prompts have no
CLI equivalent. Elicitation requires a live MCP client interaction (the server asks
the user for input mid-call via `peer.elicit()`); that interaction model does not
translate to a one-shot CLI call. Resources and prompts are MCP protocol concepts
with no CLI analogue.

| Service Method | MCP Action | CLI Command | Notes |
|---|---|---|---|
| `service.greet(name)` | `rarcane(action="greet", name="...")` | `rarcane greet [--name N]` | `name` optional in both |
| `service.echo(message)` | `rarcane(action="echo", message="...")` | `rarcane echo --message <msg>` | `message` required in both |
| `service.status()` | `rarcane(action="status")` | `rarcane status` | |
| _(MCP client interaction)_ | `rarcane(action="elicit_name")` | _(MCP-only — no CLI equivalent)_ | Requires elicitation-capable client |
| _(MCP elicitation wizard)_ | `rarcane(action="scaffold_intent")` | _(MCP-only — no CLI equivalent)_ | Combines elicitation + skill handoff; no one-shot CLI equivalent |
| _(built-in)_ | `rarcane(action="help")` | `rarcane --help` | MCP returns structured JSON; CLI prints usage |

**TEMPLATE:** Replace this table with your service's actual actions when you adapt
the template. The rule is: one row per service method, with both the MCP action name
and the CLI subcommand/flag documented.

## Plugin versioning

Plugin manifests (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `gemini-extension.json`) do **not** contain a `version` field. The marketplace derives the version from the git commit SHA on every push — adding an explicit version causes every push to be treated as a new version and creates duplicate entries. Do not add `version` to any plugin manifest and do not run `scripts/bump-version.sh` targets against plugin manifests.

## Common gotchas

- **Stdio mode suppresses logs** — `main.rs` sets log level to `warn` in stdio mode so JSON-RPC is not corrupted by log lines on stdout.
- **`config.toml` is a template file** — it still contains `unraid-mcp` values; update it when adapting this template.
- **Scope checks run in `rmcp_server.rs`**, not in `tools.rs`. `tools.rs` only dispatches.
- **`help` action is public** — `required_scope_for("help")` returns `None`. All other actions require at least `rarcane:read`.
- **Default port is 40110** — set in `default_mcp_port()` in `config.rs`. Override with `RARCANE_MCP_PORT`.
- **`elicit_name` is MCP-only** — elicitation requires a live client connection; it cannot be invoked from the CLI. This is the one intentional parity exception.
- **`watch`, `serve`, and `doctor` are CLI infrastructure** — they are not MCP actions and have no parity requirement. `watch` polls `/health` and emits state-change lines to stdout (used by the plugin monitor). `serve` starts the HTTP server. `doctor` runs pre-flight checks. None belong in the MCP parity table.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
