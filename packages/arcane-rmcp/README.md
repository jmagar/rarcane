# rarcane

Node launcher for the `rarcane` Rust MCP server and CLI binary.

```bash
npx -y arcane-rmcp --help
```

The package downloads the matching GitHub Release binary during `postinstall`.

## MCP stdio

Use the package directly as an MCP command:

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

## Environment

- `ARCANE_RMCP_BINARY_VERSION`: release tag/version to download, defaulting to this npm package version.
- `ARCANE_RMCP_VERSION`: alias for `ARCANE_RMCP_BINARY_VERSION`.
- `ARCANE_RMCP_REPO`: GitHub `owner/repo`, defaulting to `jmagar/arcane-rmcp`.
- `ARCANE_RMCP_RELEASE_BASE_URL`: full release download base URL.
- `ARCANE_RMCP_SKIP_DOWNLOAD=1`: skip postinstall download.
