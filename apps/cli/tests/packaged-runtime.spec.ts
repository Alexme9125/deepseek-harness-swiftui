import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
import { afterEach, describe, expect, it } from 'vitest'
import { isSnapshotInstall, runProfile } from '../src/profile-boot.ts'

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

/**
 * A one-row custom profile whose plugin writes a ready marker and does not
 * keep the event loop alive. Bundles resolve from the profile directory so
 * the closed-runtime path can skip the installation fallback.
 */
function createClosedRuntimeFixture(): { home: string; ready: string } {
  const home = mkdtempSync(join(tmpdir(), 'dsh-closed-runtime-'))
  homes.push(home)
  const ready = join(home, 'ready')
  const profileDir = join(home, 'profiles', 'closed')
  const bundleDir = join(profileDir, 'node_modules', 'dsh-closed-bundle')
  mkdirSync(bundleDir, { recursive: true })
  writeFileSync(join(bundleDir, 'plugin.mjs'), [
    "import { writeFileSync } from 'node:fs'",
    "export const name = 'closed-runtime-fixture'",
    'export function apply() {',
    "  writeFileSync(process.env.RAW_READY_FILE, 'ready')",
    '}',
    '',
  ].join('\n'))
  writeFileSync(join(bundleDir, 'cordis.patch.yml'), [
    '- insert:',
    '    - id: closed-runtime-fixture',
    `      name: ${pathToFileURL(join(bundleDir, 'plugin.mjs')).href}`,
    '',
  ].join('\n'))
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({
    name: 'dsh-closed-bundle',
    version: '0.0.0',
    type: 'module',
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  }, undefined, 2))
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
    name: 'dsh-profile-closed',
    private: true,
    dependencies: {},
    dsh: { profile: { bundles: ['dsh-closed-bundle'] } },
  }, undefined, 2))
  writeFileSync(join(profileDir, 'cordis.patch.yml'), '[]\n')
  return { home, ready }
}

describe('isSnapshotInstall', () => {
  it('detects pkg snapshot paths and rejects ordinary install anchors', () => {
    expect(isSnapshotInstall('/snapshot/node_modules/@deepseek-ai/dsh/package.json')).toBe(true)
    expect(isSnapshotInstall('C:\\snapshot\\node_modules\\@deepseek-ai\\dsh\\package.json')).toBe(true)
    expect(isSnapshotInstall('/workspace/apps/cli/package.json')).toBe(false)
  })
})

describe('runProfile closed runtime', () => {
  it('boots a custom profile when bareModuleBaseUrl is set and skips the disk fallback', async () => {
    const fixture = createClosedRuntimeFixture()
    const previousHome = process.env.DSH_HOME
    process.env.DSH_HOME = fixture.home
    process.env.RAW_READY_FILE = fixture.ready
    try {
      const { ctx, shutdown } = await runProfile({
        environment: loadLayeredEnv('dsh'),
        profile: 'closed',
        patchFiles: [],
        args: [],
        bareModuleBaseUrl: import.meta.url,
      })
      expect(existsSync(fixture.ready)).toBe(true)
      expect(existsSync(join(fixture.home, 'profiles', 'node_modules', '@deepseek-ai'))).toBe(false)
      await shutdown.shutdown(0)
      await ctx.fiber.dispose()
    } finally {
      if (previousHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousHome
      delete process.env.RAW_READY_FILE
    }
  })
})
