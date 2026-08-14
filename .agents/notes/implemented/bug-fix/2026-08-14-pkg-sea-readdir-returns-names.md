# Agent Note: Packaged-host readdir returns names as strings

Status: implemented

English | [中文](2026-08-14-pkg-sea-readdir-returns-names.zh.md)

## Problem

Sending a message in the macOS product window failed with `agent-presets: preset "standard" not found (available: none)`. The shipped compositions are in the web-host VFS at `@deepseek-ai/dsh/config/agent-presets/`. `scanRoot` ran and returned no rows.

The same scan previously threw `TypeError: child.isDirectory is not a function` on New Session (`session.create`, `agentPreset.list` HTTP 500). Both failures are one `readdir` result. `@yao-pkg/pkg --sea` (node24, 6.21.0) returns **strings** for `readdir` of a snapshot directory, with or without `{ withFileTypes: true }` — measured on a nested `config/agent-presets/<id>/agent.cordis.yml` tree whose `import.meta.url` is `file:///snapshot/…`. Node `Dirent.isDirectory()` does not exist on a string. Treating only `{ isDirectory: true }` objects as directories skips every name, so the roster is empty while the YAML is present. `stat(join(root, name)).isDirectory()` on those same names is a function and returns true.

## Decision

[`scanRoot`](../../../../packages/preset/agent-presets/src/discovery.ts) calls `readdir` without `withFileTypes` and `stat`s each name that is a usable preset id. A sibling file is not a roster row. Authoring still walks a real destination tree after `cp` and keeps `Dirent.isDirectory()`.

## Alternatives considered

**Keep `withFileTypes` and treat a boolean `isDirectory` property as a directory.** That adapter shipped against the TypeError; measured SEA output is strings, so every shipped id disappeared (`available: none`) instead of crashing.

**Treat every `readdir` string as a directory.** A file whose name matches a usable preset id would occupy that slot as a broken ghost.

**Catch the TypeError in `session.create`.** The roster would still be empty; the call site is not the defect.

## Consequences

Packaged `dsh-web-host` lists the shipped presets and can resume a session that recorded `standard`. Other snapshot `readdir({ withFileTypes: true })` callers are unchanged; a later walk of a VFS directory must not assume Node `Dirent` methods.

## Testing

`packages/preset/agent-presets/tests/discovery.spec.ts` feeds string names through `scanRoot` (the SEA result) and expects the same directory-vs-file split as a real filesystem: a usable directory is listed, a sibling file whose name is a usable id is omitted, and a name that cannot be statted is omitted.
