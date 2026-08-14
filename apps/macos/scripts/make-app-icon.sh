#!/bin/zsh
# Fill AppIcon.appiconset from one square source PNG using macOS `sips`.
# Rewrites Contents.json with the generated filenames, so the committed empty
# slot list becomes a complete icon set. Re-run it to replace an existing icon.
set -euo pipefail

REPO="$("$(cd "$(dirname "$0")" && pwd)/resolve-repo.sh")"
ICONSET="$REPO/apps/macos/DeepSeekHarness/Assets.xcassets/AppIcon.appiconset"

if [[ $# -ne 1 ]]; then
  print -u2 "usage: apps/macos/scripts/make-app-icon.sh <source-1024x1024.png>"
  exit 1
fi

SOURCE="$1"
if [[ ! -f "$SOURCE" ]]; then
  print -u2 "error: $SOURCE does not exist."
  exit 1
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  print -u2 "error: this script needs macOS \`sips\`."
  exit 1
fi

width="$(/usr/bin/sips -g pixelWidth "$SOURCE" | /usr/bin/awk '/pixelWidth/ {print $2}')"
height="$(/usr/bin/sips -g pixelHeight "$SOURCE" | /usr/bin/awk '/pixelHeight/ {print $2}')"
if [[ -z "$width" || -z "$height" ]]; then
  print -u2 "error: could not read the pixel dimensions of $SOURCE; is it a PNG?"
  exit 1
fi
if [[ "$width" != "$height" ]]; then
  print -u2 "error: $SOURCE is ${width}x${height}; an app icon source must be square."
  exit 1
fi
if (( width < 1024 )); then
  print -u2 "error: $SOURCE is ${width}x${width}; 1024x1024 is the largest slot and upscaling would blur it."
  exit 1
fi

mkdir -p "$ICONSET"

# slot name : pixel size. macOS asks for 16/32/128/256/512 points at 1x and 2x.
slots=(
  'icon_16x16.png:16'
  'icon_16x16@2x.png:32'
  'icon_32x32.png:32'
  'icon_32x32@2x.png:64'
  'icon_128x128.png:128'
  'icon_128x128@2x.png:256'
  'icon_256x256.png:256'
  'icon_256x256@2x.png:512'
  'icon_512x512.png:512'
  'icon_512x512@2x.png:1024'
)

for slot in "${slots[@]}"; do
  name="${slot%%:*}"
  size="${slot##*:}"
  /usr/bin/sips --resampleHeightWidth "$size" "$size" "$SOURCE" --out "$ICONSET/$name" >/dev/null
  print "make-app-icon: wrote $name (${size}x${size})"
done

cat > "$ICONSET/Contents.json" <<'JSON'
{
  "images" : [
    {
      "filename" : "icon_16x16.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "16x16"
    },
    {
      "filename" : "icon_16x16@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "16x16"
    },
    {
      "filename" : "icon_32x32.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "32x32"
    },
    {
      "filename" : "icon_32x32@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "32x32"
    },
    {
      "filename" : "icon_128x128.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "128x128"
    },
    {
      "filename" : "icon_128x128@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "128x128"
    },
    {
      "filename" : "icon_256x256.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "256x256"
    },
    {
      "filename" : "icon_256x256@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "256x256"
    },
    {
      "filename" : "icon_512x512.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "512x512"
    },
    {
      "filename" : "icon_512x512@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "512x512"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
JSON

print "make-app-icon: updated $ICONSET/Contents.json"
