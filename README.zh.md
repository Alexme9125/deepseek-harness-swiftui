# DeepSeek Harness

[English](README.md) | 中文

本 checkout 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的**个人** macOS 打包。它不是 [DeepSeek AI](https://deepseek.com) 的官方产品，也不是 Darwin 动漫社的官方产品。

Alex（Alex Xiao）是 Darwin 动漫社技工部成员。本仓库是 Alex 的个人项目。这里的大量代码是在 [Cursor](https://cursor.com) 中用 Grok 和 Composer 编写的。

## 它做什么

DeepSeek Harness（`dsh`）是开源 agent harness（智能体框架），架构为**一切皆插件**，由 [Cordis](https://github.com/cordiverse/cordis) 驱动。设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

本 fork 增加了一个 SwiftUI macOS 应用：把现有 `web` profile 启动在 `127.0.0.1` 上，并在 WKWebView 中显示同一套 Web UI。`.app` 内捆绑 `dsh-web-host`，因此接收方不需要系统安装 Node。

## 开发者预览

DeepSeek Harness 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

## 安装

从 [GitHub Releases](https://github.com/Alexme9125/deepseek-harness-swiftui/releases/latest) 下载最新的 Apple Silicon `.dmg`。

1. 打开磁盘映像，把 `DeepSeekHarness.app` 拖进 Applications。
2. 该构建是 ad-hoc 签名、未经公证的。下载之后 Gatekeeper 会拦截，直到清除 quarantine：

```sh
xattr -dr com.apple.quarantine /Applications/DeepSeekHarness.app
```

3. 打开应用。选择 workspace。在设置中添加 DeepSeek API key。

需要 Apple Silicon 上的 macOS 14 或更高版本。不需要安装 Node。决策记录：[内部分发](.agents/notes/implemented/architecture/2026-08-14-macos-internal-distribution.md)、[GitHub Release DMG](.agents/notes/implemented/architecture/2026-08-14-macos-dmg-github-release.md)。

## 插件

打包后的应用附带**封闭插件集**。`~/.dsh/profiles/web` 下不在捆绑快照里的额外包不会加载。这份 DMG 没有便捷的应用内插件安装器。

若仍要安装插件，使用下面任一方式。

### 从源码运行，然后 `dsh plugin add`

克隆本仓库，完成[从源码运行](#run-from-source)，并遵循[打包并安装插件](docs/user/develop/basic/publish.md)。在 checkout 中：

```sh
pnpm dsh plugin --profile web add <package>
pnpm dsh web
```

这条路径用 Node 解析器对着真实的 `node_modules` 树加载。它是加载应用中尚未包含的插件的受支持方式。

### 带着额外插件重建 `.app`

在 [`apps/macos/web-host/package.json`](apps/macos/web-host/package.json) 增加一行 `workspace:` 依赖，然后重新打包，使新包进入 SEA 快照。见 [macOS 应用](apps/macos/README.md)。上一份 DMG 的接收方在安装新构建之前不会获得该插件。

<a id="run"></a>

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令会启动 Web UI，默认地址为 `http://127.0.0.1:3080`。详见 [Web UI 指南](docs/user/guide/index.md)。

<a id="run-from-source"></a>

### 从源码运行

如需从本仓库源码运行：

```sh
git clone https://github.com/Alexme9125/deepseek-harness-swiftui.git
cd deepseek-harness-swiftui
pnpm install
pnpm run build
pnpm dsh web
```

### 从 Xcode 运行 macOS 应用

在 macOS 14+ / Apple Silicon 上，打开 [`apps/macos/DeepSeekHarness.xcodeproj`](apps/macos/README.md) 并 Run。窗口会在 loopback 上启动 `web` profile，并显示同一套 Web UI。

## 来源

harness 源码是 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 fork，由 DeepSeek AI 开发。本 fork 保留该插件架构，并增加 SwiftUI 产品窗口与 GitHub Release DMG。

上游社区渠道与贡献政策仍在[上游仓库](https://github.com/deepseek-ai/deepseek-harness)。本个人 fork 并不取代它们。

## 开发

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
