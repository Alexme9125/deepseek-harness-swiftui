# Agent Note: loader.create 遵守 bareModuleBaseUrl

Status: implemented

[English](2026-08-14-loader-create-honors-bare-module-base.md) | 中文

## 问题

打包的 `dsh-web-host` 在启动时以状态 1 退出：`directory-picker-auto` 无法从 `/Users/…/.dsh/profiles/web/` 导入 `@deepseek-ai/dsh-host-directory-picker-native`。该 native 包已在 web-host 闭包中。配置行插件已经从 VFS 解析，因为设置 `bareModuleBaseUrl` 时 `mountRootInclude` 会包装 Include。`ctx.loader.create` 走 Loader 自己的 `EntryTree.import`，调用 `internal.import(name, ctx.baseUrl)`——即 profile 目录。web 选择器在探测 bind-host / SSH / 显示之后用这种方式挂载后端，因此打包宿主上第一次对裸包名的 `loader.create` 失败。源码启动不受影响：`healProfilesModuleFallback` 仍会把安装目录中的包链接进 `$DSH_HOME/profiles/node_modules`。

## 决定

设置 `bareModuleBaseUrl` 时，`mountRootInclude` 代理 `ctx.loader.internal`，使每一个非相对、非文件系统绝对 specifier 的 `internal.import` 都以该宿主 URL 为父 URL。该代理不修改 Node 进程级级联 loader；HMR 方法绑定回真实对象。相对的 `loader.create` 名称仍以配置目录为基准。profile-boot 的 HMR 与 timer 行传入裸包名。

## 考虑过的替代方案

**只在 `directory-picker-auto` 内用 `import.meta.resolve`。** 这能解开这个选择器，但打包宿主里下一次 `loader.create('@deepseek-ai/…')` 仍是同一故障。

**像 profile-boot 的 HMR 那样，每个 `loader.create` 调用点都传入 file URL。** 每次新的动态挂载都要重新发现这个缺口；Include 与 `loader.create` 会继续使用不同的父 URL。

## 后果

传入 `bareModuleBaseUrl` 的封闭运行时从已安装宿主加载动态挂载的裸插件，与配置行一致。只存在于 `~/.dsh/profiles/web` 下、快照 VFS 中没有的额外包仍然不会加载。

## 测试

`packages/boot/app-boot/tests/app-boot.spec.ts` 以 harness 的 `bareModuleBaseUrl` 启动，其中的 `dsh-created-bare` 包遮蔽配置旁的另一份副本，然后 `loader.create` 该裸名、相对同级文件和绝对路径，并期望得到 harness 副本以及两份配置相对文件。
