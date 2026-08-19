# Agent Note: 本个人 fork 仅按需运行 GitHub Actions

Status: implemented

[English](2026-08-19-fork-manual-github-actions.md) | 中文

## 问题

本仓库是 DeepSeek Harness 的个人 macOS 打包 fork。它继承了上游 GitHub Actions：那些作业需要企业级 runner 标签、内部自托管池、npm 与 PyPI 发布身份、`DEEPSEEK_API_KEY_EXTERNAL`、用于 Issue Project token 的 GitHub App，以及 Pages。它们在每次 push、每次 PR（Pull Request）以及每晚的 e2e 定时任务上失败。第一份 Apple Silicon GitHub Release 已经发布；自动的 npm pack、DMG tag 发布、CI、sandbox 与真实 API 运行不是本 fork 的产品。

## 决策

[`.github/workflows`](../../../../.github/workflows) 下的每个工作流保留其作业图，以便本地 YAML 测试仍能锁定 runner 隔离、故障切换开关和发布步骤。本仓库不订阅自动 GitHub 事件：`push`、`pull_request`、`pull_request_review`、`schedule` 和 `issues` 均不存在。剩余触发器是 `workflow_dispatch`，以及 Python wheel 包构建器的 `workflow_call`。[scripts/ci-workflow.spec.ts](../../../../scripts/ci-workflow.spec.ts) 拒绝这些文件上的任何其他事件键。

[macOS DMG 工作流](../architecture/2026-08-14-macos-dmg-github-release.md) 仅在被派发时发布。从 `macos-v*` ref 派发会发布该 tag；从其他 ref 派发会发布 `macos-snapshot-<sha>` 预发布。推送 tag 不会启动 runner。

描述企业级 CI、npm 序列、Issue 策略和 Python 发布的作业图 Agent Note 仍是那些 YAML 内容的权威。本 Note 是本仓库实际执行哪些 GitHub 事件的权威。

## 考虑过的替代方案

**删除工作流文件。** 本地测试解析这些 YAML 文件，数百篇 Agent Note 与文档链接它们。删除文件会把一次触发器改动换成仓库范围的文档与测试重写。

**保留 `on:`，并在每个作业上设置 `if: false`。** GitHub 仍会为每个事件排队一次运行。测试锁定精确的作业 `if:` 字符串，因此跳过还会改写那些断言。

**只在 GitHub UI 里禁用工作流。** 该状态无法在 git 中评审，之后一份内容相同的工作流文件可以再次启动。只要文件被当作新文件，每晚的 e2e 定时任务就会回来。

**保留 `macos-v*` tag 触发器。** 自动打包正是本 fork 刚为 `macos-v0.1.0` 完成的工作。从该 tag 派发仍会发布；默认情况下推送新 tag 不会消耗托管 macOS 分钟数。

## 后果

**买到：** 向 master 的 push、PR 以及每晚的 e2e cron 不会启动作业。npm pack、vendor pack、sandbox、Issue 策略、Issue 生命周期，以及等待 24 小时的自托管 CI 热备，都不会在本 fork 上排队。

**付出：** 本仓库没有上游矩阵、发布排练或 Issue Project 自动化的 GitHub 托管证明。本地钩子与选定测试仍然保留。之后的 DMG 需要手动派发，或在新的改动中恢复 tag 触发器。派发 CI 仍会请求本 fork 没有的企业级与自托管标签。
