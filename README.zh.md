# DeepSeek Harness

[English](README.md) | 中文

本仓库是 Alex9125 对 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的**个人** macOS 打包。它不是 [DeepSeek AI](https://deepseek.com) 的官方产品，也不是 Darwin 动漫社的官方产品。

Alex（Alex Xiao）是 Darwin 动漫社技术部成员。本仓库是 Alex 的个人项目。这里的大量代码是在 [Cursor](https://cursor.com) 中用 Grok 和 Composer 编写的。

它构建于**一切皆插件**的架构之上，由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512)。

本 fork 增加了一个 SwiftUI macOS 应用：把现有 `web` profile 启动在 `127.0.0.1` 上，并在 WKWebView 中显示同一套 Web UI。`.app` 内捆绑 `dsh-web-host`，因此你不需要系统安装 Node。harness 源码跟踪官方 `dsh-v0.1.6-alpha.1`。

文档：[https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## 开发者预览

DeepSeek Harness 处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

运行本项目前，请阅读[安全说明](SAFETY.zh.md)。

## 安装

从 [GitHub Releases](https://github.com/Alexme9125/deepseek-harness-swiftui/releases/latest) 下载最新的 Apple Silicon `.dmg`。

1. 打开磁盘映像，把 `DeepSeekHarness.app` 拖进 Applications。
2. 该构建是 ad-hoc 签名、未经公证的。下载之后 Gatekeeper 会拦截，直到清除 quarantine：

```sh
xattr -dr com.apple.quarantine /Applications/DeepSeekHarness.app
```

3. 打开应用。选择 workspace。在设置中添加 DeepSeek API key。

需要 Apple Silicon 上的 macOS 14 或更高版本。不需要安装 Node。

## 插件

打包后的应用附带**封闭插件集**。`~/.dsh/profiles/web` 下不在捆绑快照里的额外包不会加载。这份 DMG 没有便捷的应用内插件安装器。

若仍要安装插件，使用下面任一方式。

### 从源码运行，然后 `dsh plugin add`

克隆本仓库，完成[从源码运行](#run-from-source)，并遵循[打包并安装插件](docs/user/develop/basic/publish.zh.md)。在本仓库目录中：

```sh
pnpm dsh plugin --profile web add <package>
pnpm dsh web
```

这条路径用 Node 解析器对着真实的 `node_modules` 树加载。它是加载应用中尚未包含的插件的受支持方式。

### 带着额外插件重建 `.app`

在 [`apps/macos/web-host/package.json`](apps/macos/web-host/package.json) 增加一行 `workspace:` 依赖，然后重新打包，使新包进入 SEA 快照。见 [macOS 应用](apps/macos/README.zh.md)。仍在使用上一份 DMG 的人，在安装新构建之前不会获得该插件。

<a id="run"></a>

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令默认会在 `http://127.0.0.1:3080` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.zh.md)。

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

`pnpm run build` 会准备仓库产物。`pnpm dsh web` 会直接使用这些已构建产物，不会重新构建。

### 从 Xcode 运行 macOS 应用

在 macOS 14+ / Apple Silicon 上，打开 [`apps/macos/DeepSeekHarness.xcodeproj`](apps/macos/README.zh.md) 并 Run。窗口会在 loopback 上启动 `web` profile，并显示同一套 Web UI。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 来源

harness 源码是 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 fork，由 DeepSeek AI 开发。本 fork 保留该插件架构，并增加 SwiftUI 产品窗口。

上游社区渠道与贡献政策仍在[上游仓库](https://github.com/deepseek-ai/deepseek-harness)。本个人 fork 不替代它们。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 引用

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
