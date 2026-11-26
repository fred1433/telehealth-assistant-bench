#!/usr/bin/env python3
"""The measured campaign: 6 tasks x 3 arms x 4 trials, one `claude -p` at a time, arms interleaved and their
order rotated. Grading of a finished trial runs in the background while the next trial runs.
Re-entrant: trials already present in results/raw are skipped. A trial stopped by the subscription quota is
kept, marked, and run again (within the 80-launch cap enforced by run_trial.py)."""
import json, os, subprocess, sys, time
from pathlib import Path

DEMO = Path(__file__).resolve().parent.parent
TASKS = ['t1', 't2', 't3', 't4', 't5', 't6']
ROT = [['A', 'B', 'C'], ['B', 'C', 'A'], ['C', 'A', 'B'], ['A', 'C', 'B']]
QUOTA = Path(os.path.expanduser('~/.local/state/claude-quotas-rows.json'))  # operator's quota snapshot, if any
LOG = DEMO / 'results' / 'campaign.log'


def schedule():
    out = []
    for rep in range(1, 5):
        tasks = TASKS[rep - 1:] + TASKS[:rep - 1]
        for i, t in enumerate(tasks):
            for arm in ROT[(rep + i) % 4]:
                out.append((t, arm, rep))
    return out


def done(t, arm, rep):
    """A trial counts as done when its verdict exists and it was not interrupted by the quota."""
    for d in (DEMO / 'results' / 'raw').glob(f'measured-{t}-{arm}-r{rep}-*'):
        v = d / 'verdict.json'
        if not v.exists():
            return True  # grading pending: do not relaunch
        a = (json.loads(v.read_text()).get('assistant') or {})
        if a.get('interrupted') != 'quota':
            return True
    return False


def quota_ok():
    try:
        rows = json.loads(QUOTA.read_text())
        rows = rows.get('rows', rows) if isinstance(rows, dict) else rows
        r = next(x for x in rows if str(x.get('slot')) == '5')
        return (r.get('all') or 0) < 97 and (r.get('session') or 0) < 97
    except Exception:
        return True


def log(msg):
    with LOG.open('a') as f:
        f.write(time.strftime('%H:%M:%S ') + msg + '\n')


def main():
    graders = []
    for t, arm, rep in schedule():
        if done(t, arm, rep):
            continue
        while not quota_ok():
            log('quota high, waiting 10 min'); time.sleep(600)
        log(f'start {t} {arm} r{rep}')
        r = subprocess.run([sys.executable, str(DEMO / 'runner/run_trial.py'), '--arm', arm, '--task', t, '--rep', str(rep), '--no-grade'],
                           capture_output=True, text=True)
        tail = r.stdout.strip().splitlines()
        if r.returncode != 0 or not tail or not tail[-1].startswith('TRIAL_DIR'):
            log(f'runner failed {t} {arm} r{rep}: {r.stdout[-300:]} {r.stderr[-300:]}')
            if 'REFUSED' in r.stdout + r.stderr:
                break
            continue
        tdir = tail[-1].split(' ', 1)[1]
        log(f'ran {tail[0] if tail else ""}')
        graders.append(subprocess.Popen([sys.executable, str(DEMO / 'runner/grade_trial.py'), tdir], stdout=LOG.open('a'), stderr=subprocess.STDOUT))
    for g in graders:
        g.wait()
    log('campaign finished')


if __name__ == '__main__':
    main()
