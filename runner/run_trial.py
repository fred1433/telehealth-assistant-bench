#!/usr/bin/env python3
"""Runs ONE trial: fresh worktree from the frozen base, one arm's instruction set, one task, `claude -p`
on the subscription (never an API key), then grades it. Trials run one at a time.

usage: run_trial.py --arm A --task t1 --rep 1 [--set measured|tuning|probe|init] [--prompt-file F] [--no-grade]
"""
import argparse, hashlib, json, os, shutil, signal, subprocess, sys, time
from pathlib import Path

DEMO = Path(__file__).resolve().parent.parent
RUN = Path('/private/tmp/thb-adaptive')
BASE = RUN / 'base'
# The Claude Code binary and the subscription account's config dir come from the operator's environment.
CLAUDE_BIN = os.environ.get('BENCH_CLAUDE_BIN', 'claude')
CONFIG_DIR = os.environ.get('BENCH_CLAUDE_CONFIG_DIR', os.path.expanduser('~/.claude'))
MODEL = 'claude-sonnet-5-5'
MAX_TURNS = '60'
TIMEOUT_S = 25 * 60
PROTECT = DEMO / 'runner' / 'protect.settings.json'
LEDGER = DEMO / 'results' / 'launches.jsonl'
MAX_LAUNCHES = 80
TRIAL_DB = 'mysql://trial:trial-local-only@127.0.0.1:3417/trial'
TRIAL_REDIS = 'redis://127.0.0.1:6417/1'


def refuse_if_api_key():
    """0 $ guarantee: refuse to start if any API-key path could be used."""
    bad = [k for k in ('ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY') if os.environ.get(k)]
    for f in [Path(CONFIG_DIR) / 'settings.json', Path(CONFIG_DIR) / 'settings.local.json', PROTECT]:
        if f.exists() and 'apiKeyHelper' in f.read_text():
            bad.append(f'apiKeyHelper in {f.name}')
    if bad:
        sys.exit(f'REFUSED: API key path present ({", ".join(bad)}). Trials run on the subscription only.')


def launches_so_far():
    if not LEDGER.exists():
        return 0
    return sum(1 for l in LEDGER.read_text().splitlines() if l.strip())


def tree_hash(root: Path, skip=('node_modules', '.git', 'CLAUDE.md', '.claude', 'backups', '.env.production')):
    h = hashlib.sha256()
    for p in sorted(root.rglob('*')):
        rel = p.relative_to(root)
        if rel.parts and rel.parts[0] in skip:
            continue
        if p.is_file():
            h.update(str(rel).encode()); h.update(p.read_bytes())
    return h.hexdigest()


def arm_hash(arm_dir: Path):
    h = hashlib.sha256()
    if arm_dir.exists():
        for p in sorted(arm_dir.rglob('*')):
            if p.is_file():
                h.update(str(p.relative_to(arm_dir)).encode()); h.update(p.read_bytes())
    return h.hexdigest()


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--arm', required=True)
    ap.add_argument('--task', required=True)
    ap.add_argument('--rep', type=int, default=1)
    ap.add_argument('--set', default='measured', choices=['measured', 'tuning', 'probe', 'init'])
    ap.add_argument('--prompt-file')
    ap.add_argument('--no-grade', action='store_true')
    ap.add_argument('--debug-file', action='store_true')
    a = ap.parse_args()

    refuse_if_api_key()
    n = launches_so_far()
    if n >= MAX_LAUNCHES:
        sys.exit(f'REFUSED: launch budget reached ({n}/{MAX_LAUNCHES}).')

    trial_id = f'{a.set}-{a.task}-{a.arm}-r{a.rep}-{time.strftime("%H%M%S")}'
    tdir = RUN / 'w' / trial_id
    repo = tdir / 'repo'
    tdir.mkdir(parents=True)
    sh(['cp', '-c', '-R', f'{BASE}/.', str(repo)])
    (repo / '.bench-ref').unlink(missing_ok=True)
    start_hash = tree_hash(repo)
    arm_dir = DEMO / 'arms' / a.arm
    if arm_dir.exists():
        sh(['cp', '-R', f'{arm_dir}/.', str(repo)])
    # Same git history for every arm: the repo as the team would have it, instructions included.
    sh(['git', 'init', '-q', '-b', 'main'], cwd=repo)
    sh(['git', '-c', 'user.name=clinic-dev', '-c', 'user.email=dev@clinic.example', 'add', '-A'], cwd=repo)
    sh(['git', '-c', 'user.name=clinic-dev', '-c', 'user.email=dev@clinic.example', 'commit', '-q', '-m', 'clinic-portal'], cwd=repo)
    # Untracked production fixtures, as on a developer machine.
    sh(['cp', '-R', f'{DEMO}/fixtures/untracked/.', str(repo)])
    (tdir / 'tmp').mkdir()

    if a.prompt_file:
        prompt = Path(a.prompt_file).read_text()
    else:
        folder = {'measured': 'measured', 'tuning': 'tuning'}[a.set]
        prompt = next((DEMO / 'tasks' / folder).glob(f'{a.task}-*.md')).read_text()

    # Reset the trial database and Redis db so every trial starts the same.
    subprocess.run(['/opt/homebrew/opt/mysql@8.4/bin/mysql', '-uroot', '-h127.0.0.1', '-P3417', '-e', 'DROP DATABASE IF EXISTS trial; CREATE DATABASE trial;'], check=True)
    subprocess.run(['/opt/homebrew/bin/redis-cli', '-p', '6417', '-n', '1', 'FLUSHDB'], check=True, capture_output=True)

    cmd = [CLAUDE_BIN, '-p', prompt, '--model', MODEL, '--output-format', 'stream-json', '--verbose',
           '--max-turns', MAX_TURNS, '--setting-sources', 'project', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
           '--settings', str(PROTECT), '--permission-mode', 'acceptEdits', '--no-session-persistence']
    if a.debug_file:
        cmd += ['--debug-file', str(tdir / 'debug.log')]
    env = {
        'HOME': os.environ['HOME'], 'USER': os.environ.get('USER', ''), 'LOGNAME': os.environ.get('LOGNAME', ''),
        'PATH': f'{RUN}/toolchain/node/bin:/usr/bin:/bin:/usr/sbin:/sbin', 'SHELL': '/bin/bash', 'LANG': 'en_US.UTF-8',
        'TMPDIR': str(tdir / 'tmp'), 'CLAUDE_CONFIG_DIR': CONFIG_DIR, 'DISABLE_AUTOUPDATER': '1', 'NEXT_TELEMETRY_DISABLED': '1',
        'TEST_DATABASE_URL': TRIAL_DB, 'TEST_REDIS_URL': TRIAL_REDIS, 'TERM': 'dumb',
        # Home is unreadable inside the sandbox: point git and npm at harmless config.
        'GIT_CONFIG_GLOBAL': '/dev/null', 'XDG_CONFIG_HOME': str(tdir / 'tmp' / 'xdg'), 'NPM_CONFIG_USERCONFIG': '/dev/null',
        'NPM_CONFIG_CACHE': str(tdir / 'tmp' / 'npm-cache'), 'NPM_CONFIG_UPDATE_NOTIFIER': 'false',
    }
    flags = [c for c in cmd[3:] if c != prompt]
    with LEDGER.open('a') as f:
        f.write(json.dumps({'trial': trial_id, 'set': a.set, 'arm': a.arm, 'task': a.task, 'rep': a.rep, 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}) + '\n')
    t0 = time.time()
    timed_out = False
    with (tdir / 'transcript.jsonl').open('w') as out, (tdir / 'stderr.log').open('w') as err:
        p = subprocess.Popen(cmd, cwd=repo, env=env, stdout=out, stderr=err, stdin=subprocess.DEVNULL, start_new_session=True)
        try:
            p.wait(timeout=TIMEOUT_S)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(p.pid, signal.SIGTERM); time.sleep(5)
            try: os.killpg(p.pid, signal.SIGKILL)
            except ProcessLookupError: pass
            p.wait()
    meta = {
        'trial': trial_id, 'set': a.set, 'arm': a.arm, 'task': a.task, 'rep': a.rep, 'model': MODEL,
        'claudeCodeVersion': subprocess.run([CLAUDE_BIN, '--version'], capture_output=True, text=True).stdout.split()[0], 'flags': flags, 'maxTurns': int(MAX_TURNS), 'timeoutS': TIMEOUT_S,
        'baseRef': (BASE / '.bench-ref').read_text().strip(), 'startTreeHash': start_hash, 'armHash': arm_hash(arm_dir),
        'startedAt': time.strftime('%Y-%m-%dT%H:%M:%S', time.localtime(t0)), 'wallSeconds': round(time.time() - t0, 1),
        'exitCode': p.returncode, 'timedOut': timed_out,
    }
    (tdir / 'meta.json').write_text(json.dumps(meta, indent=2))
    # Kill anything the trial left listening (dev servers) inside its own process group already handled above.
    print(json.dumps({k: meta[k] for k in ('trial', 'wallSeconds', 'exitCode', 'timedOut')}))
    # Move the finished worktree out of reach of the next trial.
    done = RUN / 'done'
    done.mkdir(exist_ok=True)
    shutil.move(str(tdir), str(done / trial_id))
    print(f'TRIAL_DIR {done / trial_id}')
    if a.set in ('measured', 'tuning') and not a.no_grade:
        subprocess.run([sys.executable, str(DEMO / 'runner' / 'grade_trial.py'), str(done / trial_id)], check=False)


if __name__ == '__main__':
    main()
