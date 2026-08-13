import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

describe('verify-runtime-closure', () => {
  it('closes both deploy-root manifests and indexes app assemblies', async () => {
    const result = await execa('pnpm', ['run', 'verify-runtime-closure'], {
      reject: false,
    })
    expect(result.stderr).not.toContain('required workspace peers are missing')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('dsh-jsonrpc-agent-pkg:')
    expect(result.stdout).toContain('dsh-web-host-pkg:')
  }, 30_000)

  it('accepts a single --manifest path', async () => {
    const result = await execa(
      'pnpm',
      ['exec', 'tsx', 'scripts/verify-runtime-closure.ts', '--manifest', 'apps/macos/web-host/package.json'],
      { reject: false },
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('dsh-web-host-pkg:')
    expect(result.stdout).not.toContain('dsh-jsonrpc-agent-pkg:')
  }, 30_000)
})
