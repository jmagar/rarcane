#!/usr/bin/env bash
# Fail when common coupled files are changed without their companion updates.
set -euo pipefail

BASE="${1:-origin/main}"
HEAD="${2:-}"

if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  BASE="HEAD~1"
fi

if [[ -n "${HEAD}" ]]; then
  mapfile -t CHANGED < <(git diff --name-only "$BASE" "$HEAD")
  RANGE_LABEL="${BASE}..${HEAD}"
else
  # Include committed and uncommitted changes for the local `just
  # coupled-files-check` workflow. CI passes HEAD explicitly for a stable range.
  mapfile -t CHANGED < <(git diff --name-only "$BASE")
  RANGE_LABEL="${BASE}..worktree"
fi

changed() {
  local pattern="$1"
  local file
  for file in "${CHANGED[@]}"; do
    [[ "$file" == $pattern ]] && return 0
  done
  return 1
}

issues=()

if changed "Justfile" && ! changed "lefthook.yml"; then
  issues+=("Justfile changed but lefthook.yml did not; confirm hook/recipe parity.")
fi

if changed "lefthook.yml" && ! changed "Justfile"; then
  issues+=("lefthook.yml changed but Justfile did not; confirm matching manual recipe exists.")
fi

if changed "scripts/*" && ! changed "scripts/README.md"; then
  issues+=("scripts changed but scripts/README.md did not; document new or changed script behavior.")
fi

if changed "src/mcp/schemas.rs" && ! changed "docs/MCP_SCHEMA.md"; then
  issues+=("src/mcp/schemas.rs changed but docs/MCP_SCHEMA.md did not; run scripts/check-schema-docs.py --write.")
fi

if changed "plugins/rarcane/*" && ! changed "docs/PLUGINS.md"; then
  issues+=("plugin package changed but docs/PLUGINS.md did not; confirm plugin docs are still current.")
fi

if (( ${#issues[@]} > 0 )); then
  printf 'Coupled-file check failed:\n' >&2
  printf '  - %s\n' "${issues[@]}" >&2
  exit 1
fi

printf 'Coupled-file check passed (%s).\n' "$RANGE_LABEL"
