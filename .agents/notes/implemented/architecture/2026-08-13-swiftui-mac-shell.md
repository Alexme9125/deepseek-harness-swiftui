# Agent Note: SwiftUI macOS shell reuses the Web client over loopback HTTP

Status: implemented

English | [中文](2026-08-13-swiftui-mac-shell.zh.md)

## Problem

The product GUI is a browser page served by `dsh web`. Operators must start Node themselves and keep a browser tab open. There is no macOS application window.

Rewriting the Client plugin tree in SwiftUI would duplicate [`packages/client/*`](../../../../packages/client/AGENTS.md) and the [`RpcMethodMap`](../../../../packages/host/apiproxy/src/api/rpc-map.ts) wire protocol. ACP and the SDK JSON-RPC protocol omit workspaces, settings, session resume, and the streaming transcript, so they cannot be the product window.

## Decision

[`apps/macos`](../../../../apps/macos/README.md) is a SwiftUI application assembly. The window launches the existing `web` profile as a child process bound to `127.0.0.1` and loads that origin in WKWebView.

The shell does not reimplement Client packages or add an IPC `doFetch` carrier. It uses the HTTP carriage the [GUI layering note](2026-07-19-gui-layering-and-rpc-protocol.md) already ships. Native File-menu actions, `NSOpenPanel`, and Dock or window folder drops dispatch a same-origin `dsh-native-command` event into that page so `ctx.workspaces` and SettingsRoot run the existing Web flows.

The `.app` may embed `dsh-web-host`, a closed `@yao-pkg/pkg --sea` executable of the web profile. That product is not [`dsh-jsonrpc-agent-pkg`](2026-07-10-single-file-executable-sdk-runtime-distribution.md): the JSON-RPC exe boots an external `cordis.yml` over stdio and has no Host webserver or frontend dist. The web-host deploy root is [`apps/macos/web-host/package.json`](../../../../apps/macos/web-host/package.json). Its packaged entry is [`apps/cli/src/packaged-bin.ts`](../../../../apps/cli/src/packaged-bin.ts), which calls `runProfile` with `bareModuleBaseUrl` so bare plugins resolve from the VFS. App Sandbox stays off.

## Launch contract

Resolution uses the first match:

1. `DSH_BIN` when that path exists.
2. A bundled `dsh-web-host` executable copied into `Contents/MacOS`.
3. `DSH_REPO`, the compile-time checkout derived from `#filePath`, or the process working directory, when that tree contains `apps/cli/src/bin.ts` — then `node --import tsx/esm apps/cli/src/bin.ts web`, the same vector as `pnpm dsh`.
4. `dsh` on a PATH that includes the login-shell PATH, `/opt/homebrew/bin`, and `/usr/local/bin`.

The shell binds a free `127.0.0.1` port, closes the probe socket, and passes `--host 127.0.0.1 --port <n>`. Readiness is a successful `GET /` at `http://127.0.0.1:<n>/`. The WebView must open that IPv4 loopback origin, not `localhost`, so the existing `/api` trust fence still treats the page as loopback. Quit sends SIGTERM to the child and SIGKILL if it does not exit.

The child's working directory is `DSH_CWD` when set, otherwise the resolved repository root, otherwise the user's home. A Finder-launched app must not inherit `/` as the default workspace root.

The Xcode scheme packages `dsh-web-host` on first Run when `apps/macos/dist/dsh-web-host` is missing. Linux CI cannot emit `node24-macos-arm64`. Intel Macs are out of scope.

## Native command contract

The page global exposes `__dshNativeInvoke(detail)` and listens for `CustomEvent('dsh-native-command', { detail })`. A document-start user script queues invoke calls on `__dshNativeQueue` until [`dsh-client-runtime`](../../../../packages/client/runtime/src/client/native-command.ts) apply replaces the stub. Known `detail.name` values:

| name | Payload | Client effect |
|---|---|---|
| `new-session` | none | `workspaces.startSession()` |
| `add-workspace` | `path` (non-empty string) | `workspaces.create({ path })` then `startSession(workspaceId)` |
| `open-settings` | none | SettingsRoot sets its local modal open state |

Swift File menu **New Session** (⌘N), **Add Workspace…** (⌘O, `NSOpenPanel` directories only), **Settings…** (⌘,), Dock / window / `file://` folder drops, and Open With all enqueue those commands. The product window restores a `UserDefaults` frame of at least 960×640. Credentials stay in `$DSH_HOME/.credentials.yaml`.

## Alternatives considered

**Rewrite the GUI in SwiftUI.** That forks the Client plugin tree and the four-quadrant RPC protocol instead of adding an `apps/` assembly.

**Speak ACP or SDK JSON-RPC from Swift.** Those protocols are automation-only and omit the Web product surfaces.

**Load `file://` dist while calling HTTP `/api`.** The document is cross-origin with `/api`, so privileged methods fail the [browser trust fence](2026-07-28-api-browser-trust-boundary.md).

**Implement the reserved Electron IPC carrier first.** That is the same Host assembly work as an Electron shell. A window does not require it.

**Keep the Xcode project in a separate repository.** The shell must resolve this checkout's `dsh` source launch and `apps/web/dist`.

**Click in-page DOM from `evaluateJavaScript`.** Button labels and slot structure change independently of the Mac chrome.

**`URLSession` POST `/api/workspace.create` from Swift.** That can register a path and the Host stream updates the list, but session navigation and the settings modal are not public `/api` methods.

**A public `window.openSettings()` Client API.** That widens the browser surface for one native host. The existing CustomEvent plus SettingsRoot local state is enough.

**Reuse `dsh-jsonrpc-agent-pkg` as the bundled host.** That closure is the Python SDK stdio JSON-RPC runtime. It has no web frontend, no Host webserver, and no `dsh web` profile.

**Enable App Sandbox.** The child must read arbitrary workspace paths and `$DSH_HOME`. Enabling the sandbox is a later product decision.

## Consequences

**Bought:** a macOS product window over the existing Web client; File-menu and folder-drop chrome that drive `ctx.workspaces` and SettingsRoot; a Node-less `.app` when `dsh-web-host` is present; source launch still works when the binary is absent.

**Paid:** Linux CI cannot compile the app or produce the macos-arm64 exe; a broken `project.pbxproj` is discovered only on a Mac. The JS command bus is covered by package tests; there is no assembled WKWebView snapshot on Linux. A GUI process has a sparse `PATH`. Login-shell augmentation can still miss a Node install that exists only in a non-login rc file. Reserving a port then closing the socket leaves a short window where another process can bind it; the shell reports the listen failure instead of scanning stdout for a different port. The bundled host is a closed plugin set: extra packages in `~/.dsh/profiles/web` that are not in the VFS do not load. First Xcode Run that packages the host is slow; later Runs reuse `apps/macos/dist/dsh-web-host` until that file is deleted.

This note does not supersede the GUI layering note's Electron IPC reservation or the [client plugin loading](2026-07-23-client-plugin-loading-model.md) transport-swap seat. It adds one HTTP-using `apps/` assembly. The [workspace file-link](../feature/2026-07-31-web-workspace-file-links.md) WebView remark remains about in-product file preview, not this product window.
