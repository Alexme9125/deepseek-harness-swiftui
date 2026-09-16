# Agent Note: Port official 0.1.6-alpha.1 onto the SwiftUI fork

Status: implemented

English | [中文](2026-09-16-port-official-0.1.6.zh.md)

## Problem

This personal fork last tracked official `dsh-v0.1.3-alpha.1` plus a macOS SwiftUI shell and a closed `dsh-web-host` SEA. Official `master` then shipped `dsh-v0.1.6-alpha.1`: session format v3, Web sidebar terminals, archived-session restore, MCP resources, SSH remote workspaces, experimental Browser Use and Computer Use, official profile-resolution generations, and an Electron desktop host. Keeping the fork on `0.1.3-alpha.1` would hide those product changes and leave the packaged host on deleted PTC and workflow package names.

## Decision

Merge `deepseek-ai/deepseek-harness` `master` at `dsh-v0.1.6-alpha.1` plus the follow-up client bootstrap work into this fork and keep the personal product on the new APIs. The [0.1.3 port](2026-09-05-port-official-0.1.3.md) remains the method: prefer official text on textual conflicts (`-X theirs`), keep `apps/macos/**`, and restore fork-only triggers and the page command bus.

`dsh-web-host` calls `runProfile` with `resolutionMode: 'runtime'`. Official profile-resolution generations replace the fork's `bareModuleBaseUrl` skip of `healProfilesModuleFallback`. A pkg SEA also sets `process.pkg`, which forces the same mode. The page `dsh-native-command` bus stays on `packages/client/ui-workspace`.

Keep GitHub Actions as `workflow_dispatch` / `workflow_call` only, including new official workflows (`node-addon-system`, weighted approval, issue lifecycle). Leave official job `if:` strings.

Point `scripts/verify-runtime-closure.ts` at both `python/sdk-runtime/package.json` and `apps/macos/web-host/package.json`. Refresh the host `dependencies` from the official `web` roster plus the Python runtime closure, without ACP/SDK/webhook application extras.

Keep the README as Alex's personal SwiftUI packaging of `dsh-v0.1.6-alpha.1`.

## Alternatives considered

**Rebase the fork commits onto official `master`.** The macOS tree is large and the official history is the product of record; a merge keeps both ancestries.

**Keep passing `bareModuleBaseUrl` from `packaged-bin`.** Official packaged executables already select runtime resolution; a second host-parent override would duplicate that generation.

**Auto-run the official PR/push CI graphs on this fork.** The fork has no secret budget for those jobs. The [fork Actions note](2026-08-19-fork-manual-github-actions.md) remains the authority for which events execute.

## Consequences

`SESSION_FORMAT_VERSION` is `3`. Sessions written by this fork's `0.1.3-alpha.1` tree are not promised to load without the adjacent v2-to-v3 edge. The packaged host must list every `web` plugin official adds, or `verify-runtime-closure` fails. Manual `workflow_dispatch` of `ci.yml` / `ci-master.yml` still no-ops most jobs because those workflows keep official `if:` guards. The [SwiftUI macOS shell note](../architecture/2026-08-13-swiftui-mac-shell.md) keeps the product-window decision; this note records how that product tracks official `master`.
