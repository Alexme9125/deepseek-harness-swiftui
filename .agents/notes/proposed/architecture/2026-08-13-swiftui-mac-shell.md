# Agent Note: SwiftUI macOS shell reuses the Web client over loopback HTTP

Status: proposed

English | [中文](2026-08-13-swiftui-mac-shell.zh.md)

## Problem

The product GUI is a browser page served by `dsh web`. Operators must start Node themselves and keep a browser tab open. There is no macOS application window.

Rewriting the Client plugin tree in SwiftUI would duplicate [`packages/client/*`](../../../../packages/client/AGENTS.md) and the [`RpcMethodMap`](../../../../packages/host/apiproxy/src/api/rpc-map.ts) wire protocol. ACP and the SDK JSON-RPC protocol omit workspaces, settings, session resume, and the streaming transcript, so they cannot be the product window.

## Proposal

Add [`apps/macos`](../../../../apps/macos/README.md) as a SwiftUI application assembly. The window launches the existing `web` profile as a child process bound to `127.0.0.1` and loads that origin in WKWebView.

The shell does not reimplement Client packages or add an IPC `doFetch` carrier. It uses the HTTP carriage the [GUI layering note](../../implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md) already ships. Native File-menu actions, `NSOpenPanel`, and Dock or window folder drops dispatch a same-origin `dsh-native-command` event into that page so `ctx.workspaces` and SettingsRoot run the existing Web flows. A bundled web-host executable stays out of this change.

## Launch contract

Resolution uses the first match:

1. `DSH_BIN` when that path exists.
2. A bundled `dsh-web-host` executable when a later change copies one into the app.
3. `DSH_REPO`, the compile-time checkout derived from `#filePath`, or the process working directory, when that tree contains `apps/cli/src/bin.ts` — then `node --import tsx/esm apps/cli/src/bin.ts web`, the same vector as `pnpm dsh`.
4. `dsh` on a PATH that includes the login-shell PATH, `/opt/homebrew/bin`, and `/usr/local/bin`.

The shell binds a free `127.0.0.1` port, closes the probe socket, and passes `--host 127.0.0.1 --port <n>`. Readiness is a successful `GET /` at `http://127.0.0.1:<n>/`. The WebView must open that IPv4 loopback origin, not `localhost`, so the existing `/api` trust fence still treats the page as loopback. Quit sends SIGTERM to the child and SIGKILL if it does not exit.

The child's working directory is `DSH_CWD` when set, otherwise the resolved repository root, otherwise the user's home. A Finder-launched app must not inherit `/` as the default workspace root.

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

**Load `file://` dist while calling HTTP `/api`.** The document is cross-origin with `/api`, so privileged methods fail the [browser trust fence](../../implemented/architecture/2026-07-28-api-browser-trust-boundary.md).

**Implement the reserved Electron IPC carrier first.** That is the same Host assembly work as an Electron shell. A window does not require it.

**Keep the Xcode project in a separate repository.** The shell must resolve this checkout's `dsh` source launch and `apps/web/dist`.

**Click in-page DOM from `evaluateJavaScript`.** Button labels and slot structure change independently of the Mac chrome.

**`URLSession` POST `/api/workspace.create` from Swift.** That can register a path and the Host stream updates the list, but session navigation and the settings modal are not public `/api` methods.

**A public `window.openSettings()` Client API.** That widens the browser surface for one native host. The existing CustomEvent plus SettingsRoot local state is enough.

## Acceptance criteria

- [`apps/macos/DeepSeekHarness.xcodeproj`](../../../../apps/macos/DeepSeekHarness.xcodeproj/project.pbxproj) is a macOS 14+ / arm64 application that documents `xcodebuild` in [`apps/macos/README.md`](../../../../apps/macos/README.md).
- After `pnpm install` and `pnpm run build` in the same checkout, Run shows the Web workspace picker, or a native error that names the missing `dsh`, Node, or frontend dist.
- The child listens only on `127.0.0.1`. Quitting the app leaves no leftover `dsh` or Node child from that launch.
- File menu New Session, Add Workspace…, and Settings… drive the loaded Web client. Choosing or dropping a folder registers that path as a workspace and starts a session there.
- This change does not add an IPC carrier, App Sandbox, or a packaged web-host SEA.

## Risks

Linux CI cannot compile or run the app; a broken `project.pbxproj` is discovered only on a Mac. The JS command bus is covered by package tests; there is no assembled WKWebView snapshot on Linux.

A GUI process has a sparse `PATH`. Login-shell augmentation can still miss a Node install that exists only in a non-login rc file.

Reserving a port then closing the socket leaves a short window where another process can bind it; the shell reports the listen failure instead of scanning stdout for a different port.

App Sandbox stays off so the child can read arbitrary workspace paths and `$DSH_HOME`. Enabling it is a later product decision.

This note does not supersede the GUI layering note's Electron IPC reservation or the [client plugin loading](../../implemented/architecture/2026-07-23-client-plugin-loading-model.md) transport-swap seat. It adds one HTTP-using `apps/` assembly. The [workspace file-link](../../implemented/feature/2026-07-31-web-workspace-file-links.md) WebView remark remains about in-product file preview, not this product window.
