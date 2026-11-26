#!/usr/bin/env python3
"""Refuses publication if any local path, account detail or token pattern is left in results/published/."""
import os, re, sys
from pathlib import Path

PUB = Path(__file__).resolve().parent.parent / 'results' / 'published'
BAD = [r'/Users/', re.escape(Path.home().name), r'thb-adaptive', r'claude-account', r'claude-501', r'@gmail\.com', r'sk-ant-[A-Za-z0-9]{8}', r'ghp_[A-Za-z0-9]{10}', r'gho_[A-Za-z0-9]{10}', r'CLOUDFLARE_API_TOKEN=\w',
       r'ProjetsDev'] + [re.escape(x) for x in os.environ.get('BENCH_EXTRA_FORBIDDEN', '').split(',') if x]
bad = []
for f in PUB.rglob('*'):
    if f.is_file():
        t = f.read_text(errors='replace')
        for p in BAD:
            if re.search(p, t, re.I):
                bad.append(f'{f.relative_to(PUB)}: {p}')
if bad:
    print('REFUSED:\n' + '\n'.join(sorted(set(bad))[:50]))
    sys.exit(1)
print(f'clean: {sum(1 for f in PUB.rglob("*") if f.is_file())} files checked')
