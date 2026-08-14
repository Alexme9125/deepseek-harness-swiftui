# Agent Note: The macOS app ships ad-hoc signed for internal testing

Status: implemented

English | [中文](2026-08-14-macos-internal-distribution.zh.md)

## Problem

[`apps/macos`](../../../../apps/macos/README.md) builds only through Xcode Run on a checkout. Testing the [product window](2026-08-13-swiftui-mac-shell.md) required a clone, Node, and pnpm, which is exactly the audience the bundled `dsh-web-host` exists to eliminate.

A public download needs Developer ID signing, Hardened Runtime, and notarization. Hardened Runtime enables library validation, and `@yao-pkg/pkg --sea` extracts unsigned `.node` addons (node-pty, sharp with its libvips dylibs, `node-addon-require-builtin`) to `~/.cache/pkg` and `dlopen`s them at plugin init, so the current bundle would be killed under that runtime. Blocking internal testing on that work leaves the app untested outside one machine.

## Decision

[`scripts/package-app.ts`](../../../../apps/macos/scripts/package-app.ts) (`pnpm run package:macos-app`) produces one ad-hoc signed zip for internal distribution. Recipients need macOS 14 or later on Apple Silicon and no Node.

The script packages `dsh-web-host` when `apps/macos/dist/dsh-web-host` is absent, because `xcodebuild` does not run the scheme pre-actions that Xcode Run uses. It clean-builds Release for `arm64`, stamps `MARKETING_VERSION` from the leading `x.y.z` of the repository version and `CURRENT_PROJECT_VERSION` from this checkout's commit count, then archives with `ditto -c -k --sequesterRsrc --keepParent`.

Before archiving it requires both nested executables (`dsh-web-host`, `dsh-web-host-spawn-helper`), a passing `codesign --verify --deep --strict`, and a `--help` run of the bundled host against a throwaway `DSH_HOME`. A recipient has no source-launch fallback, so a missing host or a broken bundle seal must fail on the packaging machine; an unsealed nested helper otherwise dies with SIGKILL ([nested signing](2026-08-13-swiftui-mac-shell.md#launch-contract)).

Both build configurations pin `ARCHS = arm64`. The macOS default is `arm64 x86_64`, which would produce a universal app whose Intel slice execs an arm64-only host.

The app icon is a real `AppIcon` asset-catalog set. [`scripts/make-app-icon.sh`](../../../../apps/macos/scripts/make-app-icon.sh) fills its ten slots from one square source PNG with `sips`.

## Alternatives considered

**Distribute a DMG.** A DMG changes presentation, not trust: an ad-hoc signature still fails Gatekeeper after download. It belongs with the notarized build.

**Enable Hardened Runtime now and add `com.apple.security.cs.disable-library-validation`.** That entitlement is the shortest path to a notarized build, but it is a public-release decision that also needs a Developer ID certificate and a `notarytool` key. Neither is required to hand a colleague a build today.

**Move the native addons into `Contents/Frameworks` first.** That removes the runtime write of executable code to `~/.cache/pkg` and is the durable answer for notarization, but it changes how the packaged host resolves addons, which is host work rather than packaging work.

**`xcodebuild archive` plus `-exportArchive`.** Export needs an ExportOptions.plist and a real signing identity. A Release `build` into a private `-derivedDataPath` yields the same bundle for an ad-hoc artifact.

**`zip -r` instead of `ditto`.** `zip` drops resource forks and can corrupt the bundle signature.

**Stamp the version by editing `project.pbxproj`.** Hardcoded `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` values drift and give every build the same identity. Passing them as `xcodebuild` overrides keeps the checked-in project at its development values.

## Consequences

**Bought:** any Apple Silicon Mac on macOS 14 or later can run the product window from one zip, with no clone, Node, or pnpm. A build that would fail on a tester's machine for a missing or unsealed nested host fails during packaging instead. Version, build number, and revision are printed with the archive, so a tester's report identifies the exact bundle.

**Paid:** the artifact is not distributable to users. Gatekeeper rejects an ad-hoc signature once a download sets the quarantine attribute, so every recipient runs `xattr -dr com.apple.quarantine` — a step that also disarms the check for anything else in that bundle, which is acceptable only for a build handed over directly. The commit count is monotonic on `master` but not across branches, so two branch builds can share a `CFBundleVersion`; a public release needs a tag-derived number. There is no update channel. Linux CI cannot run this script, and the macOS packaging path has no automated coverage beyond `--help`, the non-Darwin refusal, and the `--dry-run` command plan.

A public release additionally requires a Developer ID Application certificate, `ENABLE_HARDENED_RUNTIME = YES`, `codesign --timestamp` in place of the ad-hoc `--timestamp=none` in [`copy-web-host.sh`](../../../../apps/macos/scripts/copy-web-host.sh), a resolution of the library-validation conflict above, `notarytool submit` with stapling, and a macOS runner job. TCC still gates `~/Documents`, `~/Desktop`, and `~/Downloads` for this unsandboxed app, and the child process does not inherit the `NSOpenPanel` grant, so a workspace under those folders needs its own verification before a public build.
