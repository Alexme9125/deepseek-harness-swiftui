# macOS app

English | [中文](README.zh.md)

SwiftUI product window for DeepSeek Harness. The app launches the existing `web` profile as a child process on `127.0.0.1` and loads that origin in WKWebView. It does not reimplement the Web client. Decision record: [SwiftUI macOS shell](../../.agents/notes/proposed/architecture/2026-08-13-swiftui-mac-shell.md).

This checkout is the Phase-1 shell: you still need Node 24 and a built frontend on the same machine. A later phase copies a bundled web-host executable into the app.

## Prerequisites

- macOS 14 or later on Apple Silicon
- Xcode 16 or later
- Node.js `^22.19 || >=24` and Corepack pnpm, from a login shell so the app can find `node`
- In this repository: Node and pnpm on the login PATH. The DeepSeekHarness scheme runs [`scripts/ensure-web-dist.sh`](scripts/ensure-web-dist.sh) before compile and executes `pnpm install` / `pnpm run build` only when `node_modules` or `apps/web/dist` is missing.

## Run from Xcode

Open [`DeepSeekHarness.xcodeproj`](DeepSeekHarness.xcodeproj/project.pbxproj) from Finder or the Cursor file tree. Select the **DeepSeekHarness** scheme and Run. The first Run may take several minutes while it installs and builds the Web frontend; later Runs skip that when `apps/web/dist` exists. The shared scheme sets the working directory to the repository root (`$(SRCROOT)/..`). The shell also recognizes this checkout from the compile-time `#filePath` of `LaunchResolver.swift`.

## Build from the command line

From `apps/macos`:

```sh
xcodebuild -scheme DeepSeekHarness -configuration Debug -destination 'platform=macOS,arch=arm64' build
```

The `.app` lands under Xcode's DerivedData. This Linux CI checkout cannot run `xcodebuild`.

## Runtime resolution

The shell uses the first match:

| Order | Source | Invocation |
|---|---|---|
| 1 | `DSH_BIN` | `<DSH_BIN> web --host 127.0.0.1 --port <n>` |
| 2 | Bundled `dsh-web-host` (absent in Phase 1) | same argv |
| 3 | `DSH_REPO`, compile-time checkout, or cwd containing `apps/cli/src/bin.ts` | `node --import tsx/esm apps/cli/src/bin.ts web --host 127.0.0.1 --port <n>` |
| 4 | `dsh` on a PATH that includes the login-shell PATH, `/opt/homebrew/bin`, and `/usr/local/bin` | `dsh web --host 127.0.0.1 --port <n>` |

Optional environment variables, set in the scheme or the launching shell:

| Variable | Meaning |
|---|---|
| `DSH_BIN` | Absolute path to a `dsh` executable |
| `DSH_REPO` | Absolute path to this repository checkout |
| `DSH_CWD` | Child working directory (default workspace root). When unset: the checkout if known, otherwise the user's home — never `/` |

The WebView opens `http://127.0.0.1:<n>/`, not `localhost`. Quit sends SIGTERM, then SIGKILL.

## Limits

- App Sandbox is off so the child can read workspace directories and `$DSH_HOME`.
- Intel Macs and a self-contained `.app` without Node are out of this phase.
- Linux CI does not compile this project.
