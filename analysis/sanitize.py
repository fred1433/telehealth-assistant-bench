#!/usr/bin/env python3
"""Builds results/published/ from results/raw/: transcripts, verdicts, meta and diffs with local paths,
account details and tokens removed. check_published.py then refuses any leftover pattern."""
import json, re, shutil, sys
from pathlib import Path

DEMO = Path(__file__).resolve().parent.parent
RAW, PUB = DEMO / 'results' / 'raw', DEMO / 'results' / 'published'
HOME, USER = str(Path.home()), Path.home().name

SUBS = [
    (re.compile(r'/private/tmp/thb-adaptive/(?:w|done)/[^/\s"\\]+/repo'), '/work/repo'),
    (re.compile(r'/private/tmp/thb-adaptive/(?:w|done)/[^/\s"\\]+'), '/work'),
    (re.compile(r'/private/tmp/thb-adaptive'), '/bench'),
    (re.compile(r'(/private)?/tmp/claude-501(?:/[^\s"\\`]*)?'), '/tmp/claude-sandbox'),
    (re.compile(re.escape(str(DEMO))), '/bench-repo'),
    (re.compile(re.escape(HOME)), '/home/operator'),
    (re.compile(r'\.claude-account\d'), '.claude'),
    (re.compile(r'\b' + re.escape(USER) + r'\b', re.I), 'operator'),
    (re.compile(r'[A-Za-z0-9._%+-]+@(?!(?:mail|juniper|fernside|clinic)\.example\b)[A-Za-z0-9-]+\.(?:com|net|org|io)\b'), '[account]'),
    (re.compile(r'((?:TOKEN|PASSWORD|SECRET|API_KEY|PROXY_PASSWORD)[A-Z_]*=)[^\s"\\]+'), r'\1[redacted]'),
    (re.compile(r'(sk-ant-[A-Za-z0-9_-]{6})[A-Za-z0-9_-]+'), r'\1[redacted]'),
]

def clean(text: str) -> str:
    for pat, rep in SUBS:
        text = pat.sub(rep, text)
    return text

def main():
    # Rebuilds only what results/raw/ holds; a clone without raw logs keeps the published ones as they are.
    if not RAW.is_dir():
        print('no results/raw/: published logs left as they are')
        return
    PUB.mkdir(parents=True, exist_ok=True)
    for d in sorted(RAW.iterdir()):
        if not d.is_dir() or not (d / 'verdict.json').exists():
            continue
        out = PUB / d.name
        if out.exists():
            shutil.rmtree(out)
        out.mkdir()
        lines = []
        for line in (d / 'transcript.raw.jsonl').read_text().splitlines():
            if not line.strip():
                continue
            ev = json.loads(line)
            if ev.get('type') == 'system' and ev.get('subtype') == 'init':
                ev = {k: ev.get(k) for k in ('type', 'subtype', 'model', 'cwd', 'tools', 'mcp_servers', 'permissionMode', 'apiKeySource', 'claude_code_version', 'skills', 'plugins', 'output_style')}
            lines.append(clean(json.dumps(ev, ensure_ascii=False)))
        (out / 'transcript.jsonl').write_text('\n'.join(lines) + '\n')
        for name in ('verdict.json', 'meta.json', 'diff.patch'):
            if (d / name).exists():
                (out / name).write_text(clean((d / name).read_text()))
    # Setup launches (isolation probes, /init) are published too: they prove the isolation claims.
    setup = PUB / 'setup'
    setup.mkdir(exist_ok=True)
    for d in sorted(Path('/private/tmp/thb-adaptive/done').glob('*')):
        if d.name.startswith(('probe-', 'init-')) and (d / 'transcript.jsonl').exists():
            (setup / d.name).mkdir(exist_ok=True)
            lines = []
            for line in (d / 'transcript.jsonl').read_text().splitlines():
                if line.strip():
                    ev = json.loads(line)
                    if ev.get('type') == 'system' and ev.get('subtype') == 'init':
                        ev = {k: ev.get(k) for k in ('type', 'subtype', 'model', 'cwd', 'tools', 'mcp_servers', 'permissionMode', 'apiKeySource', 'claude_code_version', 'skills', 'plugins', 'output_style')}
                    lines.append(clean(json.dumps(ev, ensure_ascii=False)))
            (setup / d.name / 'transcript.jsonl').write_text('\n'.join(lines) + '\n')
            if (d / 'meta.json').exists():
                (setup / d.name / 'meta.json').write_text(clean((d / 'meta.json').read_text()))
    print(f'published {len([d for d in PUB.iterdir() if d.name != "setup"])} trials')

if __name__ == '__main__':
    main()
