# macOS 应用

[English](README.md) | 中文

DeepSeek Harness 的 SwiftUI 产品窗口。应用把现有 `web` profile 作为 `127.0.0.1` 上的子进程启动，并在 WKWebView 中加载该源。它不重实现 Web 客户端。决策记录：[SwiftUI macOS 壳](../../.agents/notes/implemented/architecture/2026-08-13-swiftui-mac-shell.md)。

`.app` 内已构建的 `dsh-web-host` 是 web profile 的封闭 `@yao-pkg/pkg --sea` 可执行文件。它不是 Python SDK 的 JSON-RPC 运行时。当该二进制不存在时，应用回退到本 checkout 的 `dsh` 源码启动，或 PATH 上的 `dsh`。

## 前置条件

- Apple Silicon 上的 macOS 14 或更高版本
- Xcode 16 或更高版本
- 首次打包 `dsh-web-host`，或走源码启动时：Node.js `^22.19 || >=24` 与 Corepack pnpm，且来自 login shell
- 在本仓库中：DeepSeekHarness scheme 在编译前先运行 [`scripts/ensure-web-dist.sh`](scripts/ensure-web-dist.sh)，再运行 [`scripts/ensure-web-host.sh`](scripts/ensure-web-host.sh)。第一个脚本仅在缺少 `node_modules` 或 `apps/web/dist` 时执行 `pnpm install` / `pnpm run build`。第二个脚本在缺少 `apps/macos/dist/dsh-web-host` 时打包它，除非设置了 `DSH_SKIP_WEB_HOST_BUILD=1`。

## 从 Xcode 运行

从 Finder 或 Cursor 文件树打开 [`DeepSeekHarness.xcodeproj`](DeepSeekHarness.xcodeproj/project.pbxproj)。选择 **DeepSeekHarness** scheme 并 Run。第一次 Run 可能要几分钟来安装、构建 Web 前端并打包 `dsh-web-host`；之后若产物已存在会跳过。JavaScript 变更后若要重建捆绑宿主，删除 `apps/macos/dist/dsh-web-host`。共享 scheme 把工作目录设为仓库根（`$(SRCROOT)/../..`）。壳也会从 `LaunchResolver.swift` 的编译期 `#filePath` 识别本 checkout。

## 从命令行构建

在仓库根下：

```sh
pnpm run build
pnpm run build:macos-web-host -- --targets=node24-macos-arm64 --skip-build
```

在 `apps/macos` 下：

```sh
xcodebuild -scheme DeepSeekHarness -configuration Debug -destination 'platform=macOS,arch=arm64' build
```

`.app` 落在 Xcode 的 DerivedData 中。[`scripts/copy-web-host.sh`](scripts/copy-web-host.sh) 在 `dist/dsh-web-host` 与 `dist/dsh-web-host-spawn-helper` 存在时把它们复制进 `Contents/MacOS`。此 Linux CI checkout 无法运行 `xcodebuild`，也无法产出 macos-arm64 可执行文件。

## 内部分发

`pnpm run package:macos-app` 对 `arm64` 做 Release 构建，并写出 `apps/macos/dist/release/DeepSeekHarness-<版本>-<构建号>-arm64.zip`。该二进制缺失时它先打包 `dsh-web-host`，因为 `xcodebuild` 不执行 scheme pre-action。归档之前它要求两个嵌套可执行文件都在、`codesign --verify --deep --strict` 通过，并跑一次捆绑宿主的 `--help`。传 `--dry-run` 打印计划，或传 `--skip-web-host` 要求使用已有宿主而不重新打包。

接收方需要 macOS 14 或更高版本的 Apple Silicon 机器，不需要 Node。该 bundle 是 ad-hoc 签名，因此下载设置 quarantine 属性之后 Gatekeeper 会拒绝它：

```sh
xattr -dr com.apple.quarantine /Applications/DeepSeekHarness.app
```

这让该产物适合交给同事的构建，而不适合公开下载。决策记录与公开发布所需条件：[内部分发](../../.agents/notes/implemented/architecture/2026-08-14-macos-internal-distribution.md)。

## 应用图标

[`Assets.xcassets`](DeepSeekHarness/Assets.xcassets) 中的 `AppIcon` 持有 macOS 的十个槽位。用一张不小于 1024×1024 的方形 PNG 填满它们：

```sh
apps/macos/scripts/make-app-icon.sh path/to/icon.png
```

该脚本写出缩放后的 PNG，并用它们的文件名重写 `Contents.json`。在它运行之前槽位为空，构建会发出缺少图标的警告。

## 运行时解析

壳按第一次命中：

| 顺序 | 来源 | 调用 |
|---|---|---|
| 1 | `DSH_BIN` | `<DSH_BIN> web --host 127.0.0.1 --port <n>` |
| 2 | `.app` 内捆绑的 `dsh-web-host` | 相同 argv |
| 3 | `DSH_REPO`、编译期 checkout、或包含 `apps/cli/src/bin.ts` 的 cwd | `node --import tsx/esm apps/cli/src/bin.ts web --host 127.0.0.1 --port <n>` |
| 4 | 包含 login-shell PATH、`/opt/homebrew/bin` 和 `/usr/local/bin` 的 PATH 上的 `dsh` | `dsh web --host 127.0.0.1 --port <n>` |

可在 scheme 或启动 shell 中设置的可选环境变量：

| 变量 | 含义 |
|---|---|
| `DSH_BIN` | `dsh` 可执行文件的绝对路径 |
| `DSH_REPO` | 本仓库 checkout 的绝对路径 |
| `DSH_CWD` | 子进程工作目录（默认 workspace 根）。未设置时：已知则用 checkout，否则用用户 home——绝不用 `/` |
| `DSH_SKIP_WEB_HOST_BUILD` | 为 `1` 时，Xcode pre-action 不打包 `dsh-web-host` |

WebView 打开 `http://127.0.0.1:<n>/`，而不是 `localhost`。退出时发送 SIGTERM，然后 SIGKILL。子进程不继承应用的 `DYLD_*` 或 `__XPC_DYLD_*`：Xcode 调试会插入动态库，使捆绑的 Node SEA 宿主以 `kMagic` 中止。

部署根是 [`web-host/package.json`](web-host/package.json)（`dsh-web-host-pkg`）。向捆绑宿主添加插件，就是在该文件增加一行 `workspace:` 依赖后重新打包。[`scripts/verify-runtime-closure.ts`](../../scripts/verify-runtime-closure.ts) 要求该图中每个非可选的工作区对等依赖都列在部署根上。

## 原生窗口控件

File 菜单向已加载的 Web 客户端发送同源命令（`dsh-native-command` / `window.__dshNativeInvoke`）。决策记录：[SwiftUI macOS 壳](../../.agents/notes/implemented/architecture/2026-08-13-swiftui-mac-shell.md#native-command-contract)。

| 操作 | 快捷键 | 效果 |
|---|---|---|
| New Session | ⌘N | `workspaces.startSession()` |
| Add Workspace… | ⌘O | `NSOpenPanel`（仅目录），然后 `workspaces.create` 与 `startSession` |
| Settings… | ⌘, | 打开现有的设置模态 |

把文件夹拖到 Dock 图标、窗口，或把 `file://` 导航送进 WebView，都使用同一条 add-workspace 命令。产品窗口会在上次保存的窗口矩形至少为 960×640 时从 `UserDefaults` 恢复它。

## 限制

- App Sandbox 关闭，以便子进程能读取 workspace 目录和 `$DSH_HOME`。
- Intel Mac 不属于本 checkout。两个配置都把 `ARCHS` 钉为 `arm64`，因为 macOS 的默认值会构建出一个 universal 应用，而它的 Intel 分片会去 exec 只有 arm64 的宿主。
- 捆绑宿主是封闭插件集。`~/.dsh/profiles/web` 中不在 VFS 里的额外包不会加载。
- Linux CI 不编译此工程，也不产出 macos-arm64 可执行文件。
