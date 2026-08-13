import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const script = 'apps/macos/scripts/build-web-host.ts'

describe('build-web-host', () => {
  it('prints usage and the macos-arm64 product path', () => {
    const help = spawnSync('pnpm', ['exec', 'tsx', script, '--help'], { encoding: 'utf8' })
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('node24-macos-arm64')
    expect(help.stdout).toContain('apps/macos/dist/dsh-web-host')
    expect(help.stdout).not.toContain('dsh-jsonrpc-agent')
  })

  it('dry-runs the web-host deploy root, not the JSON-RPC Python closure', () => {
    const result = spawnSync(
      'pnpm',
      ['exec', 'tsx', script, '--dry-run', '--skip-build', '--targets=node24-macos-arm64'],
      { encoding: 'utf8' },
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('dsh-web-host-pkg')
    expect(result.stdout).toContain('apps/macos/web-host/package.json')
    expect(result.stdout).toContain('node_modules/@deepseek-ai/dsh/lib/packaged-bin.js')
    expect(result.stdout).toContain('apps/macos/dist/dsh-web-host')
    expect(result.stdout).toContain('node_modules/**/*.dylib')
    expect(result.stdout).toContain('node_modules/**/*.so')
    expect(result.stdout).not.toContain('dsh-jsonrpc-agent-pkg')
    expect(result.stdout).not.toContain('python/sdk-runtime')
  })
})
