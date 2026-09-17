# Agent Note: Port official 0.1.3-alpha.1 onto the SwiftUI fork

Status: implemented

English | [中文](2026-09-05-port-official-0.1.3.zh.md)

## Problem

This personal fork last tracked official `0.1.0-rc.5` plus a macOS SwiftUI shell and a closed `dsh-web-host` SEA. Official `master` then shipped `0.1.3-alpha.1`: session format v2, `SessionHandle`, HTTP proxy env, generic file upload, skill fuzzy search, clickable-link unification, ACP/MCP/webhook surfaces, and a split of `dsh-client-runtime` into `connection` / `store` / `ui-session` / `ui-workspace`. Keeping the fork on the old tree would hide those product changes and leave the macOS host pointed at deleted packages.

## Decision

Merge `deepseek-ai/deepseek-harness` `master` at `dsh-v0.1.3-alpha.1` into this fork and keep the personal product on the new APIs.

Prefer official text on textual conflicts (`-X theirs`). Drop leftover `packages/client/runtime` and the retired `knip.json`.

Keep `apps/macos/**`, `apps/cli/src/packaged-bin.ts`, and `bin.dsh-web-host`. That merge skipped `healProfilesModuleFallback` via `bareModuleBaseUrl`; the [0.1.6 port](2026-09-16-port-official-0.1.6.md) now does the same skip with `resolutionMode: 'runtime'`.

Rehome the page `dsh-native-command` bus on `packages/client/ui-workspace` (`IWorkspaces.create`, `UiWorkspace.startSession`). Do not export it from the public `/client` barrel. The official `@deepseek-ai/dsh-native-command` package remains the Host no-shell runner.

Keep GitHub Actions as `workflow_dispatch` / `workflow_call` only. Leave official `if:` strings so a manual dispatch still skips most jobs.

Point `scripts/verify-runtime-closure.ts` at both `python/sdk-runtime/package.json` and `apps/macos/web-host/package.json`. Refresh the host `dependencies` to the official `web` roster (no ACP/SDK/webhook extras).

The [0.1.6 port](2026-09-16-port-official-0.1.6.md) owns the current README tracking line.

## Alternatives considered

**Rebase the fork commits onto official `master`.** The macOS tree is large and the official history is the product of record; a merge keeps both ancestries.

**Leave the page command bus on a resurrected `dsh-client-runtime`.** Official deleted that package; the workspace UI already owns create and start.

**Auto-run the official PR/push CI graphs on this fork.** The fork has no secret budget for those jobs. The [fork Actions note](2026-08-19-fork-manual-github-actions.md) remains the authority for which events execute.

## Consequences

`SESSION_FORMAT_VERSION` shipped as `2` on that merge. The [0.1.6 port](2026-09-16-port-official-0.1.6.md) ships writer version `3`. The packaged host must list every `web` plugin official adds, or `verify-runtime-closure` fails. Manual `workflow_dispatch` of `ci.yml` / `ci-master.yml` still no-ops most jobs because those workflows keep official `if:` guards. The [SwiftUI macOS shell note](../architecture/2026-08-13-swiftui-mac-shell.md) keeps the product-window decision; later ports record how that product tracks official `master`.
