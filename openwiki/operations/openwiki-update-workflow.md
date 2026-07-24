---
type: Playbook
title: OpenWiki Update Workflow
description: Documents the repository's OpenWiki automation workflow, including scheduler, generation command, provider settings, and required pull request output paths.
tags:
  - openwiki
  - workflow
  - automation
  - documentation
---

# OpenWiki Update Workflow

## Purpose

The OpenWiki workflow in this repository performs periodic and on-demand documentation regeneration for code-mode documentation. It is the primary mechanism for keeping `openwiki/` current when source or operations files change.

## Workflow behavior

The workflow is defined in [`.github/workflows/openwiki-update.yml`](../../.github/workflows/openwiki-update.yml) and:

- runs on `workflow_dispatch` and a daily UTC schedule (`cron: 0 8 * * *`),
- installs Node.js 22, and executes `openwiki code --update --print`,
- uses `OPENWIKI_PROVIDER=openrouter` with `OPENWIKI_MODEL_ID=z-ai/glm-5.2`, and
- includes `AGENTS.md`, `CLAUDE.md`, and the workflow file in the PR update file paths.

## Environment and tracing

The job uses these relevant secrets and environment variables:

- `OPENROUTER_API_KEY` authenticates to the configured OpenRouter model endpoint, and
- `OPENWIKI_PROVIDER=openrouter` with `OPENWIKI_MODEL_ID=z-ai/glm-5.2`.

Optional telemetry variables include `LANGSMITH_API_KEY`, `LANGCHAIN_PROJECT`, and `LANGCHAIN_TRACING_V2`.

No `/models` preflight is executed in the current workflow.

## Pull request automation

The workflow uses `peter-evans/create-pull-request` to collect the files in `add-paths` (`openwiki`, `AGENTS.md`, `CLAUDE.md`, and `.github/workflows/openwiki-update.yml`) onto the `openwiki/update` branch.

## Source-level context

The workflow file is the source of truth for its schedule, provider, command, and pull request paths. Regenerate these pages after changing that workflow.

## Cross-links

- The top-level contributor entrypoint is [OpenWiki Quickstart](../quickstart.md).
