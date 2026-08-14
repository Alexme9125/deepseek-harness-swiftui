# Agent Note: 打包宿主的 readdir 返回的是名字字符串

Status: implemented

[English](2026-08-14-pkg-sea-readdir-returns-names.md) | 中文

## Problem

在 macOS 产品窗口里发送消息失败，报错 `agent-presets: preset "standard" not found (available: none)`。随附的组装文件已经在 web-host VFS 的 `@deepseek-ai/dsh/config/agent-presets/` 里。`scanRoot` 跑过了，但一行都没返回。

同一段扫描此前在 New Session 上抛出 `TypeError: child.isDirectory is not a function`（`session.create`、`agentPreset.list` HTTP 500）。两次失败是同一种 `readdir` 结果。`@yao-pkg/pkg --sea`（node24、6.21.0）读取快照目录时，无论是否带 `{ withFileTypes: true }`，返回的都是**字符串**——在嵌套的 `config/agent-presets/<id>/agent.cordis.yml` 树上测得，`import.meta.url` 为 `file:///snapshot/…`。字符串上没有 Node 的 `Dirent.isDirectory()`。若只把 `{ isDirectory: true }` 的对象当目录，每个名字都会被跳过，YAML 还在 VFS 里名单却是空的。对同样这些名字做 `stat(join(root, name)).isDirectory()` 是函数，且返回 true。

## Decision

[`scanRoot`](../../../../packages/preset/agent-presets/src/discovery.ts) 调用不带 `withFileTypes` 的 `readdir`，再对每个可用 preset id 的名字做 `stat`。旁边的普通文件不是名单行。编写流程仍在 `cp` 之后遍历真实目标树，因此继续使用 `Dirent.isDirectory()`。

## Alternatives considered

**继续用 `withFileTypes`，并把布尔属性 `isDirectory` 当作目录。** 该适配曾为 TypeError 而交付；实测 SEA 给出的是字符串，于是每个随附 id 都消失了（`available: none`），而不再崩溃。

**把 `readdir` 的每个字符串都当成目录。** 名字恰好是可用 preset id 的文件会占住该槽位，变成损坏的幽灵行。

**在 `session.create` 里捕获 TypeError。** 名单仍然是空的；出错的不是调用点。

## Consequences

打包的 `dsh-web-host` 能列出随附 preset，并能恢复记录了 `standard` 的会话。其他快照 `readdir({ withFileTypes: true })` 调用方未改；此后若在 VFS 目录上遍历，不得假定存在 Node `Dirent` 方法。

## Testing

`packages/preset/agent-presets/tests/discovery.spec.ts` 向 `scanRoot` 喂入字符串名字（SEA 的结果），并期望与真实文件系统相同的目录/文件划分：可用目录被列出，名字为可用 id 的旁边文件被省略，无法 `stat` 为目录的名字被省略。
