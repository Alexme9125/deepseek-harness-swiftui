# Agent Note: 本 fork 把 ad-hoc 签名的 macOS DMG 发布为 GitHub Release

Status: implemented

[English](2026-08-14-macos-dmg-github-release.md) | 中文

## Problem

[内部分发](2026-08-14-macos-internal-distribution.md) 在一台装了 Xcode 的 Mac 上产出 ad-hoc 签名的 zip。本个人 fork 的接收方仍须通过线下来获取该 zip。根 README 仍在描述官方 DeepSeek Harness 项目，因此 Darwin 动漫社的读者无法判断本 checkout 是什么、谁拥有它、如何安装应用，以及捆绑宿主无法加载额外插件。

经过公证的 Developer ID 构建仍然被 library validation 拦住：未签名的 `.node` addon 会解压到 `~/.cache/pkg`。等待这项工作完成，会让本 fork 一直没有可下载的应用。

## Decision

[`scripts/package-app.ts`](../../../../apps/macos/scripts/package-app.ts) 在现有 zip 旁边写出 UDZO DMG：它把 `DeepSeekHarness.app` 与 `/Applications` 符号链接放进 staging，并运行 `hdiutil create -format UDZO`。Gatekeeper 行为与 zip 相同；DMG 是 GitHub Release 的呈现方式。

[`.github/workflows/macos-dmg-release.yml`](../../../../.github/workflows/macos-dmg-release.yml) 跑在 `macos-15`（Apple Silicon）上。从 `macos-v*` ref 做 `workflow_dispatch` 会发布该 tag；从其他 ref 派发会发布 `macos-snapshot-<sha>` 预发布。推送 tag 不会启动作业（[按需 GitHub Actions](../process/2026-08-19-fork-manual-github-actions.md)）。该作业安装依赖、运行 `pnpm run package:macos-app`，并以 `contents: write` 挂上那一个 `DeepSeekHarness-*-arm64.dmg`。Linux CI 仍然无法产出该镜像；该工作流就是打包机。

根 README 是本 fork 的产品页：个人所有权（Alex Xiao，Darwin 动漫社技工部成员；不是 DeepSeek AI 或 Darwin 动漫社的官方产品）、Cursor/Grok/Composer 的作者身份、含 quarantine 命令的 DMG 安装、封闭插件集，以及两种添加插件的方式（[从源码 `dsh plugin add`](../../../../docs/user/develop/basic/publish.md)，或在 [`web-host/package.json`](../../../../apps/macos/web-host/package.json) 增加 `workspace:` 行后重建）。`#run` 与 `#run-from-source` 对入站文档仍然有效。

## Alternatives considered

**继续私下交付 zip，并保留上游 README。** 否决：本 fork 面向用户的约定是 GitHub Release，外加一份写明所有权、来源、安装与插件限制的 README。

**等待 Developer ID、Hardened Runtime 和公证。** 作为本次个人发布予以否决：[library validation 冲突](2026-08-14-macos-internal-distribution.md) 仍未解决，而对已经接受 zip 上同一条 `xattr` 命令的社团成员来说，带显式 `xattr` 步骤的 ad-hoc DMG 已经够用。

**只把 zip 上传到 Release。** 否决：带 Applications 符号链接的 DMG 才是 README 描述的安装路径。zip 仍是打包副产物。

**在 Linux cloud agent 上构建 DMG。** 不可能：`xcodebuild` 和 `hdiutil` 需要 macOS。GitHub 托管的 `macos-15` runner 才是打包主机。

**在每个 PR 上触发打包。** 否决：在 Apple Silicon 上跑 `pnpm run build` 再对 web-host 做 `@yao-pkg/pkg --sea`，作为必过检查过于昂贵。

## Consequences

**买到：** 从 `macos-v*` ref 派发一次运行会产出一个 GitHub Release，其资产是 Apple Silicon DMG。README 写明这是 Alex 的个人项目、点出 Darwin 动漫社所属但不宣称社团所有权、披露 Cursor/Grok/Composer 作者身份，并告诉接收方：插件无法便捷装进这份 DMG，以及如何从源码添加或通过重建添加。

**付出：** 下载之后 Gatekeeper 仍会拦截，直到对 `.app` 执行 `xattr -dr com.apple.quarantine`；该命令同时解除对该 bundle 内其他内容的检查。该 Release 未经公证，也没有更新通道。`workflow_dispatch` 的 snapshot tag 是 `macos-v*` 之外的第二套标识。托管 macOS runner 按分钟计费；打包失败的作业仍会跑完整的 `pnpm run build`。翻译提示词的金标配对包含根 README，因此改 README 会刷新该快照。
