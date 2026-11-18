#!/usr/bin/env bash
# Checks that this repo's SKILL.md is identical to the one Output Charts serves.
#
#   ./check-skill.sh                 compares with https://outputcharts.com/skill/SKILL.md
#   ./check-skill.sh <path>          compares with a local copy, e.g. apps/web/public/skill/SKILL.md
#   SKILL_URL=https://dev.outputcharts.com/skill/SKILL.md ./check-skill.sh
#
# Exit 0 when they match, 1 with a unified diff when they do not.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mine="$here/SKILL.md"

if [ "$#" -ge 1 ]; then
  theirs="$1"
  label="$1"
else
  theirs="$(mktemp)"
  trap 'rm -f "$theirs"' EXIT
  url="${SKILL_URL:-https://outputcharts.com/skill/SKILL.md}"
  curl -fsSL "$url" -o "$theirs"
  label="$url"
fi

if diff -u "$theirs" "$mine"; then
  echo "SKILL.md matches $label"
else
  echo "SKILL.md differs from $label (see the diff above); copy the site's file over this one" >&2
  exit 1
fi
