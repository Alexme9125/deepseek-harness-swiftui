# DeepSeek Harness

English | [中文](README.zh.md)

This repository is Alex Xiao's **personal** macOS packaging of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It is not an official [DeepSeek AI](https://deepseek.com) product, and it is not an official Darwin Anime Club product.

Alex (Alex Xiao) is a member of the Darwin Anime Club (Darwin 动漫社) technical department. This repository is Alex's personal project. A large part of the code here was written in [Cursor](https://cursor.com) with Grok and Composer.

## What it does

DeepSeek Harness (`dsh`) is an open-source agent harness whose architecture is **everything is a plugin**, powered by [Cordis](https://github.com/cordiverse/cordis). The design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

This fork adds a SwiftUI macOS app that launches the existing `web` profile on `127.0.0.1` and shows that Web UI in WKWebView. The `.app` bundles `dsh-web-host`, so you do not need a system Node install.

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Install

Download the latest Apple Silicon `.dmg` from [GitHub Releases](https://github.com/Alexme9125/deepseek-harness-swiftui/releases/latest).

1. Open the disk image and drag `DeepSeekHarness.app` to Applications.
2. The build is ad-hoc signed and not notarized. After a download, Gatekeeper blocks it until quarantine is cleared:

```sh
xattr -dr com.apple.quarantine /Applications/DeepSeekHarness.app
```

3. Open the app. Choose a workspace. In Settings, add a DeepSeek API key.

Requires macOS 14 or later on Apple Silicon. No Node installation is needed.

## Plugins

The packaged app ships a **closed plugin set**. Extra packages under `~/.dsh/profiles/web` that are not in the bundled snapshot do not load. There is no convenient in-app plugin installer on this DMG.

To install a plugin anyway, use one of the following.

### Run from source, then `dsh plugin add`

Clone this repository, complete [Run from source](#run-from-source), and follow [Package and install a plugin](docs/user/develop/basic/publish.md). From the checkout:

```sh
pnpm dsh plugin --profile web add <package>
pnpm dsh web
```

That path uses Node's resolver against a real `node_modules` tree. It is the supported way to load a plugin that is not already in the app.

### Rebuild the `.app` with extra plugins

Add a `workspace:` dependency on [`apps/macos/web-host/package.json`](apps/macos/web-host/package.json), then re-package so the new package is copied into the SEA snapshot. See [macOS app](apps/macos/README.md). Anyone still on the previous DMG does not pick up that plugin until they install the new build.

<a id="run"></a>

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI, served at `http://127.0.0.1:3080` by default. See [Web UI guide](docs/user/guide/index.md).

<a id="run-from-source"></a>

### Run from source

To run from this repository checkout:

```sh
git clone https://github.com/Alexme9125/deepseek-harness-swiftui.git
cd deepseek-harness-swiftui
pnpm install
pnpm run build
pnpm dsh web
```

### Run the macOS app from Xcode

On macOS 14+ / Apple Silicon, open [`apps/macos/DeepSeekHarness.xcodeproj`](apps/macos/README.md) and Run. The window launches the `web` profile on loopback and shows the same Web UI.

## Origin

The harness source is a fork of [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness), developed by DeepSeek AI. This fork keeps that plugin architecture and adds the SwiftUI product window.

Upstream community channels and contribution policy remain on the [upstream repository](https://github.com/deepseek-ai/deepseek-harness). This personal fork does not replace them.

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
