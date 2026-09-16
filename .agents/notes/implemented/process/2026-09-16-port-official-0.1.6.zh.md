# Agent Note: 把官方 0.1.6-alpha.1 移植到 SwiftUI fork

Status: implemented

[English](2026-09-16-port-official-0.1.6.md) | 中文

## 问题

本个人 fork 上次跟踪的是官方 `dsh-v0.1.3-alpha.1`，外加 macOS SwiftUI 壳与封闭的 `dsh-web-host` SEA。官方 `master` 随后发布了 `dsh-v0.1.6-alpha.1`：会话格式 v3、Web 侧边栏终端、已归档会话恢复、MCP 资源、SSH 远端工作区、实验性 Browser Use 与 Computer Use、官方 profile 解析世代，以及 Electron 桌面宿主。继续停在 `0.1.3-alpha.1` 会隐藏这些产品变化，并让打包宿主仍指向已删除的 PTC 与工作流包名。

## 决策

把 `deepseek-ai/deepseek-harness` 的 `master` 在 `0d1f500`（`dsh-v0.1.6-alpha.1` 加上后续客户端启动优化）合入本 fork，并让个人产品走新的 API。[0.1.3 移植](2026-09-05-port-official-0.1.3.zh.md) 仍是方法：文本冲突优先采用官方文本（`-X theirs`），保留 `apps/macos/**`，并恢复 fork 专有触发器与页面命令总线。

`dsh-web-host` 以 `resolutionMode: 'runtime'` 调用 `runProfile`。官方 profile 解析世代取代本 fork 用 `bareModuleBaseUrl` 跳过 `healProfilesModuleFallback` 的做法。pkg SEA 还会设置 `process.pkg`，从而强制同一模式。页面上的 `dsh-native-command` 总线仍在 `packages/client/ui-workspace`。

GitHub Actions 只保留 `workflow_dispatch` / `workflow_call`，包括官方新增工作流（`node-addon-system`、加权审批、Issue 生命周期）。留下官方作业的 `if:` 字符串。

让 `scripts/verify-runtime-closure.ts` 同时检查 `python/sdk-runtime/package.json` 与 `apps/macos/web-host/package.json`。从官方 `web` 名册加上 Python runtime 闭包刷新宿主 `dependencies`，不含 ACP/SDK/webhook 应用额外项。

README 仍是 Alex 对 `dsh-v0.1.6-alpha.1` 的个人 SwiftUI 打包说明。

## 曾考虑的替代方案

**把 fork 提交 rebase 到官方 `master`。** macOS 树很大，官方历史是产品的权威记录；合并能保留两边祖先。

**继续从 `packaged-bin` 传入 `bareModuleBaseUrl`。** 官方打包可执行文件已经选择 runtime 解析；再加一层宿主父 URL 覆盖会重复该世代。

**在本 fork 上自动跑官方 PR/push CI 图。** 本 fork 没有那些作业所需的密钥预算。[fork Actions 说明](2026-08-19-fork-manual-github-actions.zh.md) 仍是实际执行哪些事件的权威。

## 后果

`SESSION_FORMAT_VERSION` 是 `3`。本 fork 在 `0.1.3-alpha.1` 树上写出的会话，没有相邻的 v2-to-v3 边就不保证能加载。打包宿主必须列出官方新增的每个 `web` 插件，否则 `verify-runtime-closure` 失败。手动 `workflow_dispatch` `ci.yml` / `ci-master.yml` 仍会让多数作业空转，因为这些工作流保留官方 `if:` 守卫。[SwiftUI macOS 壳说明](../architecture/2026-08-13-swiftui-mac-shell.zh.md) 保留产品窗口决策；本说明记录该产品如何跟踪官方 `master`。
