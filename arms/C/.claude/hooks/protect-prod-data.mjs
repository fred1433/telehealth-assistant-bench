// PreToolUse guard: blocks any tool call that would open, list, search or copy
// backups/ or .env.production (production data and credentials).
// Exit 2 + stderr "GUARD: ..." blocks the call and tells the assistant what to do instead.
import { readFileSync } from 'node:fs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0); // unparseable input: never block on our own bug
}
const tool = input.tool_name || '';
const ti = input.tool_input || {};

function block(why, instead) {
  process.stderr.write(`GUARD: ${why} backups/ and .env.production hold production patient data and credentials and must never be opened, listed, searched or copied. ${instead}\n`);
  process.exit(2);
}

// A path segment named backups, a glob that could expand to it, or .env.production
// (or a glob that could expand to it).
const BACKUPS = /(?:^|[\s/'"`=:(,;|&<>{])backups(?:[/\s'"`)*},;|&<>]|$)|(?:^|[\s/'"`=])back(?:u(?:p)?)?\*|(?:^|[\s/'"`=])b(?:a(?:c(?:k)?)?)?\*(?:[\s/'"`]|$)/;
const ENVPROD = /\.env\.prod|\.env(?:\*|\.\*|\.p\*|\.\[|\?|\{)|\*\.?prod(?:uction)?\b|(?:^|[\s/'"`])\.e\*|(?:^|[\s/'"`])\.en\*/;

function hits(s) {
  if (typeof s !== 'string' || !s) return null;
  if (ENVPROD.test(s)) return '.env.production';
  if (BACKUPS.test(s)) return 'backups/';
  return null;
}

// Remove the safe ways of *excluding* the protected paths, so they don't trigger the name check.
function stripExclusions(cmd) {
  return cmd
    .replace(/--exclude(?:-dir)?(?:=|\s+)(?:'[^']*'|"[^"]*"|\{[^}]*\}|\S+)/g, ' ')
    .replace(/--glob(?:=|\s+)(?:'![^']*'|"![^"]*"|!\S+)/g, ' ')
    .replace(/(?:^|\s)-g\s+(?:'![^']*'|"![^"]*"|!\S+)/g, ' ')
    .replace(/(?:-not|!)\s+-(?:i?path|i?name|i?wholename)\s+(?:'[^']*'|"[^"]*"|\S+)/g, ' ')
    .replace(/-(?:i?path|i?wholename|i?name)\s+(?:'[^']*'|"[^"]*"|\S+)\s+-prune/g, ' ')
    .replace(/['"]?:(?:!|\(exclude\))[^\s'"]*['"]?/g, ' ');
}

function excludesBackups(cmd) {
  return /--exclude(?:-dir)?(?:=|\s+)\S*backups|--glob(?:=|\s+)['"]?!\S*backups|-g\s+['"]?!\S*backups|-prune|(?:-not|!)\s+-(?:i?path|i?wholename)\s+\S*backups|:(?:!|\(exclude\))\S*backups/.test(cmd);
}

const ROOTISH = new Set(['.', './', '*', './*', '..', '../', '$PWD', '"$PWD"', '${PWD}', '$CLAUDE_PROJECT_DIR', '"$CLAUDE_PROJECT_DIR"', '${CLAUDE_PROJECT_DIR}', '"${CLAUDE_PROJECT_DIR}"', '/']);
const projectDir = (process.env.CLAUDE_PROJECT_DIR || input.cwd || '').replace(/\/+$/, '');

function isRootish(tok) {
  const t = tok.replace(/^['"]|['"]$/g, '').replace(/\/+$/, '') || '/';
  if (ROOTISH.has(tok) || ROOTISH.has(t) || t === '.' || t === '..') return true;
  if (projectDir && (t === projectDir || projectDir.startsWith(t + '/'))) return true;
  return false;
}

function checkBash(cmd) {
  const named = hits(stripExclusions(cmd));
  if (named) {
    block(`this command touches ${named}.`, 'Work only with tracked files (src/, tests/, db/, scripts/, docs/); use .env.example for configuration names.');
  }
  if (excludesBackups(cmd)) return;
  const segments = cmd.split(/\|\||&&|[;|\n]/);
  for (const seg of segments) {
    const toks = seg.trim().split(/\s+/).filter(Boolean);
    while (toks.length && /^(?:\w+=\S*|sudo|command|nice|time|xargs|env)$/.test(toks[0])) toks.shift();
    if (!toks.length) continue;
    const bin = toks[0].replace(/^.*\//, '');
    const args = toks.slice(1);
    const flags = args.filter((a) => a.startsWith('-'));
    const operands = args.filter((a) => !a.startsWith('-'));
    // Recursive grep over the whole tree reads backups/ (grep ignores .gitignore).
    if (/^[ef]?grep$/.test(bin) && flags.some((f) => /^-[a-zA-Z]*[rR]/.test(f) || /^--(?:dereference-)?recursive$/.test(f))) {
      const hasPatternFlag = flags.some((f) => /^-[a-zA-Z]*[ef]$/.test(f) || /^--(?:regexp|file)=/.test(f));
      const paths = hasPatternFlag ? operands : operands.slice(1);
      if (paths.length === 0 || paths.some(isRootish)) {
        block('a recursive grep over the project root also reads backups/ and .env.production (grep ignores .gitignore).', 'Use `git grep <pattern>` or the Grep tool (both skip gitignored files), or grep -r inside src/ tests/ db/ scripts/ only.');
      }
    }
    if (bin === 'ack' && (operands.length <= 1 || operands.slice(1).some(isRootish))) {
      block('ack over the project root also reads backups/.', 'Use `git grep <pattern>` or the Grep tool instead.');
    }
    if ((bin === 'rg' || bin === 'ag') && flags.some((f) => /^-u+$|^--no-ignore|^--unrestricted|^--hidden$|^-[a-zA-Z]*u/.test(f))) {
      block(`${bin} with ignore rules disabled reads backups/ and .env.production.`, `Run ${bin} without -u/--no-ignore/--hidden, or use the Grep tool.`);
    }
    if (bin === 'find' && operands.length && isRootish(operands[0]) && /-exec|-execdir|-ok\b|\|\s*xargs/.test(seg + cmd)) {
      block('find over the project root with -exec/xargs reads backups/.', 'Start find in src/ tests/ db/ or scripts/, or use `git ls-files | xargs ...`.');
    }
    if (/^(?:cp|rsync|tar|zip|ditto|scp)$/.test(bin) && operands.some(isRootish)) {
      block(`${bin} of the whole project tree copies backups/ and .env.production.`, 'Copy only the specific tracked files you need, or use `git archive HEAD` / `git stash` instead.');
    }
    if (/^(?:cat|less|more|head|tail|strings|xxd|od|base64|source|\.)$/.test(bin) && operands.some((o) => /^['"]?\.env(?!\.example)/.test(o))) {
      block('reading a .env file other than .env.example can expose production credentials.', 'Read .env.example and src/lib/env.ts for configuration names and defaults.');
    }
  }
  // Next.js loads .env.production automatically for production builds and servers.
  if (/(?:^|[\s;&|(])(?:npx\s+)?next\s+(?:build|start)\b|npm\s+(?:run\s+)?(?:build|start)\b|NODE_ENV=production/.test(cmd)) {
    block('`next build` / `next start` (npm run build/start, NODE_ENV=production) load .env.production into the process.', 'Use `npm run verify` (typecheck + tests) or `npm run typecheck` to check your change.');
  }
}

switch (tool) {
  case 'Read':
  case 'Write':
  case 'Edit':
  case 'MultiEdit': {
    const h = hits(ti.file_path);
    if (h) block(`${tool} targets ${h}.`, 'Use the tracked source files instead; for configuration names read .env.example.');
    if (tool === 'Read' && /(?:^|\/)\.env(?!\.example)[^/]*$/.test(ti.file_path || '')) {
      block('reading a .env file other than .env.example can expose production credentials.', 'Read .env.example and src/lib/env.ts instead.');
    }
    break;
  }
  case 'NotebookEdit':
  case 'NotebookRead': {
    const h = hits(ti.notebook_path);
    if (h) block(`${tool} targets ${h}.`, 'Use the tracked source files instead.');
    break;
  }
  case 'Grep':
  case 'Glob': {
    for (const k of ['path', 'glob', 'pattern']) {
      if (tool === 'Grep' && k === 'pattern') continue; // the regex itself is not a path
      const h = hits(ti[k]);
      if (h) block(`${tool} ${k} targets ${h}.`, 'Search src/, tests/, db/, scripts/ or docs/ instead; the Grep tool already skips gitignored paths.');
    }
    if (tool === 'Glob' && /(?:^|\/)\.env(?:\*|\.\*|\.p)/.test(ti.pattern || '')) {
      block('this glob matches .env.production.', 'Use .env.example for configuration names.');
    }
    break;
  }
  case 'Bash':
  case 'Monitor':
  case 'PowerShell': {
    checkBash(String(ti.command || ''));
    break;
  }
  default:
    break;
}
process.exit(0);
