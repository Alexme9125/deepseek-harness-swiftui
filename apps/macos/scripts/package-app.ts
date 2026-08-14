/**
 * Package DeepSeekHarness.app for internal distribution: a Release build with
 * the bundled web-host inside it, zipped with `ditto`.
 *
 * The product is ad-hoc signed, so Gatekeeper rejects it after a download sets
 * the quarantine attribute; the printed instructions carry the removal command.
 * A public build needs Developer ID signing, Hardened Runtime, and notarization
 * (see the internal-distribution Agent Note).
 *
 * `xcodebuild` does not run scheme pre-actions, so this script packages the
 * web-host itself instead of relying on `ensure-web-host.sh`.
 */

import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { access, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const root = resolve(import.meta.dirname, '../../..')

/** Xcode project and scheme that build the product window. */
const PROJECT = 'apps/macos/DeepSeekHarness.xcodeproj'
const SCHEME = 'DeepSeekHarness'
/** Distribution is Release only; a Debug bundle carries a debug dylib. */
const CONFIGURATION = 'Release'
/** The single supported slice: the bundled web-host is node24-macos-arm64. */
const ARCH = 'arm64'
const APP_BUNDLE = 'DeepSeekHarness.app'
/** Built by build-web-host.ts and installed by copy-web-host.sh. */
const HOST_PRODUCT = 'apps/macos/dist/dsh-web-host'
const WEB_HOST_TARGET = 'node24-macos-arm64'
/** Kept out of Xcode's shared DerivedData so a packaging run cannot reuse an IDE build. */
const DERIVED_DIR = 'apps/macos/dist/derived'
const DEFAULT_OUT_DIR = 'apps/macos/dist/release'
/**
 * Nested executables the copy build phase installs. Both must be present and
 * sealed: a recipient without Node has no source-launch fallback, and an
 * unsealed nested helper dies with SIGKILL at runtime.
 */
const NESTED_EXECUTABLES = ['dsh-web-host', 'dsh-web-host-spawn-helper'] as const

/** Validated CLI configuration; construction owns help and parse-error exits. */
class PackageCli {
  private constructor(
    readonly outDir: string,
    readonly skipWebHost: boolean,
    readonly dryRun: boolean,
  ) {}

  /**
   * Parse argv. Help exits 0 and malformed flags exit 1.
   * @param argv - the raw arguments (`process.argv.slice(2)`).
   * @returns the parsed configuration.
   */
  static parse(argv: string[]): PackageCli {
    let values: ReturnType<typeof PackageCli.parseRaw>
    try {
      values = PackageCli.parseRaw(argv)
    } catch (error) {
      console.error(`package-app: ${error instanceof Error ? error.message : String(error)}\n`)
      console.error(PackageCli.usage())
      process.exit(1)
    }
    if (values.help) {
      console.log(PackageCli.usage())
      process.exit(0)
    }
    return new PackageCli(values.output ?? DEFAULT_OUT_DIR, values['skip-web-host'], values['dry-run'])
  }

  private static parseRaw(argv: string[]) {
    return parseArgs({
      args: argv,
      options: {
        'output': { type: 'string' },
        'skip-web-host': { type: 'boolean', default: false },
        'dry-run': { type: 'boolean', default: false },
        'help': { type: 'boolean', default: false },
      },
    }).values
  }

  private static usage(): string {
    return [
      'Usage: pnpm exec tsx apps/macos/scripts/package-app.ts [flags]',
      '',
      `  --output=<dir>     zip destination. Default: ${DEFAULT_OUT_DIR}.`,
      `  --skip-web-host    require an existing ${HOST_PRODUCT} instead of packaging one.`,
      '  --dry-run          print every command without executing.',
      '  --help             print this help.',
      '',
      `Builds ${CONFIGURATION} for ${ARCH} only and zips ${APP_BUNDLE} with ditto.`,
      'The product is ad-hoc signed: internal distribution only, not notarized.',
    ].join('\n')
  }
}

/** Marketing version and monotonic build number stamped into the bundle. */
interface BundleVersion {
  /** `CFBundleShortVersionString`: the `x.y.z` prefix of the repository version. */
  marketing: string
  /** `CFBundleVersion`: this checkout's commit count. */
  build: string
  /** Short commit SHA, with a `-dirty` suffix when the worktree has changes. */
  revision: string
}

/**
 * Render a command for logs and errors, quoting arguments with spaces.
 * @param command - the executable.
 * @param args - its arguments.
 * @returns the printable command line.
 */
function formatCommand(command: string, args: readonly string[]): string {
  return [command, ...args].map(part => (part.includes(' ') ? JSON.stringify(part) : part)).join(' ')
}

function pnpmBin(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

/**
 * Run one subprocess with inherited stdio.
 * @param label - the step name used in logs and error messages.
 * @param command - the executable.
 * @param args - its arguments.
 * @param options - `env` extends the inherited environment; `cwd` defaults to the repository root.
 */
async function run(
  label: string,
  command: string,
  args: readonly string[],
  options: { env?: Record<string, string>; cwd?: string } = {},
): Promise<void> {
  const printable = formatCommand(command, args)
  console.log(`package-app: ${label}: ${printable}`)
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd ?? root,
      stdio: 'inherit',
      env: { ...process.env, ...options.env },
    })
    child.once('error', (error) => {
      reject(new Error(`package-app: ${label} failed to spawn: ${error.message} (${printable})`))
    })
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      const cause = code === null ? `signal ${signal ?? 'unknown'}` : `exit code ${code}`
      reject(new Error(`package-app: ${label} failed (${cause}): ${printable}`))
    })
  })
}

/**
 * Run one subprocess and capture its stdout.
 * @param label - the step name used in error messages.
 * @param command - the executable.
 * @param args - its arguments.
 * @returns the trimmed stdout.
 */
async function capture(label: string, command: string, args: readonly string[]): Promise<string> {
  const printable = formatCommand(command, args)
  return new Promise<string>((resolvePromise, reject) => {
    const child = spawn(command, [...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.once('error', (error) => {
      reject(new Error(`package-app: ${label} failed to spawn: ${error.message} (${printable})`))
    })
    child.once('exit', (code) => {
      if (code === 0) {
        resolvePromise(stdout.trim())
        return
      }
      reject(new Error(`package-app: ${label} failed (exit code ${String(code)}): ${printable}\n${stderr.trim()}`))
    })
  })
}

/**
 * Derive the bundle version from the repository version and this checkout's
 * history. The commit count is monotonic on `master`; a public release needs a
 * tag-derived number instead.
 * @returns the marketing version, build number, and revision label.
 */
async function resolveVersion(): Promise<BundleVersion> {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { version?: unknown }
  const version = typeof manifest.version === 'string' ? manifest.version : ''
  const marketing = /^\d+\.\d+\.\d+/.exec(version)?.[0]
  if (marketing === undefined) {
    throw new Error(`package-app: root package.json version ${JSON.stringify(version)} has no leading x.y.z to use as CFBundleShortVersionString.`)
  }
  const build = await capture('git commit count', 'git', ['rev-list', '--count', 'HEAD'])
  const sha = await capture('git revision', 'git', ['rev-parse', '--short', 'HEAD'])
  const status = await capture('git status', 'git', ['status', '--porcelain'])
  return { marketing, build, revision: status === '' ? sha : `${sha}-dirty` }
}

/** Reject a non-macOS host; only a dry run can describe the commands elsewhere. */
function requireDarwin(): void {
  if (process.platform !== 'darwin') {
    throw new Error(`package-app: packaging needs macOS with Xcode; this host is ${process.platform}. Use --dry-run to print the commands.`)
  }
}

/** Sequential packaging pipeline; dry runs print commands without executing. */
class AppPackage {
  private readonly derived = resolve(root, DERIVED_DIR)
  private readonly host = resolve(root, HOST_PRODUCT)

  constructor(private readonly cli: PackageCli) {}

  /** The Release product directory `xcodebuild` writes. */
  get appPath(): string {
    return join(this.derived, 'Build', 'Products', CONFIGURATION, APP_BUNDLE)
  }

  /**
   * Ensure the bundled web-host exists. `--skip-web-host` requires it instead
   * of building it: a zip without the host cannot start on a machine that has
   * no Node and no checkout.
   */
  async ensureWebHost(): Promise<void> {
    if (existsSync(this.host)) {
      console.log(`package-app: reusing ${HOST_PRODUCT}`)
      return
    }
    if (this.cli.skipWebHost) {
      throw new Error(`package-app: --skip-web-host was passed but ${HOST_PRODUCT} does not exist; drop the flag to package it.`)
    }
    await this.step('web-host', pnpmBin(), [
      'exec', 'tsx', 'apps/macos/scripts/build-web-host.ts', `--targets=${WEB_HOST_TARGET}`,
    ])
  }

  /**
   * Clean-build the app bundle with the resolved version stamped in. A clean
   * build keeps a stale nested host or icon out of a distributed artifact.
   * @param version - the marketing version and build number to stamp.
   */
  async build(version: BundleVersion): Promise<void> {
    await this.step('xcodebuild', 'xcodebuild', [
      '-project', resolve(root, PROJECT),
      '-scheme', SCHEME,
      '-configuration', CONFIGURATION,
      '-destination', `platform=macOS,arch=${ARCH}`,
      '-derivedDataPath', this.derived,
      `ARCHS=${ARCH}`,
      'ONLY_ACTIVE_ARCH=NO',
      `MARKETING_VERSION=${version.marketing}`,
      `CURRENT_PROJECT_VERSION=${version.build}`,
      'clean', 'build',
    ])
  }

  /**
   * Prove the bundle is distributable: both nested executables present, the
   * whole bundle sealed, and the packaged host able to run off the checkout.
   */
  async verify(): Promise<void> {
    if (this.cli.dryRun) {
      console.log(`package-app: [dry-run] verify ${NESTED_EXECUTABLES.join(', ')}, codesign, and a host --help run in ${this.appPath}`)
      return
    }
    if (!existsSync(this.appPath)) {
      throw new Error(`package-app: ${this.appPath} is missing after the xcodebuild run.`)
    }
    for (const name of NESTED_EXECUTABLES) {
      const nested = join(this.appPath, 'Contents', 'MacOS', name)
      try {
        await access(nested, constants.X_OK)
      } catch {
        throw new Error(
          `package-app: ${nested} is missing or not executable. `
          + `The copy build phase installs it from ${HOST_PRODUCT}; a bundle without it cannot start on a machine with no Node.`,
        )
      }
    }
    await this.step('codesign verify', 'codesign', ['--verify', '--deep', '--strict', this.appPath])
    await this.smokeHost()
  }

  /**
   * Run the bundled host's `--help` against a throwaway `DSH_HOME`, so a
   * broken nested signature or a truncated SEA fails here instead of on a
   * tester's machine.
   */
  private async smokeHost(): Promise<void> {
    const home = await mkdtemp(join(tmpdir(), 'dsh-package-smoke-'))
    try {
      await this.step('bundled host --help', join(this.appPath, 'Contents', 'MacOS', 'dsh-web-host'), ['--help'], {
        env: { DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' },
      })
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  }

  /**
   * Zip the bundle with `ditto`, which preserves the code signature and
   * resource forks that `zip` drops.
   * @param version - the version whose numbers name the archive.
   * @returns the archive path.
   */
  async archive(version: BundleVersion): Promise<string> {
    const outDir = resolve(root, this.cli.outDir)
    const zip = join(outDir, `${SCHEME}-${version.marketing}-${version.build}-${ARCH}.zip`)
    if (this.cli.dryRun) {
      console.log(`package-app: [dry-run] mkdir -p ${outDir}`)
    } else {
      await mkdir(outDir, { recursive: true })
      await rm(zip, { force: true })
    }
    await this.step('ditto', 'ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', this.appPath, zip])
    return zip
  }

  /**
   * Print the archive, its size, and what a recipient must do. Ad-hoc signing
   * makes the quarantine removal part of the delivery, not an optional tip.
   * @param zip - the archive path.
   * @param version - the packaged version.
   */
  report(zip: string, version: BundleVersion): void {
    if (this.cli.dryRun) {
      console.log(`package-app: [dry-run] would produce ${zip}`)
      return
    }
    const megabytes = statSync(zip).size / (1024 * 1024)
    console.log('')
    console.log(`package-app: ${zip} (${megabytes.toFixed(1)} MB)`)
    console.log(`package-app: version ${version.marketing} build ${version.build} revision ${version.revision}`)
    console.log('')
    console.log('Send the zip with these steps. The app is ad-hoc signed, so Gatekeeper blocks it until the')
    console.log('quarantine attribute a download adds is removed:')
    console.log('')
    console.log('  1. Unzip and move DeepSeekHarness.app to /Applications.')
    console.log('  2. xattr -dr com.apple.quarantine /Applications/DeepSeekHarness.app')
    console.log('  3. Open it. Report the version, build, and revision above with any problem.')
    console.log('')
    console.log('Requires macOS 14 or later on Apple Silicon. No Node installation is needed.')
  }

  /**
   * Run one pipeline command, or print it in a dry run.
   * @param label - the step name used in logs and error messages.
   * @param command - the executable.
   * @param args - its arguments.
   * @param options - `env` extends the inherited environment.
   */
  private async step(
    label: string,
    command: string,
    args: readonly string[],
    options: { env?: Record<string, string> } = {},
  ): Promise<void> {
    if (this.cli.dryRun) {
      console.log(`package-app: [dry-run] ${formatCommand(command, args)}`)
      return
    }
    await run(label, command, args, options)
  }
}

async function main(): Promise<void> {
  const cli = PackageCli.parse(process.argv.slice(2))
  if (!cli.dryRun) requireDarwin()
  const version = await resolveVersion()
  const pipeline = new AppPackage(cli)
  console.log(`package-app: ${CONFIGURATION} ${ARCH}, version ${version.marketing} build ${version.build} (${version.revision})`)
  await pipeline.ensureWebHost()
  await pipeline.build(version)
  await pipeline.verify()
  pipeline.report(await pipeline.archive(version), version)
}

await main()
