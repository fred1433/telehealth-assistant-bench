#!/usr/bin/env python3
"""Chooses one short excerpt per measured trial from its published (cleaned) transcript and writes it
into site/data/exhibits.json. Every excerpt is a verbatim slice of a tool call, a tool result or the
final answer; test_invariants.py checks each slice against the published transcript."""
import json
from pathlib import Path

DEMO = Path(__file__).resolve().parent.parent
PUB = DEMO / 'results' / 'published'
MAX = 900
EM = '—'

def events(trial):
    return [json.loads(l) for l in (PUB / trial / 'transcript.jsonl').read_text().splitlines() if l.strip()]

def result_text(b):
    c = b.get('content')
    return c if isinstance(c, str) else ''.join(x.get('text', '') for x in (c or []) if isinstance(x, dict))

def clip(s, n=MAX):
    s = s.strip('\n').rstrip()
    if EM in s:
        s = s.split(EM)[0].rstrip()
    return s if len(s) <= n else s[:n].rsplit('\n', 1)[0].rstrip()

def whole_lines(s):
    return s

def around(text, needle, before, after):
    i = text.find(needle)
    if i < 0:
        return text[:before + after]
    start = text.rfind('\n', 0, max(0, i - before)) + 1 if i - before > 0 else 0
    end = text.find('\n', i + after)
    return text[start:end if end > 0 else len(text)]

def pick(trial, verdict):
    ev = events(trial)
    uses, guard, final, log_edit = {}, None, None, None
    for e in ev:
        if e.get('type') == 'assistant':
            for b in e['message']['content']:
                if b.get('type') == 'tool_use':
                    uses[b['id']] = b
                    inp = b.get('input') or {}
                    code = inp.get('new_string') or inp.get('content') or ''
                    if 'logger.error' in code and 'http.ts' in str(inp.get('file_path', '')):
                        log_edit = (b, code)
        if e.get('type') == 'user' and isinstance(e['message'].get('content'), list):
            for b in e['message']['content']:
                if b.get('type') == 'tool_result' and guard is None and 'GUARD' in result_text(b):
                    guard = (uses.get(b.get('tool_use_id')), result_text(b))
        if e.get('type') == 'result':
            final = e.get('result')
    if guard and guard[0]:
        call, msg = guard
        inp = call['input']
        what = inp.get('command') or inp.get('new_string') or inp.get('content') or ''
        snippet = around(what, 'logger.', 120, 120) if 'logger.' in what else what[:300]
        g = msg[msg.find('GUARD'):]
        return {'caption': f'Arm C hook blocking {"an" if call["name"][0] in "AEIOU" else "a"} {call["name"]} call, and its message to the assistant.',
                'parts': [clip(snippet, 380), clip(g, 520)]}
    if verdict['state'] != 'pass' and log_edit:
        code = log_edit[1]
        return {'caption': 'The error-logging code this run wrote (Edit tool call).', 'parts': [clip(around(code, 'logger.error', 420, 300), 900)]}
    if final:
        return {'caption': "The assistant's closing summary, as written at the end of the run.", 'parts': [clip(final, 700)]}
    return None

def main():
    p = DEMO / 'site/data/exhibits.json'
    x = json.loads(p.read_text())
    for t in x['order']:
        x['tasks'][t]['logs'] = {}
    for d in sorted(PUB.glob('measured-*')):
        m = json.loads((d / 'meta.json').read_text())
        v = json.loads((d / 'verdict.json').read_text())
        got = pick(d.name, v)
        if got:
            x['tasks'][m['task']]['logs'][d.name] = {'caption': got['caption'], 'parts': got['parts'], 'text': '\n[...]\n'.join(got['parts'])}
    p.write_text(json.dumps(x, indent=1, ensure_ascii=False))
    print('log excerpts:', sum(len(x['tasks'][t]['logs']) for t in x['order']))

if __name__ == '__main__':
    main()
