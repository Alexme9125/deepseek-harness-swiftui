import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = resolve(import.meta.dirname, '..')
const resolveRepo = resolve(repo, 'apps/macos/scripts/resolve-repo.sh')
const ensureHost = resolve(repo, 'apps/macos/scripts/ensure-web-host.sh')

// Xcode invokes these scripts through /bin/zsh, which every macOS host has.
// Linux runner images do not preinstall zsh, and a missing interpreter reports
// `status: null` rather than a failing assertion about repository resolution.
const describeZsh = spawnSync('zsh', ['-c', 'true']).status === 0 ? describe : describe.skip

describeZsh('macos Xcode repo resolution', () => {
  it('treats Xcode SRCROOT apps/macos as the checkout, not apps/', () => {
    const result = spawnSync('zsh', [resolveRepo], {
      encoding: 'utf8',
      env: { ...process.env, SRCROOT: resolve(repo, 'apps/macos') },
    })
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe(repo)
  })

  it('walks up from apps/macos/scripts when SRCROOT is unset', () => {
    const env = { ...process.env }
    delete env.SRCROOT
    const result = spawnSync('zsh', [resolveRepo], { encoding: 'utf8', env })
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe(repo)
  })

  it('fails when SRCROOT is not inside this checkout', () => {
    const result = spawnSync('zsh', [resolveRepo], {
      encoding: 'utf8',
      env: { ...process.env, SRCROOT: '/tmp' },
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('apps/cli/src/bin.ts')
  })

  it('lets ensure-web-host see build-web-host.ts under Xcode SRCROOT', () => {
    const result = spawnSync('zsh', [ensureHost], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SRCROOT: resolve(repo, 'apps/macos'),
        DSH_SKIP_WEB_HOST_BUILD: '1',
      },
    })
    expect(result.status).toBe(0)
    expect(`${result.stdout}${result.stderr}`).not.toContain('/apps/apps/macos/')
    expect(result.stdout).toMatch(/ensure-web-host: (skipped|.*already present)/)
  })
})
