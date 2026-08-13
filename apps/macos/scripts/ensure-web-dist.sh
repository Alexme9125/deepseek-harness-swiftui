#!/bin/zsh
# Ensures this checkout can launch `dsh web`. Xcode Run invokes this with SRCROOT=apps/macos.
set -euo pipefail

if [[ -n "${SRCROOT:-}" ]]; then
  REPO="$(cd "$SRCROOT/.." && pwd)"
else
  REPO="$(cd "$(dirname "$0")/../.." && pwd)"
fi

cd "$REPO"

export CI=true
export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.nvm/nvm.sh"
  nvm use --silent default >/dev/null 2>&1 || true
fi
if [[ -s "${HOME}/.zshrc" ]]; then
  # Pull login-style PATH pieces without requiring an interactive terminal.
  # shellcheck disable=SC1091
  source "${HOME}/.zshrc" >/dev/null 2>&1 || true
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

if [[ ! -d node_modules ]]; then
  print "ensure-web-dist: pnpm install"
  pnpm install
fi

if [[ ! -f apps/web/dist/index.html ]]; then
  print "ensure-web-dist: pnpm run build"
  pnpm run build
else
  print "ensure-web-dist: apps/web/dist already present"
fi
