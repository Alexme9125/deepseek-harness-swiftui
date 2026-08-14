import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = resolve(import.meta.dirname, '..')
const script = resolve(repo, 'apps/macos/scripts/copy-web-host.sh')
const describeDarwin = process.platform === 'darwin' ? describe : describe.skip

describe('macos copy-web-host', () => {
  it('reseals an already-signed .app and does not enable Hardened Runtime', () => {
    const text = readFileSync(script, 'utf8')
    expect(text).toContain('/usr/bin/codesign')
    expect(text).toContain('CODESIGNING_FOLDER_PATH')
    expect(text).toContain('main executable not signed yet')
    expect(text).toContain('--preserve-metadata=identifier,entitlements,flags')
    const invocations = text.split('\n').filter(line => line.includes('/usr/bin/codesign'))
    expect(invocations.length).toBeGreaterThan(0)
    for (const line of invocations) {
      expect(line).not.toContain('--options runtime')
    }
  })
})

describeDarwin('macos copy-web-host incremental seal', () => {
  it('keeps the app bundle valid after replacing the nested host', () => {
    const root = makeFixture()
    try {
      const firstSign = spawnSync('/usr/bin/codesign', ['--sign', '-', '--force', '--timestamp=none', root.app], {
        encoding: 'utf8',
      })
      expect(firstSign.status, firstSign.stderr).toBe(0)

      const copied = runCopy(root)
      expect(copied.status, `${copied.stdout}${copied.stderr}`).toBe(0)
      expect(copied.stdout).toContain('resealed')
      expect(existsSync(join(root.app, 'Contents', 'MacOS', 'dsh-web-host'))).toBe(true)

      const verify = spawnSync('/usr/bin/codesign', ['--verify', '--verbose=2', root.app], { encoding: 'utf8' })
      expect(verify.status, `${verify.stdout}${verify.stderr}`).toBe(0)
      expect(`${verify.stdout}${verify.stderr}`).not.toContain('nested code is modified')
    } finally {
      rmSync(root.dir, { recursive: true, force: true })
    }
  })

  it('skips bundle reseal when the main executable is not signed yet', () => {
    const root = makeFixture()
    try {
      const copied = runCopy(root)
      expect(copied.status, `${copied.stdout}${copied.stderr}`).toBe(0)
      expect(copied.stdout).toContain('main executable not signed yet')
      expect(copied.stdout).not.toContain('resealed')
    } finally {
      rmSync(root.dir, { recursive: true, force: true })
    }
  })
})

function makeFixture(): { dir: string; srcroot: string; app: string } {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-copy-web-host-'))
  const srcroot = join(dir, 'src')
  mkdirSync(join(srcroot, 'dist'), { recursive: true })
  const stub = '/usr/bin/true'
  copyFileSync(stub, join(srcroot, 'dist', 'dsh-web-host'))
  chmodSync(join(srcroot, 'dist', 'dsh-web-host'), 0o755)
  copyFileSync(stub, join(srcroot, 'dist', 'dsh-web-host-spawn-helper'))
  chmodSync(join(srcroot, 'dist', 'dsh-web-host-spawn-helper'), 0o755)

  const app = join(dir, 'DeepSeekHarness.app')
  mkdirSync(join(app, 'Contents', 'MacOS'), { recursive: true })
  writeFileSync(join(app, 'Contents', 'Info.plist'), infoPlist)
  copyFileSync(stub, join(app, 'Contents', 'MacOS', 'DeepSeekHarness'))
  chmodSync(join(app, 'Contents', 'MacOS', 'DeepSeekHarness'), 0o755)
  spawnSync('/usr/bin/codesign', ['--remove-signature', join(app, 'Contents', 'MacOS', 'DeepSeekHarness')])
  spawnSync('/usr/bin/codesign', ['--remove-signature', join(srcroot, 'dist', 'dsh-web-host')])
  spawnSync('/usr/bin/codesign', ['--remove-signature', join(srcroot, 'dist', 'dsh-web-host-spawn-helper')])
  return { dir, srcroot, app }
}

function runCopy(root: { dir: string; srcroot: string; app: string }) {
  return spawnSync('zsh', [script], {
    encoding: 'utf8',
    env: {
      PATH: '/usr/bin:/bin',
      SRCROOT: root.srcroot,
      BUILT_PRODUCTS_DIR: root.dir,
      CONTENTS_FOLDER_PATH: 'DeepSeekHarness.app/Contents',
      CODESIGNING_FOLDER_PATH: root.app,
      EXPANDED_CODE_SIGN_IDENTITY: '-',
      EXECUTABLE_NAME: 'DeepSeekHarness',
    },
  })
}

const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>DeepSeekHarness</string>
  <key>CFBundleIdentifier</key>
  <string>ai.deepseek.harness.test</string>
  <key>CFBundleName</key>
  <string>DeepSeekHarness</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
</dict>
</plist>
`
