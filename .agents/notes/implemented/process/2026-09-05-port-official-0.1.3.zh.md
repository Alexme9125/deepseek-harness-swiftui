# Agent Note: 把官方 0.1.3-alpha.1 移植到 SwiftUI fork

Status: implemented

[English](2026-09-05-port-official-0.1.3.md) | 中文

## 问题

本个人 fork 上次跟踪的是官方 `0.1.0-rc.5`，外加 macOS SwiftUI 壳与封闭的 `dsh-web-host` SEA。官方 `master` 随后发布了 `0.1.3-alpha.1`：会话格式 v2、`SessionHandle`、HTTP 代理环境变量、通用文件上传、skill 模糊搜索、可点击链接统一、ACP/MCP/webhook 界面，以及把 `dsh-client-runtime` 拆成 `connection` / `store` / `ui-session` / `ui-workspace`。继续停在旧树上会隐藏这些产品变化，并让 macOS 宿主仍指向已删除的包。

## 决策

把 `deepseek-ai/deepseek-harness` 的 `master` 在 `dsh-v0.1.3-alpha.1` 合入本 fork，并让个人产品走新的 API。

文本冲突优先采用官方文本（`-X theirs`）。丢掉残留的 `packages/client/runtime` 与已退役的 `knip.json`。

保留 `apps/macos/**`、`apps/cli/src/packaged-bin.ts`、`bin.dsh-web-host` 与 `bareModuleBaseUrl`。该 URL 已设置时，`composeProfile` 跳过 `healProfilesModuleFallback`，因此 `~/.dsh/profiles/web` 下的额外包不会进入 SEA。

把页面上的 `dsh-native-command` 总线迁到 `packages/client/ui-workspace`（`IWorkspaces.create`、`UiWorkspace.startSession`）。不要从公开的 `/client` barrel 导出它。官方 `@deepseek-ai/dsh-native-command` 包仍是 Host 的免 shell 运行器。

GitHub Actions 只保留 `workflow_dispatch` / `workflow_call`。留下官方的 `if:` 字符串，因此手动派发时多数作业仍会跳过。

让 `scripts/verify-runtime-closure.ts` 同时检查 `python/sdk-runtime/package.json` 与 `apps/macos/web-host/package.json`。把宿主 `dependencies` 刷新为官方 `web` 名册（不含 ACP/SDK/webhook 额外项）。

README 仍是 Alex 对 `dsh-v0.1.3-alpha.1` 的个人 SwiftUI 打包说明。

## 曾考虑的替代方案

**把 fork 提交 rebase 到官方 `master`。** macOS 树很大，官方历史是产品的权威记录；合并能保留两边祖先。

**把页面命令总线留在复活的 `dsh-client-runtime` 上。** 官方已删除该包；workspace UI 已经拥有 create 与 start。

**在本 fork 上自动跑官方 PR/push CI 图。** 本 fork 没有那些作业所需的密钥预算。[fork Actions 说明](2026-08-19-fork-manual-github-actions.zh.md) 仍是实际执行哪些事件的权威。

## 后果

`SESSION_FORMAT_VERSION` 现在是 `2`。本 fork 在 `0.1.0-rc.5` 时代留下的磁盘会话不保证能加载。打包宿主必须列出官方新增的每个 `web` 插件，否则 `verify-runtime-closure` 失败。手动 `workflow_dispatch` `ci.yml` / `ci-master.yml` 仍会让多数作业空转，因为这些工作流保留官方 `if:` 守卫。[SwiftUI macOS 壳说明](../architecture/2026-08-13-swiftui-mac-shell.zh.md) 保留产品窗口决策；本说明记录该产品如何跟踪官方 `master`。
