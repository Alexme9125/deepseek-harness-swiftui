import { defineConfig } from 'tsdown'

/**
 * The dsh CLI ships two entries: the public `dsh` bin and the closed-runtime
 * `dsh-web-host` packaged bin. The root tsdown builds only
 * `lib/types/index.js`, so this override points at the bin files instead;
 * their reachable mode modules bundle with them. Declarations come from
 * `tsc -b` (dts: false), matching every package.
 */
export default defineConfig([
  {
    entry: ['lib/types/bin.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  {
    entry: ['lib/types/packaged-bin.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
])
