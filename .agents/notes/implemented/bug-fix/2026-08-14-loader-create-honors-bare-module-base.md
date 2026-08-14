# Agent Note: loader.create honors bareModuleBaseUrl

Status: implemented

English | [中文](2026-08-14-loader-create-honors-bare-module-base.zh.md)

## Problem

Packaged `dsh-web-host` exited at boot with status 1: `directory-picker-auto` could not import `@deepseek-ai/dsh-host-directory-picker-native` from `/Users/…/.dsh/profiles/web/`. The native package is in the web-host closure. Config-row plugins already resolve from the VFS because `mountRootInclude` wraps Include when `bareModuleBaseUrl` is set. `ctx.loader.create` uses the Loader's own `EntryTree.import`, which calls `internal.import(name, ctx.baseUrl)` — the profile directory. The web chooser mounts its backend that way after probing bind-host / SSH / display, so the first packaged-host `loader.create` of a bare name failed. Source launch is unaffected: `healProfilesModuleFallback` still links installation packages into `$DSH_HOME/profiles/node_modules`.

## Decision

When `bareModuleBaseUrl` is set, `mountRootInclude` proxies `ctx.loader.internal` so every `internal.import` of a non-relative, non-filesystem-absolute specifier uses that host URL as parent. The proxy does not mutate Node's process-wide cascaded loader; HMR methods bind back to the real object. Relative `loader.create` names stay config-directory-relative. Profile-boot HMR and timer rows pass bare package names.

## Alternatives considered

**Resolve only inside `directory-picker-auto` via `import.meta.resolve`.** That would unstick this chooser and leave the next `loader.create('@deepseek-ai/…')` in a packaged host as the same failure.

**Pass file URLs from every `loader.create` call site, as profile-boot HMR did.** Each new dynamic mount would relearn the hole; Include and `loader.create` would keep different parents.

## Consequences

A closed runtime that passes `bareModuleBaseUrl` loads dynamically mounted bare plugins from the installed host, matching config rows. Extra packages that exist only under `~/.dsh/profiles/web` still do not load from a snapshot VFS.

## Testing

`packages/boot/app-boot/tests/app-boot.spec.ts` boots with a harness `bareModuleBaseUrl` whose `dsh-created-bare` package shadows a different copy beside the config, then `loader.create`s that bare name, a relative sibling, and an absolute path, and expects the harness copy plus both config-relative files.
