import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'

const repo = resolve(import.meta.dirname, '..')
const host = resolve(repo, 'apps/macos/dist/dsh-web-host')
const describeHost = existsSync(host) && process.platform === 'darwin' ? describe : describe.skip

const hostEnv = {
  PATH: '/usr/bin:/bin',
  HOME: process.env.HOME ?? '',
}

describeHost('macos bundled web-host SEA', () => {
  it('runs --help without inherited dyld inserts', () => {
    const result = spawnSync(host, ['--help'], {
      encoding: 'utf8',
      env: { PATH: '/usr/bin:/bin' },
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('dsh')
  })

  it('aborts with kMagic when DYLD_INSERT_LIBRARIES is set', () => {
    const result = spawnSync(host, ['--help'], {
      encoding: 'utf8',
      env: {
        PATH: '/usr/bin:/bin',
        DYLD_INSERT_LIBRARIES: '/usr/lib/libgmalloc.dylib',
      },
    })
    expect(result.status).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain('kMagic')
  })

  // `--help` does not load Cordis plugins; sharp `dlopen`s at `web` init.
  it('boots `web` without a sharp/libvips dlopen failure', { timeout: 30_000 }, async () => {
    const port = await freeLoopbackPort()
    const child = spawn(host, ['web', '--host', '127.0.0.1', '--port', String(port)], {
      env: hostEnv,
    })
    const log = collectProcessLog(child)
    try {
      await waitUntil(async () => {
        if (child.exitCode !== null) {
          throw new Error(`dsh-web-host exited ${child.exitCode}: ${log()}`)
        }
        try {
          const response = await fetch(`http://127.0.0.1:${port}/`)
          return response.ok
        } catch {
          return false
        }
      }, 20_000)
    } finally {
      child.kill('SIGTERM')
      await waitUntil(() => child.exitCode !== null, 5_000).catch(() => {
        child.kill('SIGKILL')
      })
    }
    expect(log()).not.toContain('ERR_DLOPEN_FAILED')
    expect(log()).not.toContain('Could not load the "sharp" module')
  })
})

async function freeLoopbackPort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolveListen, reject) => {
    server.listen(0, '127.0.0.1', () => resolveListen())
    server.once('error', reject)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    server.close()
    throw new Error('macos-web-host-sea: expected a TCP address for the probe socket.')
  }
  const { port } = address
  await new Promise<void>((resolveClose, reject) => {
    server.close(error => error === undefined ? resolveClose() : reject(error))
  })
  return port
}

function collectProcessLog(child: ChildProcess): () => string {
  let log = ''
  const append = (chunk: Buffer | string): void => {
    log += chunk.toString()
  }
  child.stdout?.on('data', append)
  child.stderr?.on('data', append)
  return () => log
}

async function waitUntil(ready: () => boolean | Promise<boolean>, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await ready()) return
    await delay(200)
  }
  throw new Error(`macos-web-host-sea: timed out after ${timeoutMs}ms`)
}
