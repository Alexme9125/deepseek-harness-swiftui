# macOS 应用

[English](README.md) | 中文

DeepSeek Harness 的 SwiftUI 产品窗口。应用把现有 `web` profile 作为 `127.0.0.1` 上的子进程启动，并在 WKWebView 中加载该源。它不重实现 Web 客户端。决策记录：[SwiftUI macOS 壳](../../.agents/notes/proposed/architecture/2026-08-13-swiftui-mac-shell.md)。

本 checkout 是第 1 期壳：同一台机器上仍需要 Node 24 和已构建的前端。后续阶段会把打包的 web-host 可执行文件复制进应用。

## 前置条件

- Apple Silicon 上的 macOS 14 或更高版本
- Xcode 16 或更高版本
- Node.js `^22.19 || >=24` 与 Corepack pnpm，且来自 login shell，以便应用能找到 `node`
- 在本仓库中：login PATH 上有 Node 与 pnpm。DeepSeekHarness scheme 在编译前运行 [`scripts/ensure-web-dist.sh`](scripts/ensure-web-dist.sh)，仅在缺少 `node_modules` 或 `apps/web/dist` 时执行 `pnpm install` / `pnpm run build`。

## 从 Xcode 运行

从 Finder 或 Cursor 文件树打开 [`DeepSeekHarness.xcodeproj`](DeepSeekHarness.xcodeproj/project.pbxproj)。选择 **DeepSeekHarness** scheme 并 Run。第一次 Run 可能要几分钟来安装并构建 Web 前端；之后若已有 `apps/web/dist` 会跳过。共享 scheme 把工作目录设为仓库根（`$(SRCROOT)/..`）。壳也会从 `LaunchResolver.swift` 的编译期 `#filePath` 识别本 checkout。

## 从命令行构建

在 `apps/macos` 下：

```sh
xcodebuild -scheme DeepSeekHarness -configuration Debug -destination 'platform=macOS,arch=arm64' build
```

`.app` 落在 Xcode 的 DerivedData 中。此 Linux CI checkout 无法运行 `xcodebuild`。

## 运行时解析

壳按第一次命中：

| 顺序 | 来源 | 调用 |
|---|---|---|
| 1 | `DSH_BIN` | `<DSH_BIN> web --host 127.0.0.1 --port <n>` |
| 2 | 捆绑的 `dsh-web-host`（第 1 期不存在） | 相同 argv |
| 3 | `DSH_REPO`、编译期 checkout、或包含 `apps/cli/src/bin.ts` 的 cwd | `node --import tsx/esm apps/cli/src/bin.ts web --host 127.0.0.1 --port <n>` |
| 4 | 包含 login-shell PATH、`/opt/homebrew/bin` 和 `/usr/local/bin` 的 PATH 上的 `dsh` | `dsh web --host 127.0.0.1 --port <n>` |

可在 scheme 或启动 shell 中设置的可选环境变量：

| 变量 | 含义 |
|---|---|
| `DSH_BIN` | `dsh` 可执行文件的绝对路径 |
| `DSH_REPO` | 本仓库 checkout 的绝对路径 |
| `DSH_CWD` | 子进程工作目录（默认 workspace 根）。未设置时：已知则用 checkout，否则用用户 home——绝不用 `/` |

WebView 打开 `http://127.0.0.1:<n>/`，而不是 `localhost`。退出时发送 SIGTERM，然后 SIGKILL。

## 限制

- App Sandbox 关闭，以便子进程能读取 workspace 目录和 `$DSH_HOME`。
- Intel Mac 以及不带 Node 的自包含 `.app` 不属于本阶段。
- Linux CI 不编译此工程。
