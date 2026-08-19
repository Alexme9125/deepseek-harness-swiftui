# Agent Note: This fork publishes the ad-hoc macOS DMG as a GitHub Release

Status: implemented

English | [中文](2026-08-14-macos-dmg-github-release.zh.md)

## Problem

[Internal distribution](2026-08-14-macos-internal-distribution.md) produces an ad-hoc signed zip on a Mac with Xcode. Recipients of this personal fork still had to obtain that zip out of band. The root README still described the official DeepSeek Harness project, so a Darwin Anime Club reader could not tell what this checkout is, who owns it, how to install the app, or that the bundled host cannot load extra plugins.

A notarized Developer ID build remains blocked by library validation against unsigned `.node` addons extracted to `~/.cache/pkg`. Waiting for that work leaves the fork without a downloadable app.

## Decision

[`scripts/package-app.ts`](../../../../apps/macos/scripts/package-app.ts) writes a UDZO DMG beside the existing zip: it stages `DeepSeekHarness.app` with an `/Applications` symlink and runs `hdiutil create -format UDZO`. Gatekeeper behavior is unchanged from the zip; the DMG is presentation for a GitHub Release.

[`.github/workflows/macos-dmg-release.yml`](../../../../.github/workflows/macos-dmg-release.yml) runs on `macos-15` (Apple Silicon). `workflow_dispatch` from a `macos-v*` ref publishes that tag; dispatch from another ref publishes a `macos-snapshot-<sha>` prerelease. A tag push does not start the job ([manual GitHub Actions](../process/2026-08-19-fork-manual-github-actions.md)). The job installs, runs `pnpm run package:macos-app`, and attaches the single `DeepSeekHarness-*-arm64.dmg` with `contents: write`. Linux CI still cannot produce the image; the workflow is the packaging machine.

The root README is this fork's product page: personal ownership (Alex Xiao, Darwin Anime Club technical department member; not an official DeepSeek AI or Darwin Anime Club product), Cursor/Grok/Composer authorship, DMG install including the quarantine command, the closed plugin set, and the two ways to add a plugin ([`dsh plugin add` from source](../../../../docs/user/develop/basic/publish.md), or a `workspace:` row on [`web-host/package.json`](../../../../apps/macos/web-host/package.json) plus a rebuild). `#run` and `#run-from-source` stay valid for inbound docs.

## Alternatives considered

**Keep handing the zip privately and leave the upstream README.** Rejected: the user-visible contract for this fork is a GitHub Release plus a README that states ownership, origin, install, and the plugin limit.

**Wait for Developer ID, Hardened Runtime, and notarization.** Rejected for this personal release: the [library-validation conflict](2026-08-14-macos-internal-distribution.md) is still unresolved, and an ad-hoc DMG with an explicit `xattr` step is enough for club members who already accept that command on a zip.

**Upload only the zip to the Release.** Rejected: a DMG with an Applications symlink is the install path the README describes. The zip remains a packaging byproduct.

**Build the DMG on the Linux cloud agent.** Impossible: `xcodebuild` and `hdiutil` need macOS. The GitHub-hosted `macos-15` runner is the packaging host.

**Trigger the packager on every pull request.** Rejected: an Apple Silicon `pnpm run build` plus `@yao-pkg/pkg --sea` of the web-host is too expensive to run as a required check.

## Consequences

**Bought:** a dispatched run from a `macos-v*` ref produces a GitHub Release whose asset is the Apple Silicon DMG. The README states that this is Alex's personal project, names Darwin Anime Club affiliation without claiming club ownership, discloses Cursor/Grok/Composer authorship, and tells a recipient both that plugins cannot be installed conveniently into the DMG and how to add them from source or by rebuilding.

**Paid:** Gatekeeper still blocks the download until `xattr -dr com.apple.quarantine` runs on the `.app`; that command also disarms the check for anything else in the bundle. The Release is not notarized and has no update channel. A `workflow_dispatch` snapshot tag is a second identifier beside `macos-v*`. Hosted macOS runners bill minutes; a failed packing job still costs a full `pnpm run build`. The translation-prompt gold pair includes the root README, so a README edit refreshes that snapshot.
