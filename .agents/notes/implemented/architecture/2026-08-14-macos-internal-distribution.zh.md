# Agent Note: macOS 应用以 ad-hoc 签名分发给内部测试

Status: implemented

[English](2026-08-14-macos-internal-distribution.md) | 中文

## Problem

[`apps/macos`](../../../../apps/macos/README.md) 只能在 checkout 上通过 Xcode Run 构建。测试[产品窗口](2026-08-13-swiftui-mac-shell.md)需要克隆仓库、Node 和 pnpm，而这恰恰是捆绑 `dsh-web-host` 要消除的门槛。

公开下载需要 Developer ID 签名、Hardened Runtime 和公证。Hardened Runtime 会启用 library validation，而 `@yao-pkg/pkg --sea` 在插件初始化时把未签名的 `.node` addon（node-pty、sharp 及其 libvips dylib、`node-addon-require-builtin`）解压到 `~/.cache/pkg` 再 `dlopen`，所以当前 bundle 在该运行时下会被杀掉。若内部测试要等这项工作完成，应用就只能在一台机器之外始终未经验证。

## Decision

[`scripts/package-app.ts`](../../../../apps/macos/scripts/package-app.ts)（`pnpm run package:macos-app`）产出一个 ad-hoc 签名的 zip 以及一份 UDZO DMG（应用外加 `/Applications` 符号链接）。接收方需要 macOS 14 或更高版本的 Apple Silicon 机器，不需要 Node。[本 fork 的 GitHub Release](2026-08-14-macos-dmg-github-release.md) 发布该 DMG。

`apps/macos/dist/dsh-web-host` 不存在时该脚本自行打包它，因为 `xcodebuild` 不执行 Xcode Run 所用的 scheme pre-action。它对 `arm64` 做 Release 的 clean 构建，把 `MARKETING_VERSION` 取自仓库版本前导的 `x.y.z`、`CURRENT_PROJECT_VERSION` 取自本 checkout 的提交计数，再用 `ditto -c -k --sequesterRsrc --keepParent` 与 `hdiutil create -format UDZO` 归档。

归档之前它要求两个嵌套可执行文件（`dsh-web-host`、`dsh-web-host-spawn-helper`）都在、`codesign --verify --deep --strict` 通过，并用一个临时 `DSH_HOME` 跑一次捆绑 host 的 `--help`。接收方没有源码启动兜底，所以缺失的 host 或损坏的 bundle 封签必须在打包机上失败；未封签的嵌套 helper 否则会以 SIGKILL 死掉（[嵌套签名](2026-08-13-swiftui-mac-shell.md#launch-contract)）。

两个构建配置都把 `ARCHS` 钉为 `arm64`。macOS 的默认值是 `arm64 x86_64`，那会产出一个 universal 应用，而它的 Intel 分片会去 exec 只有 arm64 的 host。

应用图标是真实的 `AppIcon` 资源目录集合，取自与 [`website/public/favicon.svg`](../../../../website/public/favicon.svg) 相同的那条鲸鱼：白色标识放在 `#4D6BFE` 的超椭圆主体上，留白按 Apple 图标网格的 824/1024。macOS 图标要自带圆角主体，所以一个铺满画布的裸图形在 Dock 里会显得过大，深色图形还会消失在其中。[`scripts/make-app-icon.sh`](../../../../apps/macos/scripts/make-app-icon.sh) 用 `sips` 从一张方形源 PNG 重新填满这十个槽位。

## Alternatives considered

**分发 DMG。** DMG 改变的是呈现方式而不是信任：ad-hoc 签名在下载之后依然过不了 Gatekeeper。打包流程仍会写出该 DMG，以便[本 fork 把它挂到 GitHub Release](2026-08-14-macos-dmg-github-release.md)；在 Gatekeeper 接受无需 `xattr` 的下载之前，仍然需要公证。

**现在就打开 Hardened Runtime 并加 `com.apple.security.cs.disable-library-validation`。** 该 entitlement 是通向公证构建的最短路径，但它属于公开发布的决策，还需要 Developer ID 证书和 `notarytool` 密钥。今天把构建交给同事并不需要这些。

**先把 native addon 搬进 `Contents/Frameworks`。** 那能消除运行时向 `~/.cache/pkg` 写入可执行代码，也是公证的长久答案，但它改变打包后的 host 如何解析 addon，属于宿主工作而非打包工作。

**用 `xcodebuild archive` 加 `-exportArchive`。** 导出需要 ExportOptions.plist 和一个真实签名身份。对 ad-hoc 产物来说，向私有 `-derivedDataPath` 做一次 Release `build` 得到的是同一个 bundle。

**用 `zip -r` 而不是 `ditto`。** `zip` 会丢掉资源分支，并可能破坏 bundle 签名。

**通过改 `project.pbxproj` 打版本号。** 写死的 `MARKETING_VERSION` 与 `CURRENT_PROJECT_VERSION` 会漂移，并让每次构建拥有相同标识。作为 `xcodebuild` 覆盖项传入，可以让签入的工程文件保持开发用取值。

## Consequences

**买到：** 任何 macOS 14 或更高版本的 Apple Silicon Mac 都能用一个 zip 或 DMG 运行产品窗口，无需克隆、Node 或 pnpm。凡是会因缺失或未封签的嵌套 host 而在测试者机器上失败的构建，改为在打包阶段失败。版本、构建号与修订号随归档一起打印，因此测试者的反馈能定位到确切的 bundle。

**付出：** 下载设置 quarantine 属性之后 Gatekeeper 会拒绝 ad-hoc 签名，因此每个接收方都要执行 `xattr -dr com.apple.quarantine`——这一步同时解除了对该 bundle 内其他内容的检查。[本 fork 在 GitHub Release 上接受这条命令](2026-08-14-macos-dmg-github-release.md)。提交计数在 `master` 上单调，跨分支则不然，所以两个分支的构建可能共用同一个 `CFBundleVersion`；经过公证的公开发布需要从 tag 推导的编号。目前没有更新通道。Linux CI 无法运行该脚本；macOS 打包路径有 `--help`、非 Darwin 拒绝执行、`--dry-run` 的命令计划，以及发布 DMG 的 GitHub Actions 作业。

公开发布还需要 Developer ID Application 证书、`ENABLE_HARDENED_RUNTIME = YES`、把 [`copy-web-host.sh`](../../../../apps/macos/scripts/copy-web-host.sh) 里 ad-hoc 的 `--timestamp=none` 换成 `codesign --timestamp`、解决上文的 library validation 冲突、带 stapling 的 `notarytool submit`，以及一个 macOS runner 任务。TCC 对这个未沙盒应用仍然管控 `~/Documents`、`~/Desktop` 与 `~/Downloads`，而子进程不继承 `NSOpenPanel` 的授权，所以位于这些目录下的 workspace 需要在公开构建之前单独验证。
