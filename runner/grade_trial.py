#!/usr/bin/env python3
"""Grades a finished trial directory (RUN/done/<trial>) and copies its evidence to results/raw/<trial>/."""
import json, shutil, subprocess, sys
from pathlib import Path

DEMO = Path(__file__).resolve().parent.parent

def main():
    tdir = Path(sys.argv[1])
    meta = json.loads((tdir / 'meta.json').read_text())
    repo = tdir / 'repo'
    res = DEMO / 'results' / 'raw' / meta['trial']
    res.mkdir(parents=True, exist_ok=True)
    g = subprocess.run([str(DEMO / 'grader/node_modules/.bin/tsx'), str(DEMO / 'grader/grade.ts'), '--task', meta['task'], '--dir', str(repo),
                        '--transcript', str(tdir / 'transcript.jsonl'), '--meta', str(tdir / 'meta.json'), '--out', str(res / 'verdict.json')],
                       capture_output=True, text=True, cwd=DEMO / 'grader')
    line = g.stdout.strip().splitlines()[-1] if g.stdout.strip() else 'GRADER ERROR ' + g.stderr[-800:]
    print(meta['trial'], line, flush=True)
    shutil.copy(tdir / 'meta.json', res / 'meta.json')
    subprocess.run(['git', 'add', '-A'], cwd=repo, capture_output=True)
    diff = subprocess.run(['git', 'diff', '--cached', 'HEAD', '--', '.', ':!node_modules'], cwd=repo, capture_output=True, text=True).stdout
    (res / 'diff.patch').write_text(diff)
    shutil.copy(tdir / 'transcript.jsonl', res / 'transcript.raw.jsonl')
    # Disk budget: once graded, the working copy is no longer needed (diff, transcript and verdict are kept).
    done_root = Path('/private/tmp/thb-adaptive/done').resolve()
    work = repo.resolve()
    if work.parent.parent == done_root and work.name == 'repo':
        shutil.rmtree(work)

if __name__ == '__main__':
    main()
