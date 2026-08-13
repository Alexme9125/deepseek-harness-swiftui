# Agent Note: SwiftUI macOS 壳通过 loopback HTTP 复用 Web 客户端

Status: proposed

[English](2026-08-13-swiftui-mac-shell.md) | 中文

## Problem

产品 GUI 是由 `dsh web` 提供的浏览器页面。操作者必须自己启动 Node，并保持一个浏览器标签页打开。没有 macOS 应用窗口。

用 SwiftUI 重写 Client 插件树会重复实现 [`packages/client/*`](../../../../packages/client/AGENTS.md) 和 [`RpcMethodMap`](../../../../packages/host/apiproxy/src/api/rpc-map.ts) 线协议。ACP（Agent Client Protocol）与 SDK JSON-RPC 协议省略 workspace、设置、会话恢复和流式 transcript（文本记录），因此不能作为产品窗口。

## Proposal

新增 [`apps/macos`](../../../../apps/macos/README.md) 作为 SwiftUI 应用组装。该窗口把现有 `web` profile 作为绑定到 `127.0.0.1` 的子进程启动，并在 WKWebView 中加载该源。

该壳不重实现 Client 包，也不新增 IPC `doFetch` 载体。它使用 [GUI 分层说明](../../implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md) 已经交付的 HTTP 承载。原生 File 菜单操作、`NSOpenPanel` 以及 Dock 或窗口的文件夹拖放，向该页派发同源的 `dsh-native-command` 事件，使 `ctx.workspaces` 与 SettingsRoot 走现有 Web 流程。打包进应用的 web-host 可执行文件不进入本次改动。

## Launch contract

解析按第一次命中：

1. 当该路径存在时使用 `DSH_BIN`。
2. 后续改动把 `dsh-web-host` 可执行文件复制进应用后，使用该捆绑副本。
3. `DSH_REPO`、由 `#filePath` 得到的编译期 checkout、或进程工作目录，当该树包含 `apps/cli/src/bin.ts` 时——然后执行 `node --import tsx/esm apps/cli/src/bin.ts web`，与 `pnpm dsh` 同一向量。
4. 在包含 login-shell PATH、`/opt/homebrew/bin` 和 `/usr/local/bin` 的 PATH 上查找 `dsh`。

该壳绑定一个空闲的 `127.0.0.1` 端口，关闭探测套接字，并传入 `--host 127.0.0.1 --port <n>`。就绪条件是对 `http://127.0.0.1:<n>/` 的 `GET /` 成功。WebView 必须打开该 IPv4 loopback 源，而不是 `localhost`，以便现有 `/api` 信任栅栏仍把该页视为 loopback。退出时向子进程发送 SIGTERM，若未退出再发送 SIGKILL。

子进程工作目录在已设置时为 `DSH_CWD`，否则为解析到的仓库根，否则为用户 home。从 Finder 启动的应用不得把 `/` 继承为默认 workspace 根。

## Native command contract

页面全局暴露 `__dshNativeInvoke(detail)`，并监听 `CustomEvent('dsh-native-command', { detail })`。document-start 用户脚本把 invoke 调用排进 `__dshNativeQueue`，直到 [`dsh-client-runtime`](../../../../packages/client/runtime/src/client/native-command.ts) 的 apply 替换该桩。已知的 `detail.name` 值：

| name | 载荷 | 客户端效果 |
|---|---|---|
| `new-session` | 无 | `workspaces.startSession()` |
| `add-workspace` | `path`（非空字符串） | `workspaces.create({ path })`，然后 `startSession(workspaceId)` |
| `open-settings` | 无 | SettingsRoot 设置其本地模态打开状态 |

Swift 的 File 菜单 **New Session**（⌘N）、**Add Workspace…**（⌘O，仅目录的 `NSOpenPanel`）、**Settings…**（⌘,）、Dock / 窗口 / `file://` 文件夹拖放，以及 Open With，都会把这些命令入队。产品窗口会从 `UserDefaults` 恢复至少 960×640 的窗口矩形。凭据仍在 `$DSH_HOME/.credentials.yaml`。

## Alternatives considered

**用 SwiftUI 重写 GUI。** 这会分叉 Client 插件树和四象限 RPC 协议，而不是新增一个 `apps/` 组装。

**让 Swift 使用 ACP 或 SDK JSON-RPC。** 这些协议仅用于自动化，并省略 Web 产品界面。

**加载 `file://` dist 同时调用 HTTP `/api`。** 该文档与 `/api` 跨源，因此特权方法会无法通过[浏览器信任栅栏](../../implemented/architecture/2026-07-28-api-browser-trust-boundary.md)。

**先实现预留的 Electron IPC 载体。** 那与做一个 Electron 壳是同一级 Host 组装工作。要得到一个窗口并不需要它。

**把 Xcode 工程放在单独仓库。** 该壳必须解析本 checkout 的 `dsh` 源码启动和 `apps/web/dist`。

**用 `evaluateJavaScript` 点击页内 DOM。** 按钮文案和 slot 结构会独立于 Mac 窗口控件变化。

**让 Swift 用 `URLSession` POST `/api/workspace.create`。** 这可以登记路径，且 Host 流会更新列表，但会话导航和设置模态不是公开的 `/api` 方法。

**新增公开的 `window.openSettings()` Client API。** 那会为了一个原生宿主扩大浏览器界面。现有的 CustomEvent 加上 SettingsRoot 的本地状态已经足够。

## Acceptance criteria

- [`apps/macos/DeepSeekHarness.xcodeproj`](../../../../apps/macos/DeepSeekHarness.xcodeproj/project.pbxproj) 是一份 macOS 14+ / arm64 应用，并在 [`apps/macos/README.md`](../../../../apps/macos/README.md) 中记录 `xcodebuild`。
- 在同一 checkout 中完成 `pnpm install` 与 `pnpm run build` 后，Run 显示 Web 的 workspace 选择器，或显示原生错误并指出缺失的 `dsh`、Node 或前端 dist。
- 子进程只监听 `127.0.0.1`。退出应用后，该次启动不得留下残留的 `dsh` 或 Node 子进程。
- File 菜单的 New Session、Add Workspace… 和 Settings… 驱动已加载的 Web 客户端。选择或拖放文件夹会把该路径登记为 workspace，并在其中启动会话。
- 本次改动不新增 IPC 载体、App Sandbox，也不打包 web-host SEA。

## Risks

Linux CI 无法编译或运行该应用；损坏的 `project.pbxproj` 只能在 Mac 上发现。JS 命令总线由包测试覆盖；Linux 上没有组装后的 WKWebView 快照。

GUI 进程的 `PATH` 很稀疏。login-shell 增补仍可能找不到只存在于非 login rc 文件中的 Node 安装。

先预留端口再关闭套接字会留下短暂窗口，其他进程可能抢占该端口；壳报告监听失败，而不是从 stdout 扫描另一个端口。

App Sandbox 保持关闭，以便子进程能读取任意 workspace 路径和 `$DSH_HOME`。启用它属于后续产品决策。

本说明不取代 GUI 分层说明中的 Electron IPC 预留，也不取代 [Client 插件加载](../../implemented/architecture/2026-07-23-client-plugin-loading-model.md) 的传输替换席位。它新增一个使用 HTTP 的 `apps/` 组装。[workspace 文件链接](../../implemented/feature/2026-07-31-web-workspace-file-links.md) 中的 WebView 备注仍关于产品内文件预览，而不是本产品窗口。
