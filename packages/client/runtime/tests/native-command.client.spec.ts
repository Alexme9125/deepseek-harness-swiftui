/**
 * Native-command bus: parse window/WKWebView payloads, run workspace
 * commands, and install/dispose the page listener plus `__dshNativeInvoke`.
 */
import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-remotes/client'
import type { IWorkspaces } from '../src/client/contract/workspaces.ts'
import {
  installNativeCommandListener,
  invokeNativeCommand,
  NATIVE_COMMAND_EVENT,
  parseNativeCommand,
  resolveNativeCommandTarget,
  runNativeCommand,
} from '../src/client/native-command.ts'

type NativeHost = typeof globalThis & {
  __dshNativeInvoke?: (detail: unknown) => Promise<unknown>
  __dshNativeQueue?: unknown[]
}

function workspace(path: string): WorkspaceView {
  return {
    workspaceId: 'w-native' as WorkspaceId,
    path,
    title: 'native',
    sessionIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function workspaces(overrides: Partial<Pick<IWorkspaces, 'create' | 'startSession'>> = {}) {
  return {
    startSession: overrides.startSession ?? vi.fn(),
    create: overrides.create ?? vi.fn(async (input: { path: string }) => workspace(input.path)),
  }
}

describe('parseNativeCommand', () => {
  it('accepts the three shell commands and rejects empty or unknown payloads', () => {
    expect(parseNativeCommand({ name: 'new-session' })).toEqual({ name: 'new-session' })
    expect(parseNativeCommand({ name: 'open-settings' })).toEqual({ name: 'open-settings' })
    expect(parseNativeCommand({ name: 'add-workspace', path: '/w/alpha' })).toEqual({
      name: 'add-workspace', path: '/w/alpha',
    })
    expect(parseNativeCommand(null)).toBeUndefined()
    expect(parseNativeCommand('new-session')).toBeUndefined()
    expect(parseNativeCommand({ name: 'unknown' })).toBeUndefined()
    expect(parseNativeCommand({ name: 'add-workspace' })).toBeUndefined()
    expect(parseNativeCommand({ name: 'add-workspace', path: '' })).toBeUndefined()
    expect(parseNativeCommand({ name: 'add-workspace', path: '   ' })).toBeUndefined()
    expect(parseNativeCommand({ name: 'add-workspace', path: 1 })).toBeUndefined()
    expect(parseNativeCommand({})).toBeUndefined()
  })
})

describe('runNativeCommand', () => {
  it('starts a session and adopts a created workspace', async () => {
    const api = workspaces()
    await expect(runNativeCommand(api, { name: 'new-session' })).resolves.toEqual({ ok: true })
    expect(api.startSession).toHaveBeenCalledWith()
    await expect(runNativeCommand(api, { name: 'add-workspace', path: '/w/alpha' })).resolves.toEqual({ ok: true })
    expect(api.create).toHaveBeenCalledWith({ path: '/w/alpha' })
    expect(api.startSession).toHaveBeenLastCalledWith('w-native')
  })

  it('returns create failures as an error result', async () => {
    const api = workspaces({
      create: vi.fn(async () => {
        throw new Error('workspace-invalid-path: missing')
      }),
    })
    await expect(runNativeCommand(api, { name: 'add-workspace', path: '/missing' })).resolves.toEqual({
      ok: false, error: 'workspace-invalid-path: missing',
    })
    expect(api.startSession).not.toHaveBeenCalled()
    const thrown = workspaces({
      create: vi.fn(async () => {
        throw 'bare'
      }),
    })
    await expect(runNativeCommand(thrown, { name: 'add-workspace', path: '/x' })).resolves.toEqual({
      ok: false, error: 'bare',
    })
  })
})

describe('invokeNativeCommand', () => {
  it('rejects unknown payloads and opens settings by dispatching the shared event', async () => {
    const api = workspaces()
    const target = new EventTarget()
    const seen: unknown[] = []
    target.addEventListener(NATIVE_COMMAND_EVENT, (event) => {
      seen.push(event instanceof CustomEvent ? event.detail : undefined)
    })
    await expect(invokeNativeCommand(api, target, { name: 'nope' })).resolves.toEqual({
      ok: false, error: 'unrecognized native command',
    })
    await expect(invokeNativeCommand(api, target, { name: 'open-settings' })).resolves.toEqual({ ok: true })
    expect(seen).toEqual([{ name: 'open-settings' }])
    expect(api.startSession).not.toHaveBeenCalled()
    await expect(invokeNativeCommand(api, target, { name: 'new-session' })).resolves.toEqual({ ok: true })
    expect(api.startSession).toHaveBeenCalledOnce()
  })
})

describe('installNativeCommandListener', () => {
  it('handles CustomEvents, exposes __dshNativeInvoke, and removes both on dispose', async () => {
    const api = workspaces()
    const target = new EventTarget()
    const host = globalThis as NativeHost
    const dispose = installNativeCommandListener(api, target)
    const invoke = host.__dshNativeInvoke
    if (invoke === undefined) throw new Error('expected __dshNativeInvoke after install')
    target.dispatchEvent(new CustomEvent(NATIVE_COMMAND_EVENT, { detail: { name: 'new-session' } }))
    target.dispatchEvent(new CustomEvent(NATIVE_COMMAND_EVENT, { detail: { name: 'open-settings' } }))
    target.dispatchEvent(new Event(NATIVE_COMMAND_EVENT))
    await expect(invoke({ name: 'add-workspace', path: '/w/beta' })).resolves.toEqual({ ok: true })
    expect(api.startSession).toHaveBeenCalledTimes(2)
    expect(api.create).toHaveBeenCalledWith({ path: '/w/beta' })
    dispose()
    expect(host.__dshNativeInvoke).toBeUndefined()
    target.dispatchEvent(new CustomEvent(NATIVE_COMMAND_EVENT, { detail: { name: 'new-session' } }))
    expect(api.startSession).toHaveBeenCalledTimes(2)
  })

  it('drains a document-start queue and ignores malformed queue entries', async () => {
    const api = workspaces()
    const host = globalThis as NativeHost
    host.__dshNativeQueue = 'not-an-array' as unknown as unknown[]
    installNativeCommandListener(api, new EventTarget())()
    expect(host.__dshNativeQueue).toEqual([])
    let resolved: unknown
    host.__dshNativeQueue = [
      null,
      { detail: { name: 'new-session' } },
      {
        detail: { name: 'add-workspace', path: '/w/queued' },
        resolve: (result: unknown) => { resolved = result },
      },
      {
        detail: { name: 'new-session' },
        resolve: () => {},
        reject: 'not-a-function',
      },
    ]
    const dispose = installNativeCommandListener(api, new EventTarget())
    await Promise.resolve()
    await Promise.resolve()
    expect(resolved).toEqual({ ok: true })
    expect(api.create).toHaveBeenCalledWith({ path: '/w/queued' })
    expect(api.startSession).toHaveBeenCalled()
    expect(host.__dshNativeQueue).toEqual([])
    dispose()
  })

  it('leaves a replaced __dshNativeInvoke in place when a prior installer disposes', () => {
    const first = workspaces()
    const second = workspaces()
    const host = globalThis as NativeHost
    const disposeFirst = installNativeCommandListener(first, new EventTarget())
    const disposeSecond = installNativeCommandListener(second, new EventTarget())
    const current = host.__dshNativeInvoke
    disposeFirst()
    expect(host.__dshNativeInvoke).toBe(current)
    disposeSecond()
    expect(host.__dshNativeInvoke).toBeUndefined()
  })
})

describe('resolveNativeCommandTarget', () => {
  it('reuses a global EventTarget when addEventListener exists, otherwise mints one', () => {
    const withListener = { addEventListener() {} } as unknown as typeof globalThis
    expect(resolveNativeCommandTarget(withListener)).toBe(withListener)
    const minted = resolveNativeCommandTarget({} as typeof globalThis)
    expect(minted).toBeInstanceOf(EventTarget)
    expect(minted).not.toBe(globalThis)
  })
})
