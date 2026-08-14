/**
 * Same-origin native-command bus for the macOS WKWebView shell.
 *
 * Swift dispatches `dsh-native-command` or calls `globalThis.__dshNativeInvoke`.
 * Workspace commands run through `ctx.workspaces`. `open-settings` is a DOM
 * event only — SettingsRoot owns modal open state.
 */

import type { IWorkspaces } from './contract/workspaces.ts'

/** Event name the macOS shell and SettingsRoot share. */
export const NATIVE_COMMAND_EVENT = 'dsh-native-command'

/** Commands the macOS File menu, folder drop, and Settings shortcut may send. */
export type NativeCommand =
  | { name: 'new-session' }
  | { name: 'add-workspace'; path: string }
  | { name: 'open-settings' }

/** Result Swift's `callAsyncJavaScript` reads from `__dshNativeInvoke`. */
export type NativeCommandResult =
  | { ok: true }
  | { ok: false; error: string }

type NativeCommandHost = typeof globalThis & {
  __dshNativeInvoke?: (detail: unknown) => Promise<NativeCommandResult>
  __dshNativeQueue?: unknown[]
}

type QueuedInvoke = {
  detail: unknown
  resolve: (result: NativeCommandResult) => void
  reject: (reason: unknown) => void
}

/**
 * Parse a window-event or `__dshNativeInvoke` payload.
 * @param value - unverified detail from the DOM or WKWebView arguments.
 * @returns a command, or undefined when the payload is not a known command.
 */
export function parseNativeCommand(value: unknown): NativeCommand | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const name = 'name' in value ? value.name : undefined
  if (name === 'new-session' || name === 'open-settings') return { name }
  if (name === 'add-workspace') {
    const path = 'path' in value ? value.path : undefined
    if (typeof path !== 'string' || path.trim() === '') return undefined
    return { name, path }
  }
  return undefined
}

/**
 * Run a workspace-facing native command.
 * @param workspaces - the runtime workspaces face.
 * @param command - a parsed `new-session` or `add-workspace` command.
 * @returns success, or the create/start failure message.
 */
export async function runNativeCommand(
  workspaces: Pick<IWorkspaces, 'create' | 'startSession'>,
  command: Exclude<NativeCommand, { name: 'open-settings' }>,
): Promise<NativeCommandResult> {
  if (command.name === 'new-session') {
    workspaces.startSession()
    return { ok: true }
  }
  try {
    const workspace = await workspaces.create({ path: command.path })
    workspaces.startSession(workspace.workspaceId)
    return { ok: true }
  } catch (reason: unknown) {
    return { ok: false, error: reason instanceof Error ? reason.message : String(reason) }
  }
}

/**
 * Resolve the DOM target Swift can dispatch on. The browser `window` is
 * `globalThis`; Node apply tests get a dedicated `EventTarget`.
 * @param globalObject - process global; defaults to `globalThis`.
 * @returns an EventTarget that accepts `dsh-native-command`.
 */
export function resolveNativeCommandTarget(
  globalObject: typeof globalThis = globalThis,
): EventTarget {
  if (typeof globalObject.addEventListener === 'function') {
    return globalObject
  }
  return new EventTarget()
}

/**
 * Install `__dshNativeInvoke` and a `dsh-native-command` listener.
 * A document-start stub may queue calls on `__dshNativeQueue` until this runs.
 * @param workspaces - the runtime workspaces face.
 * @param target - event target; defaults to the resolved page global.
 * @returns disposer that removes the listener and the invoke function.
 */
export function installNativeCommandListener(
  workspaces: Pick<IWorkspaces, 'create' | 'startSession'>,
  target: EventTarget = resolveNativeCommandTarget(),
): () => void {
  const host = globalThis as NativeCommandHost
  const invoke = (detail: unknown): Promise<NativeCommandResult> => invokeNativeCommand(workspaces, target, detail)
  const onEvent = (event: Event): void => {
    const detail = event instanceof CustomEvent ? (event as CustomEvent<unknown>).detail : undefined
    const command = parseNativeCommand(detail)
    if (command === undefined || command.name === 'open-settings') return
    void runNativeCommand(workspaces, command)
  }
  target.addEventListener(NATIVE_COMMAND_EVENT, onEvent)
  const queued = takeQueuedInvocations(host)
  host.__dshNativeInvoke = invoke
  for (const item of queued) {
    void invoke(item.detail).then(item.resolve, item.reject)
  }
  return () => {
    target.removeEventListener(NATIVE_COMMAND_EVENT, onEvent)
    if (host.__dshNativeInvoke === invoke) delete host.__dshNativeInvoke
  }
}

/**
 * Dispatch or run one native command and return the result to Swift.
 * @param workspaces - the runtime workspaces face.
 * @param target - event target that SettingsRoot listens on.
 * @param detail - unverified invoke argument.
 * @returns success or a parse/create error.
 */
export async function invokeNativeCommand(
  workspaces: Pick<IWorkspaces, 'create' | 'startSession'>,
  target: EventTarget,
  detail: unknown,
): Promise<NativeCommandResult> {
  const command = parseNativeCommand(detail)
  if (command === undefined) return { ok: false, error: 'unrecognized native command' }
  if (command.name === 'open-settings') {
    target.dispatchEvent(new CustomEvent(NATIVE_COMMAND_EVENT, { detail: command }))
    return { ok: true }
  }
  return runNativeCommand(workspaces, command)
}

function takeQueuedInvocations(host: NativeCommandHost): QueuedInvoke[] {
  const raw = host.__dshNativeQueue
  host.__dshNativeQueue = []
  if (!Array.isArray(raw)) return []
  const queued: QueuedInvoke[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as { detail?: unknown; resolve?: unknown; reject?: unknown }
    if (typeof record.resolve !== 'function') continue
    queued.push({
      detail: record.detail,
      resolve: record.resolve as QueuedInvoke['resolve'],
      reject: typeof record.reject === 'function' ? record.reject as QueuedInvoke['reject'] : () => {},
    })
  }
  return queued
}
