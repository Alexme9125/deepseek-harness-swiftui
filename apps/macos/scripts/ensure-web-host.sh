#!/bin/zsh
# Builds apps/macos/dist/dsh-web-host when missing. Xcode Run invokes this
# after ensure-web-dist.sh. Linux and DSH_SKIP_WEB_HOST_BUILD=1 skip.
set -euo pipefail

REPO="$("$(cd "$(dirname "$0")" && pwd)/resolve-repo.sh")"
cd "$REPO"

export CI=true
export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.nvm/nvm.sh"
  nvm use --silent default >/dev/null 2>&1 || true
fi
if [[ -s "${HOME}/.zshrc" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.zshrc" >/dev/null 2>&1 || true
fi

HOST="$REPO/apps/macos/dist/dsh-web-host"
if [[ -x "$HOST" ]]; then
  print "ensure-web-host: $HOST already present"
  exit 0
fi

if [[ "${DSH_SKIP_WEB_HOST_BUILD:-}" == "1" ]]; then
  print "ensure-web-host: skipped (DSH_SKIP_WEB_HOST_BUILD=1); the app will use source launch when Node is available"
  exit 0
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  print "ensure-web-host: skip (not macOS); Linux cannot produce node24-macos-arm64"
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  print -u2 "error: pnpm not found. Install Node.js ^22.19 or >=24 with Corepack, then Run again from Xcode."
  exit 1
fi

SKIP_BUILD=()
if [[ -f apps/cli/lib/packaged-bin.js && -f apps/web/dist/index.html ]]; then
  SKIP_BUILD=(--skip-build)
  print "ensure-web-host: lib and frontend dist present; skipping pnpm run build"
fi

if [[ ! -f apps/macos/scripts/build-web-host.ts ]]; then
  print -u2 "error: $REPO is not the repository root (missing apps/macos/scripts/build-web-host.ts)."
  exit 1
fi

print "ensure-web-host: packaging dsh-web-host (first time can take several minutes)"
pnpm exec tsx apps/macos/scripts/build-web-host.ts --targets=node24-macos-arm64 "${SKIP_BUILD[@]}"
