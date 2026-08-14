# Agent Note: client-modules 从宿主树解析 dsh.client 包

Status: implemented

[English](2026-08-14-client-modules-host-package-resolve.md) | 中文

## 问题

打包的 `dsh-web-host` 启动之后，WKWebView 显示 **Failed to load plugins** / `@deepseek-ai/dsh-client-app-shell` 因等待 `slots`、`sessions`、`layout` 而 pending。这些服务来自 `dsh-client-runtime` 与 `dsh-client-ui-layout`，它们是 web bundle 名册里的普通行。宿主进程已起来；浏览器图里没有它们。

client-modules 的 Node 半边用 `createRequire(ctx.baseUrl)` 解析每个 Loader 配置项的 `package.json`——即 profile 目录。封闭打包宿主会跳过 `healProfilesModuleFallback`（[loader.create 宿主父 URL](2026-08-14-loader-create-honors-bare-module-base.md)），而 pkg 也不会从该父 URL 走向 `$DSH_HOME/profiles/node_modules`。`resolveMeta` 把 `MODULE_NOT_FOUND` 当成「不是 client 包」（与 `cordis:include` 同一条路径），于是每个 `dsh.client` 行都从 `window.__DSH_BOOT__` 消失。外壳仍会挂上 app-shell，它会永远等待没有图行会提供的服务。

## 决定

包查找先试配置目录，再试本包自己的树（`createRequire(import.meta.url)`）；在 hoist 的 VFS 或已部署闭包里，那就是封闭的 `node_modules`。当 `import.meta.url` 位于 `/snapshot/` 下时优先走宿主树，避免磁盘上残留的 fallback 链接遮蔽封闭集。

## 考虑过的替代方案

**profile 目录解析不到 `dsh.client` 行就让激活失败。** 比空图更响，但打包宿主仍然起不来；这些包在 VFS 里，并不是缺失。

**仍然往 `$DSH_HOME/profiles/node_modules` 愈合无法指向 snapshot 的符号链接。** 这些链接不能指向 `/snapshot/`；profile-boot 正是因此跳过愈合。

## 后果

打包 web-host 提供与源码启动相同的 client 名册。只存在于 `~/.dsh/profiles/web` 下的名称仍然不会进入快照图。

## 测试

`packages/client/modules/tests/node-half.client.spec.ts` 在空配置目录上构造 Node 半边，并把 modules 包自身当作 Loader 配置项（宿主可解析），期望得到图行或缺失 bundle 的组合错误，而不是静默空图。第二个用例在配置的 `node_modules` 下写入同名包，并期望该路径胜出。
