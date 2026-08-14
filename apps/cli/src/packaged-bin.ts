#!/usr/bin/env node
/**
 * Closed-runtime dsh entry. Bare plugins resolve from the installed web-host
 * closure. The macOS app invokes this as
 * `dsh-web-host web --host 127.0.0.1 --port <n>`.
 *
 * @module @deepseek-ai/dsh/packaged-bin
 */

/* v8 ignore file -- built-bin acceptance exercises this self-executing dispatch. */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
import { parseDshArgs } from './args.ts'
import { runDumpConfig } from './dump-config.ts'
import { runPlugin } from './plugin.ts'
import { runProfile } from './profile-boot.ts'

/** This app's version, read from its checked-in package.json. */
function readVersion(): string {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as { version?: unknown }
  return typeof manifest.version === 'string' ? manifest.version : '0.0.0'
}

const invocation = parseDshArgs(process.argv.slice(2), readVersion())

switch (invocation.mode) {
  case 'profile': {
    await runProfile({
      environment: loadLayeredEnv('dsh'),
      profile: invocation.profile,
      patchFiles: invocation.patches,
      args: invocation.args,
      bareModuleBaseUrl: import.meta.url,
    })
    break
  }
  case 'plugin': {
    process.exit(runPlugin(invocation.profile, invocation.args))
    break
  }
  case 'dump-config': {
    runDumpConfig(invocation.profile, invocation.defaultOnly, invocation.patches)
    break
  }
  default:
    invocation satisfies never
    throw new Error(`dsh-web-host: unhandled invocation mode ${JSON.stringify(invocation)}`)
}
