#!/bin/zsh
# Copy a built dsh-web-host into Contents/MacOS when present. Missing files
# are not an error: LaunchResolver then uses source launch or PATH dsh.
set -euo pipefail

HOST="${SRCROOT}/dist/dsh-web-host"
DEST="${BUILT_PRODUCTS_DIR}/${CONTENTS_FOLDER_PATH}/MacOS/dsh-web-host"

if [[ ! -x "$HOST" ]]; then
  echo "copy-web-host: no $HOST; skipping (source launch remains available)"
  exit 0
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
