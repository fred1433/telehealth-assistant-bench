// Stop guard: before the assistant finishes, run `npm run verify` in the project.
// On failure, exit 2 with "GUARD-VERIFY: ..." and the tail of the output so the assistant keeps working.
// Honours stop_hook_active: if the assistant is already continuing because of this hook, never block again.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  input = {};
}
if (input.stop_hook_active === true) process.exit(0);

const dir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

// Nothing changed in tracked or new (non-ignored) files: nothing to verify.
const st = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
if (st.status === 0 && st.stdout.trim() === '') process.exit(0);

const res = spawnSync('npm', ['run', 'verify'], {
  cwd: dir,
  encoding: 'utf8',
  env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
  timeout: 9 * 60 * 1000,
  maxBuffer: 64 * 1024 * 1024,
});
if (res.status === 0) process.exit(0);

const output = `${res.stdout || ''}\n${res.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '');
const tail = output.trimEnd().split('\n').slice(-40).join('\n');
const why = res.error ? `could not complete (${res.error.code || res.error.message})` : `failed (exit ${res.status})`;
process.stderr.write(`GUARD-VERIFY: \`npm run verify\` ${why}. Fix the typecheck or test failures below (do not weaken or delete tests), run \`npm run verify\` again, then finish.\n--- last 40 lines ---\n${tail}\n`);
process.exit(2);
