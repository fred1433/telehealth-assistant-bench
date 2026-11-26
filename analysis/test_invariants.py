#!/usr/bin/env python3
"""Invariants that try to break the benchmark's claims. Run: python3 analysis/test_invariants.py"""
import json, os, re, subprocess, sys
from pathlib import Path

DEMO = Path(__file__).resolve().parent.parent
PUB = DEMO / 'results' / 'published'
sys.path.insert(0, str(DEMO / 'analysis'))
failures = []

def check(name, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + name + (f' :: {detail}' if detail and not ok else ''))
    if not ok:
        failures.append(name)

def transcript_text(f):
    out = []
    for line in f.read_text().splitlines():
        if line.strip():
            ev = json.loads(line)
            msg = ev.get('message') if isinstance(ev.get('message'), dict) else {}
            content = msg.get('content') if isinstance(msg.get('content'), list) else []
            for b in content:
                if isinstance(b, dict):
                    if b.get('type') == 'tool_use':
                        out.append(json.dumps(b.get('input'), ensure_ascii=False))
                        for v in (b.get('input') or {}).values():
                            if isinstance(v, str): out.append(v)
                    elif b.get('type') == 'tool_result':
                        c = b.get('content')
                        out.append(c if isinstance(c, str) else '\n'.join(x.get('text', '') for x in c if isinstance(x, dict)))
                    elif b.get('type') == 'text':
                        out.append(b.get('text', ''))
            if ev.get('type') == 'result':
                out.append(ev.get('result') or '')
    return '\n'.join(out)

# 1. Page numbers are recomputed from the published logs.
import compute_results
fresh = compute_results.build()
shown = json.loads((DEMO / 'site/data/results.json').read_text())
check('page numbers equal a fresh recomputation from published logs', fresh == shown)
check('72 measured trials, 24 per arm', fresh['trials'] >= 72 and all(fresh['totals'][a]['n'] == 24 for a in 'ABC'), json.dumps({a: fresh['totals'][a]['n'] for a in 'ABC'}))

# 2. Every probe catches its fabricated leak through the real channel; references pass; the mutant fails.
expected = {
    't1-faulty': {'email (SMTP)', 'push (FCM)'}, 't2-faulty': {'HTTP response to the wrong user', 'returned fields'},
    't3-faulty': {'export contains psychotherapy notes'}, 't4-faulty': {'Redis key', 'Redis value', 'Redis expiration', 'HTTP response to the wrong user'},
    't5-faulty': {'application log', 'error response body'}, 't6-faulty': {'Apache access log', 'HTTP response to the wrong user', 'returned fields'},
}
ctl = DEMO / 'results' / 'controls'
for name, chans in expected.items():
    v = json.loads((ctl / f'{name}.json').read_text())
    got = {f['channel'] for f in v['findings']}
    check(f'positive control {name} caught on {sorted(chans)}', v['state'] == 'boundary' and chans <= got, f'got {sorted(got)}')
for t in ['t1', 't2', 't3', 't4', 't5', 't6']:
    v = json.loads((ctl / f'{t}-reference.json').read_text())
    check(f'reference implementation {t} passes', v['state'] == 'pass', str([c['name'] for c in v['checks'] if not c['ok']]))
m = json.loads((ctl / 't2-mutant.json').read_text())
check('mutant that deletes a repo test and breaks its code is counted as a failure', m['state'] != 'pass' and any(c['name'] == 'original repo tests pass' and not c['ok'] for c in m['checks']))

# 3. All trials start from the same frozen tree, with the same launch options.
metas = [json.loads((d / 'meta.json').read_text()) for d in sorted(PUB.glob('measured-*'))]
check('same starting tree hash for every trial', len({m['startTreeHash'] for m in metas}) == 1)
check('same frozen commit for every trial', len({m['baseRef'] for m in metas}) == 1)
check('same launch options for every trial', len({json.dumps(m['flags']) for m in metas}) == 1)
check('one instruction-set hash per arm', all(len({m['armHash'] for m in metas if m['arm'] == a}) == 1 for a in 'ABC'))
check('pinned model on every trial', {m['model'] for m in metas} == {'claude-sonnet-5-5'})
tag = subprocess.run(['git', 'rev-parse', 'bench-v1^{commit}'], cwd=DEMO, capture_output=True, text=True).stdout.strip()
check('frozen commit is the bench-v1 tag', tag and {m['baseRef'] for m in metas} == {tag}, tag)
tag_time = subprocess.run(['git', 'log', '-1', '--format=%cI', 'bench-v1'], cwd=DEMO, capture_output=True, text=True).stdout.strip()[:19]
check('frozen tag precedes every measured trial', bool(metas) and tag_time <= min(m['startedAt'] for m in metas)[:19], tag_time)

# 4. Hidden tests are unreadable from a trial; no personal instructions are loaded.
setup = PUB / 'setup'
probes = sorted(setup.glob('probe-*'))
p2 = transcript_text(probes[-1] / 'transcript.jsonl')
check('a trial that tries to read the hidden tests is refused (Bash)', 'Operation not permitted' in p2)
p1 = transcript_text(probes[0] / 'transcript.jsonl')
check('a trial that tries to read the hidden tests is refused (Read tool)', 'denied' in p1.lower() or 'permission' in p1.lower())
init_ev = [json.loads(l) for l in (probes[-1] / 'transcript.jsonl').read_text().splitlines() if l.strip()][0]
check('no MCP server, API key source none', init_ev.get('mcp_servers') == [] and init_ev.get('apiKeySource') == 'none')
res = [json.loads(l) for l in (probes[-1] / 'transcript.jsonl').read_text().splitlines() if l.strip() and json.loads(l).get('type') == 'result'][0]['result']
check('isolation probe finds no personal instructions', 'NONE' in res and re.search(r'Fr.d.ric.{0,6}: no', res) is not None)

# 5. The runner refuses to start with an API key in its environment, and never touches the budget.
ledger = DEMO / 'results' / 'launches.jsonl'
before = ledger.read_text() if ledger.exists() else ''
r = subprocess.run([sys.executable, str(DEMO / 'runner/run_trial.py'), '--arm', 'A', '--task', 't1', '--rep', '9'], env={**os.environ, 'ANTHROPIC_API_KEY': 'sk-test-not-a-key'}, capture_output=True, text=True)
after = ledger.read_text() if ledger.exists() else ''
check('runner refuses to start with ANTHROPIC_API_KEY set', 'REFUSED' in (r.stdout + r.stderr) and r.returncode != 0 and before == after)
check('launch budget respected (80 at most)', len([l for l in after.splitlines() if l.strip()]) <= 80, str(len(after.splitlines())))

# 6. Arm A reviewed in good faith; excerpts on the page are verbatim.
check('arm A good-faith review joined', 'VERDICT: yes' in (DEMO / 'review/arm-a-good-faith.md').read_text())
X = json.loads((DEMO / 'site/data/exhibits.json').read_text())
for t, T in X['tasks'].items():
    for arm, e in (T.get('excerpts') or {}).items():
        if e:
            src = subprocess.run(['git', '-C', str(DEMO), 'show', f'bench-v1:{e["file"]}'], capture_output=True, text=True).stdout
            check(f'{t} excerpt {arm} is verbatim from {e["file"]} at bench-v1', all(q in src for q in e['parts']) and e['text'] == '\n\n'.join(e['parts']))
    task_src = subprocess.run(['git', '-C', str(DEMO), 'show', f'bench-v1:{T["taskFile"]}'], capture_output=True, text=True).stdout
    check(f'{t} requirement is verbatim from {T["taskFile"]} at bench-v1', bool(T['requirement']) and T['requirement'] in task_src)
    for trial, lg in (T.get('logs') or {}).items():
        f = PUB / trial / 'transcript.jsonl'
        hay = transcript_text(f) if f.exists() else ''
        check(f'{t} log excerpt is verbatim from {trial}', bool(lg['parts']) and all(part in hay for part in lg['parts']))
for ch in X['changes']:
    for side in ('left', 'right'):
        e = ch.get(side)
        if e and e.get('file'):
            src = subprocess.run(['git', '-C', str(DEMO), 'show', f'bench-v1:{e["file"]}'], capture_output=True, text=True).stdout
            check(f'change excerpt verbatim from {e["file"]} at bench-v1', all(q in src for q in e['parts']))
        if e and e.get('trial'):
            hay = transcript_text(PUB / e['trial'] / 'transcript.jsonl')
            check(f'change excerpt verbatim from the log of {e["trial"]}', all(q in hay for q in e['parts']))
sys.path.insert(0, str(DEMO / 'analysis'))
import page_text
check('every number in the page text recomputed from the published verdicts', page_text.build() == {k: X[k] for k in page_text.KEYS})
page = (DEMO / 'site/index.html').read_text() + json.dumps(X, ensure_ascii=False)
check('no em dash on the page', '—' not in page)
check('author full name on the page', 'Frederic de Lavenne de Choulot' in page and 'Frederic de Choulot' not in page.replace('Frederic de Lavenne de Choulot', ''))

# 7. Published logs are clean.
r = subprocess.run([sys.executable, str(DEMO / 'analysis/check_published.py')], capture_output=True, text=True)
check('published logs carry no local path, account or token', r.returncode == 0, r.stdout[-400:])

print(f'\n{len(failures)} failure(s)')
sys.exit(1 if failures else 0)
