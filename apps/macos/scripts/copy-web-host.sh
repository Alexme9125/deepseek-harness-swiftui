#!/bin/zsh
# Copy a built dsh-web-host into Contents/MacOS when present. Missing files
# are not an error: LaunchResolver then uses source launch or PATH dsh.
# After copy, ad-hoc-sign the nested binaries. Incremental Xcode builds skip
# CodeSign; a replaced nested helper then dies with SIGKILL (status 9, "Code
# Signature Invalid"), so reseal the .app when the main executable was already
# signed *before* this copy. On a full link this script runs first and the
# main binary is still unsigned — Xcode's CodeSign phase seals the bundle
# afterward. Do not pass --options runtime: Hardened Runtime would refuse the
# unsigned .node files pkg extracts to ~/.cache/pkg.
set -euo pipefail

HOST="${SRCROOT}/dist/dsh-web-host"
DEST="${BUILT_PRODUCTS_DIR}/${CONTENTS_FOLDER_PATH}/MacOS/dsh-web-host"

if [[ ! -x "$HOST" ]]; then
  echo "copy-web-host: no $HOST; skipping (source launch remains available)"
  exit 0
fi

identity="${EXPANDED_CODE_SIGN_IDENTITY:-}"
if [[ -z "$identity" || "$identity" == "-" ]]; then
  identity="-"
fi

should_reseal=0
if [[ "${CODE_SIGNING_ALLOWED:-YES}" != "NO" && -n "${CODESIGNING_FOLDER_PATH:-}" ]]; then
  main="$CODESIGNING_FOLDER_PATH/Contents/MacOS/${EXECUTABLE_NAME:-DeepSeekHarness}"
  if /usr/bin/codesign --verify "$main" >/dev/null 2>&1; then
    should_reseal=1
  fi
fi

mkdir -p "$(dirname "$DEST")"
cp "$HOST" "$DEST"
chmod +x "$DEST"
echo "copy-web-host: installed $DEST"

HELPER="${SRCROOT}/dist/dsh-web-host-spawn-helper"
HELPER_DEST="${BUILT_PRODUCTS_DIR}/${CONTENTS_FOLDER_PATH}/MacOS/dsh-web-host-spawn-helper"
if [[ -x "$HELPER" ]]; then
  cp "$HELPER" "$HELPER_DEST"
  chmod +x "$HELPER_DEST"
  echo "copy-web-host: installed $HELPER_DEST"
fi

if [[ "${CODE_SIGNING_ALLOWED:-YES}" == "NO" ]]; then
  echo "copy-web-host: CODE_SIGNING_ALLOWED=NO; nested host is unsigned"
  exit 0
fi

sign_nested() {
  local path="$1"
  local identifier="$2"
  if [[ ! -x "$path" ]]; then
    return 0
  fi
  /usr/bin/codesign --sign "$identity" --force --timestamp=none --identifier "$identifier" "$path"
  echo "copy-web-host: signed $path"
}

sign_nested "$DEST" "ai.deepseek.harness.web-host"
sign_nested "${HELPER_DEST:-}" "ai.deepseek.harness.web-host-spawn-helper"

if [[ "$should_reseal" -eq 0 ]]; then
  echo "copy-web-host: main executable not signed yet; Xcode CodeSign will seal the bundle"
  exit 0
fi

/usr/bin/codesign --sign "$identity" --force --timestamp=none \
  --preserve-metadata=identifier,entitlements,flags \
  "$CODESIGNING_FOLDER_PATH"
echo "copy-web-host: resealed $CODESIGNING_FOLDER_PATH"
