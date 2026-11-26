#!/usr/bin/env python3
"""Recomputes every number shown on the page from results/published/ and writes site/data/results.json."""
import json, math, sys
from pathlib import Path

DEMO = Path(__file__).resolve().parent.parent
PUB = DEMO / 'results' / 'published'
TASKS = ['t1', 't2', 't3', 't4', 't5', 't6']
ARMS = ['A', 'B', 'C']

def wilson(k, n, z=1.959964):
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return (round(max(0.0, c - h), 3), round(min(1.0, c + h), 3))

def places(v):
    seen = []
    for f in v['findings']:
        if f['channel'] not in seen:
            seen.append(f['channel'])
    return seen

def build():
    cells = {t: {a: [] for a in ARMS} for t in TASKS}
    meta_all = []
    for d in sorted(PUB.glob('measured-*')):
        v = json.loads((d / 'verdict.json').read_text())
        m = json.loads((d / 'meta.json').read_text())
        meta_all.append(m)
        a = v.get('assistant') or {}
        cells[m['task']][m['arm']].append({
            'trial': d.name, 'rep': m['rep'], 'state': v['state'], 'places': places(v),
            'failedChecks': [c['name'] for c in v['checks'] if not c['ok']],
            'turns': a.get('turns'), 'minutes': round((m.get('wallSeconds') or 0) / 60, 1),
            'guardBlocks': len(a.get('guardBlocks') or []), 'verifyReruns': a.get('verifyReruns') or 0,
            'protectedAttempts': len(a.get('protectedAttempts') or []), 'interrupted': a.get('interrupted'),
        })
    # One cell per (task, arm, rep): a quota-interrupted trial that was rerun keeps only the rerun.
    for t in TASKS:
        for arm in ARMS:
            by_rep = {}
            for c in sorted(cells[t][arm], key=lambda c: c['trial']):
                if c['rep'] in by_rep and by_rep[c['rep']]['interrupted'] == 'quota':
                    by_rep[c['rep']] = c
                elif c['rep'] not in by_rep:
                    by_rep[c['rep']] = c
            cells[t][arm] = [by_rep[r] for r in sorted(by_rep)]
    totals = {}
    for arm in ARMS:
        allc = [c for t in TASKS for c in cells[t][arm]]
        k = sum(c['state'] == 'pass' for c in allc)
        lo, hi = wilson(k, len(allc))
        totals[arm] = {'pass': k, 'n': len(allc), 'ciLow': lo, 'ciHigh': hi,
                       'states': {s: sum(c['state'] == s for c in allc) for s in ('pass', 'function_failed', 'boundary', 'blocked', 'interrupted')}}
    per_task = {t: {arm: {'pass': sum(c['state'] == 'pass' for c in cells[t][arm]), 'n': len(cells[t][arm])} for arm in ARMS} for t in TASKS}
    models = sorted({m['model'] for m in meta_all})
    return {
        'model': models, 'claudeCodeVersion': sorted({m['claudeCodeVersion'] for m in meta_all}),
        'baseRef': sorted({m['baseRef'] for m in meta_all}), 'maxTurns': sorted({m['maxTurns'] for m in meta_all}),
        'timeoutMinutes': sorted({m['timeoutS'] // 60 for m in meta_all}), 'trials': len(meta_all),
        'cells': cells, 'perTask': per_task, 'totals': totals,
    }

if __name__ == '__main__':
    out = DEMO / 'site' / 'data' / 'results.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    data = build()
    out.write_text(json.dumps(data, indent=1))
    print(json.dumps(data['totals']))
