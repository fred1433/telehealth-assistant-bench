#!/bin/bash
# Positive and reference controls: overlay a control implementation on the frozen base and grade it.
# usage: controls.sh <task> <reference|faulty>
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$1"; KIND="$2"
DST=/private/tmp/thb-adaptive/controls/$T-$KIND
mkdir -p /private/tmp/thb-adaptive/controls /private/tmp/thb-adaptive/results/controls
if [ -d "$DST" ]; then mv "$DST" "$DST.old.$(date +%s%N)"; fi
cp -c -R /private/tmp/thb-adaptive/base "$DST"
cp -R "$HERE/controls/$T/$KIND/." "$DST/"
# Paths listed in .delete are removed (python, confined to the control tree).
/usr/bin/python3 - "$DST" <<'PY2'
import sys, pathlib
root = pathlib.Path(sys.argv[1]).resolve(); lst = root / ".delete"
if lst.exists():
    for line in lst.read_text().split():
        p = (root / line).resolve()
        if root in p.parents and p.is_file(): p.unlink()
    lst.unlink()
PY2
"$HERE/node_modules/.bin/tsx" "$HERE/grade.ts" --task "$T" --dir "$DST" --out "/private/tmp/thb-adaptive/results/controls/$T-$KIND.json" 2>/dev/null | tail -1
