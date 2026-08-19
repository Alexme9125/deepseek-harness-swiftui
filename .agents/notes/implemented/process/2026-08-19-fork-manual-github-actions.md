# Agent Note: This personal fork runs GitHub Actions only on demand

Status: implemented

English | [中文](2026-08-19-fork-manual-github-actions.zh.md)

## Problem

This repository is a personal macOS packaging fork of DeepSeek Harness. It inherited upstream GitHub Actions that need enterprise runner labels, in-house self-hosted pools, npm and PyPI publisher identity, `DEEPSEEK_API_KEY_EXTERNAL`, a GitHub App for Issue Project tokens, and Pages. Those jobs fail on every push, every pull request, and every nightly e2e schedule. The first Apple Silicon GitHub Release is already published; automatic npm pack, DMG tag publication, CI, sandbox, and real-API runs are not this fork's product.

## Decision

Every workflow under [`.github/workflows`](../../../../.github/workflows) keeps its job graph so local YAML tests can still pin runner isolation, failover switches, and publication steps. This repository does not subscribe automatic GitHub events: `push`, `pull_request`, `pull_request_review`, `schedule`, and `issues` are absent. Remaining triggers are `workflow_dispatch` and, for the Python wheel builder, `workflow_call`. [scripts/ci-workflow.spec.ts](../../../../scripts/ci-workflow.spec.ts) rejects any other event key on those files.

The [macOS DMG workflow](../architecture/2026-08-14-macos-dmg-github-release.md) publishes only when dispatched. Dispatch from a `macos-v*` ref publishes that tag; dispatch from another ref publishes a `macos-snapshot-<sha>` prerelease. A tag push does not start a runner.

Job-graph Agent Notes that describe enterprise CI, npm sequences, issue policy, and Python publication remain the authority for those YAML contents. This note is the authority for which GitHub events this repository executes.

## Alternatives considered

**Delete the workflow files.** Local tests parse those YAML files, and hundreds of Agent Notes and docs link them. Removing the files would replace a trigger change with a repository-wide documentation and test rewrite.

**Leave `on:` intact and set `if: false` on every job.** GitHub still queues a run for each event. Tests pin exact job `if:` strings, so the skip would also rewrite those assertions.

**Disable workflows only in the GitHub UI.** That state is not reviewable in git, and a later identical workflow file can start again. The nightly e2e schedule would return whenever the file is considered new.

**Keep the `macos-v*` tag trigger.** Automatic packaging is what this fork just finished for `macos-v0.1.0`. Dispatch from that tag still publishes; a push of a new tag does not spend hosted macOS minutes by default.

## Consequences

**Bought:** master pushes, pull requests, and the nightly e2e cron do not start jobs. npm pack, vendor pack, sandbox, issue policy, issue lifecycle, and the 24-hour self-hosted CI standby do not queue on this fork.

**Paid:** this repository does not have GitHub-hosted proof of the upstream matrix, publication rehearsal, or Issue Project automation. Local hooks and selected tests remain. A later DMG requires a manual dispatch, or restoring the tag trigger in a new change. Dispatching CI still requests enterprise and self-hosted labels this fork does not have.
