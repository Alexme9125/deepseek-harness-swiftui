# Agent Note: client-modules resolves dsh.client packages from the host tree

Status: implemented

English | [中文](2026-08-14-client-modules-host-package-resolve.zh.md)

## Problem

After packaged `dsh-web-host` booted, the WKWebView showed **Failed to load plugins** / `@deepseek-ai/dsh-client-app-shell` pending for `slots`, `sessions`, and `layout`. Those services come from `dsh-client-runtime` and `dsh-client-ui-layout`, which are ordinary web-bundle roster rows. The host process was up; the browser graph did not contain them.

The client-modules node half resolves each Loader entry's `package.json` with `createRequire(ctx.baseUrl)` — the profile directory. A closed packaged host skips `healProfilesModuleFallback` ([loader.create host parent](2026-08-14-loader-create-honors-bare-module-base.md)), and pkg will not walk `$DSH_HOME/profiles/node_modules` from that parent. `resolveMeta` treats `MODULE_NOT_FOUND` as "not a client package" (the same path as `cordis:include`), so every `dsh.client` row vanished from `window.__DSH_BOOT__`. The shell still mounts app-shell, which waits forever for services that no graph row will provide.

## Decision

Package lookup tries the configuration directory, then this package's own tree (`createRequire(import.meta.url)`), which in a hoisted VFS or deployed closure is the closed `node_modules`. When `import.meta.url` is under `/snapshot/`, the host tree is first so leftover on-disk fallback links cannot shadow the closed set.

## Alternatives considered

**Fail activation when the profile directory cannot resolve a `dsh.client` row.** Louder than an empty graph, but a packaged host would still not boot; the packages are in the VFS, not missing.

**Heal snapshot-incompatible symlinks into `$DSH_HOME/profiles/node_modules` anyway.** Those links cannot point into `/snapshot/`; profile-boot already skips the healer for that reason.

## Consequences

Packaged web-host serves the same client roster as source launch. A name that exists only under `~/.dsh/profiles/web` still does not enter a snapshot graph.

## Testing

`packages/client/modules/tests/node-half.client.spec.ts` constructs the node half over an empty config directory with the modules package itself as a Loader entry (host-resolvable) and expects a graph row or a missing-bundle composition error, not a silent empty graph. A second case writes that same name under the config `node_modules` and expects that path to win.
