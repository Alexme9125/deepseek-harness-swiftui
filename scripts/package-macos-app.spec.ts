import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const script = 'apps/macos/scripts/package-app.ts'

/**
 * Linux cannot run `xcodebuild`, so these cases pin the plan the packaging
 * script would execute rather than a produced bundle.
 */
describe('package-app', () => {
  it('prints usage and states the ad-hoc distribution limit', () => {
    const help = spawnSync('pnpm', ['exec', 'tsx', script, '--help'], { encoding: 'utf8' })
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('--skip-web-host')
    expect(help.stdout).toContain('ad-hoc signed')
  })

  it('refuses to package off macOS unless the run is a dry run', () => {
    const result = spawnSync('pnpm', ['exec', 'tsx', script], { encoding: 'utf8' })
    expect(result.status).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain('packaging needs macOS with Xcode')
  })

  it('plans an arm64 Release build that stamps the version, zips with ditto, and wraps a UDZO DMG', () => {
    const result = spawnSync('pnpm', ['exec', 'tsx', script, '--dry-run'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('-configuration Release')
    expect(result.stdout).toContain('ARCHS=arm64')
    expect(result.stdout).toMatch(/MARKETING_VERSION=\d+\.\d+\.\d+/)
    expect(result.stdout).toMatch(/CURRENT_PROJECT_VERSION=\d+/)
    expect(result.stdout).toContain('--keepParent')
    expect(result.stdout).toMatch(/apps\/macos\/dist\/release\/DeepSeekHarness-\d+\.\d+\.\d+-\d+-arm64\.zip/)
    expect(result.stdout).toContain('ln -s /Applications')
    expect(result.stdout).toContain('hdiutil create')
    expect(result.stdout).toContain('-format UDZO')
    expect(result.stdout).toMatch(/apps\/macos\/dist\/release\/DeepSeekHarness-\d+\.\d+\.\d+-\d+-arm64\.dmg/)
  })

  it('packages the web-host when it is absent and fails loud when the flag forbids that', () => {
    const packaged = spawnSync('pnpm', ['exec', 'tsx', script, '--dry-run'], { encoding: 'utf8' })
    expect(packaged.status).toBe(0)
    expect(packaged.stdout).toContain('build-web-host.ts --targets=node24-macos-arm64')
    const skipped = spawnSync('pnpm', ['exec', 'tsx', script, '--dry-run', '--skip-web-host'], { encoding: 'utf8' })
    expect(skipped.status).not.toBe(0)
    expect(`${skipped.stdout}${skipped.stderr}`).toContain('--skip-web-host was passed but')
  })
})
