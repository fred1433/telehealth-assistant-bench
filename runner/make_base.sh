#!/bin/bash
# Exports the clinic repository at a git ref into the run area, with dependencies cloned in (APFS clone).
set -euo pipefail
REF="${1:-HEAD}"
DEMO="$(cd "$(dirname "$0")/.." && pwd)"
RUNROOT=/private/tmp/thb-adaptive
if [ -d "$RUNROOT/base" ]; then mv "$RUNROOT/base" "$RUNROOT/base.old.$(date +%s)"; fi
mkdir -p "$RUNROOT/base"
git -C "$DEMO" archive "$REF" clinic | tar -x -C "$RUNROOT/base" --strip-components=1
cp -c -R "$DEMO/clinic/node_modules" "$RUNROOT/base/node_modules"
git -C "$DEMO" rev-parse "$REF" > "$RUNROOT/base/.bench-ref"
echo "base at $(cat "$RUNROOT/base/.bench-ref")"
