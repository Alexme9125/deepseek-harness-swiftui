#!/bin/zsh
# Print the checkout root. Xcode sets SRCROOT to apps/macos; without SRCROOT
# this file lives at apps/macos/scripts/resolve-repo.sh. Walks up until
# apps/cli/src/bin.ts exists — the same marker LaunchResolver uses.
set -euo pipefail

if [[ -n "${SRCROOT:-}" ]]; then
  dir="$(cd "$SRCROOT" && pwd)"
else
  dir="$(cd "$(dirname "$0")" && pwd)"
fi

while true; do
  if [[ -f "$dir/apps/cli/src/bin.ts" ]]; then
    print -r -- "$dir"
    exit 0
  fi
  parent="${dir:h}"
  if [[ "$parent" == "$dir" ]]; then
    break
  fi
  dir="$parent"
done

print -u2 "error: could not find the DeepSeek Harness repository root (no apps/cli/src/bin.ts above ${SRCROOT:-$(dirname "$0")})."
exit 1
