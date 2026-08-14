# macOS app

English | [中文](README.zh.md)

SwiftUI product window for DeepSeek Harness. The app launches the existing `web` profile as a child process on `127.0.0.1` and loads that origin in WKWebView. It does not reimplement the Web client. Decision record: [SwiftUI macOS shell](../../.agents/notes/implemented/architecture/2026-08-13-swiftui-mac-shell.md).

A built `dsh-web-host` inside the `.app` is a closed `@yao-pkg/pkg --sea` executable of the web profile. It is not the Python SDK JSON-RPC runtime. When that binary is absent, the app falls back to this checkout's `dsh` source launch or `dsh` on PATH.

## Prerequisites

- macOS 14 or later on Apple Silicon
- Xcode 16 or later
- For the first packaging of `dsh-web-host`, or for source launch: Node.js `^22.19 || >=24` and Corepack pnpm, from a login shell
- In this repository: the DeepSeekHarness scheme runs [`scripts/ensure-web-dist.sh`](scripts/ensure-web-dist.sh) then [`scripts/ensure-web-host.sh`](scripts/ensure-web-host.sh) before compile. The first script runs `pnpm install` / `pnpm run build` only when `node_modules` or `apps/web/dist` is missing. The second packages `apps/macos/dist/dsh-web-host` when that file is missing, unless `DSH_SKIP_WEB_HOST_BUILD=1`.

## Run from Xcode

Open [`DeepSeekHarness.xcodeproj`](DeepSeekHarness.xcodeproj/project.pbxproj) from Finder or the Cursor file tree. Select the **DeepSeekHarness** scheme and Run. The first Run may take several minutes while it installs, builds the Web frontend, and packages `dsh-web-host`; later Runs skip those steps when the artifacts exist. Delete `apps/macos/dist/dsh-web-host` to rebuild the bundled host after JavaScript changes. The shared scheme sets the working directory to the repository root (`$(SRCROOT)/../..`). The shell also recognizes this checkout from the compile-time `#filePath` of `LaunchResolver.swift`.

## Build from the command line

From the repository root:

```sh
pnpm run build
pnpm run build:macos-web-host -- --targets=node24-macos-arm64 --skip-build
```

From `apps/macos`:

```sh
xcodebuild -scheme DeepSeekHarness -configuration Debug -destination 'platform=macOS,arch=arm64' build
```

The `.app` lands under Xcode's DerivedData. [`scripts/copy-web-host.sh`](scripts/copy-web-host.sh) copies `dist/dsh-web-host` and `dist/dsh-web-host-spawn-helper` into `Contents/MacOS` when they exist and signs those nested binaries. Incremental Runs also reseal the `.app` so macOS does not SIGKILL the host (status 9). A full link leaves sealing to Xcode CodeSign; resealing while the main binary is still unsigned fails the build (`code object is not signed at all`). This Linux CI checkout cannot run `xcodebuild` or produce the macos-arm64 executable.

## Runtime resolution

The shell uses the first match:

| Order | Source | Invocation |
|---|---|---|
| 1 | `DSH_BIN` | `<DSH_BIN> web --host 127.0.0.1 --port <n>` |
| 2 | Bundled `dsh-web-host` in the `.app` | same argv |
| 3 | `DSH_REPO`, compile-time checkout, or cwd containing `apps/cli/src/bin.ts` | `node --import tsx/esm apps/cli/src/bin.ts web --host 127.0.0.1 --port <n>` |
| 4 | `dsh` on a PATH that includes the login-shell PATH, `/opt/homebrew/bin`, and `/usr/local/bin` | `dsh web --host 127.0.0.1 --port <n>` |

Optional environment variables, set in the scheme or the launching shell:

| Variable | Meaning |
|---|---|
| `DSH_BIN` | Absolute path to a `dsh` executable |
| `DSH_REPO` | Absolute path to this repository checkout |
| `DSH_CWD` | Child working directory (default workspace root). When unset: the checkout if known, otherwise the user's home — never `/` |
| `DSH_SKIP_WEB_HOST_BUILD` | When `1`, the Xcode pre-action does not package `dsh-web-host` |

The WebView opens `http://127.0.0.1:<n>/`, not `localhost`. Quit sends SIGTERM, then SIGKILL. The child does not inherit `DYLD_*` or `__XPC_DYLD_*` from the app: Xcode debugging inserts libraries that make the bundled Node SEA host abort with `kMagic`.

The deploy root is [`web-host/package.json`](web-host/package.json) (`dsh-web-host-pkg`). Adding a plugin to the bundled host means adding one `workspace:` dependency there and repackaging. [`scripts/verify-runtime-closure.ts`](../../scripts/verify-runtime-closure.ts) requires every non-optional workspace peer of that graph to be listed on the deploy root.

## Native chrome

The File menu sends same-origin commands into the loaded Web client (`dsh-native-command` / `window.__dshNativeInvoke`). Decision record: [SwiftUI macOS shell](../../.agents/notes/implemented/architecture/2026-08-13-swiftui-mac-shell.md#native-command-contract).

| Action | Shortcut | Effect |
|---|---|---|
| New Session | ⌘N | `workspaces.startSession()` |
| Add Workspace… | ⌘O | `NSOpenPanel` (directories only), then `workspaces.create` and `startSession` |
| Settings… | ⌘, | Opens the existing settings modal |

Dropping a folder on the Dock icon, the window, or a `file://` navigation into the WebView uses the same add-workspace command. The product window restores its last frame from `UserDefaults` when that frame is at least 960×640.

## Limits

- App Sandbox is off so the child can read workspace directories and `$DSH_HOME`.
- Intel Macs are out of this checkout. The bundled host target is `node24-macos-arm64` only.
- A bundled host is a closed plugin set. Extra packages in `~/.dsh/profiles/web` that are not in the VFS do not load.
- Linux CI does not compile this project or emit the macos-arm64 executable.
- Xcode's console prints WebKit WebContent sandbox denials and App Intents `linkd.autoShortcut` XPC failures; they are not launch failures.
