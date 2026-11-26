// PreToolUse guard on Edit/Write/MultiEdit of app code (src/).
// Blocks new code that puts a patient identifier or clinical field into:
//   - a logger/console call (including whole request bodies, rows, users and driver error objects),
//   - a URL, query string or dynamic route segment (Apache logs every request line),
//   - an email or push notification payload,
//   - a Redis cache key.
// Exit 2 + stderr "GUARD: ..." blocks the edit and says what to do instead. Tests are not checked.
import { readFileSync } from 'node:fs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const tool = input.tool_name || '';
const ti = input.tool_input || {};
const file = String(ti.file_path || '');

// Shell writes into src/ would bypass the checks below: send them to Edit/Write instead.
if (tool === 'Bash') {
  const cmd = String(ti.command || '');
  const SRC = String.raw`['"]?(?:[^\s'"<>|;&]*\/)?src\/[^\s'"<>|;&]*\.[cm]?[jt]sx?`;
  const writesSrc = [
    new RegExp(String.raw`(?:^|[^0-9&>])>{1,2}\s*` + SRC),
    new RegExp(String.raw`\btee\b(?:\s+-a)?\s+` + SRC),
    new RegExp(String.raw`\b(?:sed|gsed)\s+(?:-[a-zA-Z]*\s+)*-i\S*\s[\s\S]*` + SRC),
    new RegExp(String.raw`\bperl\s+-[a-zA-Z]*i[\s\S]*` + SRC),
    new RegExp(String.raw`\bopen\(\s*` + SRC + String.raw`['"]?\s*,\s*['"][wa+]`),
    new RegExp(String.raw`\b(?:writeFileSync|appendFileSync|writeFile|appendFile)\(\s*` + SRC),
    new RegExp(String.raw`\b(?:python3?|node|perl|ruby|deno|bun)\b[\s\S]*` + SRC + String.raw`[\s\S]*(?:\.write\(|write_text|writeFileSync|appendFileSync|\bopen\([^)]*['"][wa]\+?['"])`),
    new RegExp(String.raw`\bPath\(\s*` + SRC + String.raw`['"]?\s*\)\s*\.write`),
  ];
  if (writesSrc.some((r) => r.test(cmd))) {
    process.stderr.write('GUARD: change application code under src/ with the Edit or Write tool, not with a shell redirect, heredoc, tee, sed -i or a script: edits through those tools are checked for patient data in logs, URLs, notifications and cache keys. Redo this change with Edit/Write.\n');
    process.exit(2);
  }
  process.exit(0);
}
if (!['Edit', 'Write', 'MultiEdit'].includes(tool)) process.exit(0);
if (!/(?:^|\/)src\/.*\.(?:[cm]?[jt]sx?)$/.test(file)) process.exit(0);
if (/(?:^|\/)tests?\/|\.test\.|\.spec\./.test(file)) process.exit(0);

let code = '';
if (tool === 'Write') code = String(ti.content || '');
else if (tool === 'Edit') code = String(ti.new_string || '');
else code = (ti.edits || []).map((e) => String(e.new_string || '')).join('\n');

const findings = [];
const rel = file.replace(/^.*?(?=src\/)/, '');
const isTransport = /(?:^|\/)src\/lib\/(?:mailer|push)\.[cm]?[jt]sx?$/.test(file);
function found(kind, snippet, instead) {
  findings.push({ kind, snippet: snippet.replace(/\s+/g, ' ').trim().slice(0, 160), instead });
}

// ---------- lexer: blank out strings/comments, keep `${...}` expressions, same length ----------
function sanitize(src) {
  const out = src.split('');
  const templates = []; // {start, end, exprs: [{start, end}]}
  let i = 0;
  const n = src.length;
  function blank(a, b) { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; }
  function skipString(q) { // i at opening quote
    let j = i + 1;
    while (j < n && src[j] !== q) { if (src[j] === '\\') j++; if (src[j] === '\n' && q !== '`') break; j++; }
    blank(i + 1, j);
    i = j + 1;
  }
  function skipTemplate() { // i at backtick
    const t = { start: i, end: n, exprs: [] };
    let j = i + 1;
    let segStart = j;
    while (j < n) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '`') { blank(segStart, j); t.end = j + 1; j++; break; }
      if (src[j] === '$' && src[j + 1] === '{') {
        blank(segStart, j);
        const exprStart = j + 2;
        j = exprStart;
        let depth = 1;
        while (j < n && depth > 0) {
          const c = src[j];
          if (c === "'" || c === '"') { i = j; skipString(c); j = i; continue; }
          if (c === '`') { i = j; skipTemplate(); j = i; continue; }
          if (c === '{') depth++;
          else if (c === '}') depth--;
          j++;
        }
        t.exprs.push({ start: exprStart, end: j - 1 });
        segStart = j;
        continue;
      }
      j++;
    }
    templates.push(t);
    i = j;
  }
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? n : e; blank(i, end); i = end; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; blank(i, end); i = end; continue; }
    if (c === "'" || c === '"') { skipString(c); continue; }
    if (c === '`') { skipTemplate(); continue; }
    i++;
  }
  return { clean: out.join(''), templates };
}

function argsAt(clean, openIdx) { // openIdx = index of '('
  let depth = 0;
  for (let j = openIdx; j < clean.length; j++) {
    const c = clean[j];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) return { start: openIdx + 1, end: j }; }
  }
  return { start: openIdx + 1, end: clean.length };
}

const { clean, templates } = sanitize(code);

// Identifiers that carry patient identifiers or clinical content.
const PHI_IDENT = /\b(?:first_?name|last_?name|full_?name|display_?name|displayName|patient_?name|patientName|sender_?name|recipient_?name|e_?mail|email(?:Address)?|recipient_?email|patient_?email|phone(?:_?number)?|phoneNumber|date_?of_?birth|dateOfBirth|dob|birth_?date|birthDate|mrn|reason_?for_?care|reasonForCare|visit_?reason|visitReason|diagnosis|ssn|psychotherapy\w*|subject|body|notes?|content|sqlMessage|sql)\b/i;
// Same, for query-string keys and dynamic route segments.
const PHI_KEY = /^(?:name|first_?name|firstName|last_?name|lastName|full_?name|fullName|patient_?name|patientName|e_?mail|email|phone|phone_?number|dob|date_?of_?birth|dateOfBirth|birth_?date|birthdate|mrn|reason|visit_?reason|visitReason|diagnosis|ssn)$/i;
// Whole objects that serialize PHI (rows, inputs, users, driver errors).
const WHOLE = /(?<![\w$.]|typeof\s)(?:input|body|payload|data|req|request|row|rows|record|patient|patients|user|users|recipient|sender|practitioner|appointment|appointments|appt|apt|message|messages|note|notes|err|error|e|ex|exc|exception|cause)(?![\w$])(?!\s*(?:\?\.|\.|\[|\(|:(?!:)|=(?!=)|instanceof\b|as\b))/;

function normalizeCasts(s) {
  return s.replace(/\(\s*([\w$]+)\s+as\s+[^()]*\)/g, '$1').replace(/([\w$]+)\s+as\s+[\w$.<>\[\]| ]+/g, '$1').replace(/!(?=\.)/g, '');
}

// ---------- 1. logger / console calls ----------
const LOGCALL = /\b(?:logger|log|console)\s*\.\s*(?:debug|info|warn|error|log|trace|fatal)\s*\(/g;
for (const m of clean.matchAll(LOGCALL)) {
  const open = m.index + m[0].length - 1;
  const { start, end } = argsAt(clean, open);
  const raw = code.slice(m.index, Math.min(end + 1, code.length));
  const args = normalizeCasts(clean.slice(start, end));
  const instead = 'Log only internal record ids (pt_..., apt_..., msg_..., usr_...) and error codes (err.code / err.name), never names, emails, phones, DOB, MRN, reasons, subjects, bodies or notes.';
  let mm;
  if ((mm = PHI_IDENT.exec(args))) { found('logger call logs a patient identifier or clinical field', raw, instead); continue; }
  if (/\.\.\./.test(args)) { found('logger call spreads an object into the log line', raw, 'List the id fields explicitly. ' + instead); continue; }
  if (/\b(?:url|nextUrl|searchParams|headers|authorization|cookies?)\b/.test(args)) { found('logger call logs a request URL, query string or headers', raw, 'Apache already logs the request line; log the route name and record ids only. ' + instead); continue; }
  if ((mm = WHOLE.exec(args))) {
    const isErr = /^(?:err|error|e|ex|exc|exception|cause)$/.test(mm[0]);
    found(isErr ? 'logger call logs a whole error object' : `logger call logs a whole object (\`${mm[0]}\`)`, raw,
      isErr ? 'The logger keeps every enumerable property: a mysql2 error carries `sql` with the bound values and `sqlMessage` with duplicate values. Log `{ code: err.code }` (or err.name) instead.' : instead);
    continue;
  }
  if (/\.message\b|String\s*\(/.test(args) && /\b(?:err|error|e|ex|exception|cause)\b/.test(args)) {
    found('logger call logs an error message', raw, 'Driver error messages embed row values (e.g. "Duplicate entry \'ava@...\'"). Log err.code instead.');
  }
}

// ---------- 2. URLs, query strings, route segments ----------
const urlInstead = 'Apache logs every request line, so identifiers in a path or query string end up in access logs. Address records by internal id (pt_..., apt_...) in the path, or take search terms in a POST body.';
for (const m of clean.matchAll(/searchParams\s*\.\s*(?:get|getAll|has|set|append)\s*\(\s*/g)) {
  const after = code.slice(m.index + m[0].length);
  const km = /^(['"`])([^'"`]*)\1/.exec(after);
  if (km && PHI_KEY.test(km[2])) found(`query-string parameter "${km[2]}" carries a patient identifier`, code.slice(m.index, m.index + m[0].length + km[0].length + 1), urlInstead);
}
for (const m of clean.matchAll(/new\s+URLSearchParams\s*\(/g)) {
  const { start, end } = argsAt(clean, m.index + m[0].length - 1);
  const args = clean.slice(start, end);
  if (PHI_IDENT.test(args) && !/^\s*\w*[Ss]earch\w*\s*$/.test(args)) found('URLSearchParams built from a patient identifier', code.slice(m.index, end + 1), urlInstead);
}
for (const t of templates) {
  const rawT = code.slice(t.start, t.end);
  const statics = rawT.replace(/\$\{[\s\S]*?\}/g, '');
  const looksUrl = /^`\s*(?:https?:\/\/|\/)|[?&][\w-]+=|appBaseUrl|baseUrl|\/api\//.test(rawT) || /(?:url|href|link|path|redirect|location)\s*[:=(]\s*$/i.test(clean.slice(Math.max(0, t.start - 25), t.start));
  if (!looksUrl) continue;
  const qk = [...statics.matchAll(/[?&]([\w-]+)=/g)].map((x) => x[1]).find((k) => PHI_KEY.test(k));
  if (qk) { found(`URL query parameter "${qk}" carries a patient identifier`, rawT, urlInstead); continue; }
  for (const e of t.exprs) {
    const expr = normalizeCasts(clean.slice(e.start, e.end));
    if (PHI_IDENT.test(expr)) {
      found('URL built from a patient identifier or clinical field', rawT, urlInstead);
      break;
    }
  }
}
for (const m of code.matchAll(/['"][^'"\n]*[?&]([\w-]+)=['"]\s*\+/g)) {
  if (PHI_KEY.test(m[1])) found(`URL query parameter "${m[1]}" carries a patient identifier`, m[0], urlInstead);
}
const seg = /\[(?:\.\.\.)?([\w-]+)\]/g;
for (const m of file.matchAll(seg)) {
  if (PHI_KEY.test(m[1])) found(`dynamic route segment [${m[1]}] puts a patient identifier in the URL`, file, urlInstead);
}

// ---------- 3. email / push payloads ----------
// Generic words (subject, body, notes...) count only as a property of a record (input.subject,
// apt.notes); a bare local such as `{ to, subject, text }` is just the mail field shorthand.
const GENERIC = /^(?:subject|body|content|notes?|sql|sqlMessage)$/i;
function payloadPhi(args) {
  for (const x of args.matchAll(new RegExp(PHI_IDENT.source, 'gi'))) {
    if (!GENERIC.test(x[0])) return x;
    if (/\.\s*$/.test(args.slice(0, x.index))) return x;
  }
  return null;
}
for (const m of isTransport ? [] : clean.matchAll(/(?<![\w$.])(?:sendMail|sendPush|sendEmail|sendNotification)\s*\(/g)) {
  const { start, end } = argsAt(clean, m.index + m[0].length - 1);
  let args = normalizeCasts(clean.slice(start, end));
  args = args.replace(/\bto\s*:\s*[^,}\n]+/g, ' ').replace(/\btoken\s*:\s*[^,}\n]+/g, ' ');
  args = args.replace(/\b(?:subject|text|html|body|title|notification|data)\s*:(?!:)/g, ' ');
  const mm = payloadPhi(args);
  if (mm || /\.\.\./.test(args)) {
    found('email/push payload includes a patient identifier or clinical field' + (mm ? ` (\`${mm[0]}\`)` : ' (object spread)'), code.slice(m.index, end + 1),
      'Email and push leave our servers and show on lock screens. Use fixed generic text ("An appointment was cancelled. Details are in the portal.") and at most a portal link or data field with internal ids.');
  }
}

// ---------- 4. cache keys ----------
for (const m of clean.matchAll(/\b(?:redis|getRedis\(\)|cache|client)\s*\.\s*(?:get|set|setex|psetex|del|exists|expire|hget|hset|hgetall|incr|sadd|smembers|lpush|rpush|zadd)\s*\(/gi)) {
  const { start, end } = argsAt(clean, m.index + m[0].length - 1);
  const firstArgEnd = (() => { let d = 0; for (let j = start; j < end; j++) { const c = clean[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ',' && d === 0) return j; } return end; })();
  const keyArg = normalizeCasts(clean.slice(start, firstArgEnd));
  if (PHI_IDENT.test(keyArg) && !/^(?:subject|body|content|notes?)$/i.test(PHI_IDENT.exec(keyArg)[0])) {
    found('cache key built from a patient identifier', code.slice(m.index, end + 1), 'Build keys from KEY_PREFIX + internal ids or a hash; names, emails and MRNs in keys show up in KEYS listings, monitoring and dumps.');
  }
}

if (findings.length) {
  const lines = findings.slice(0, 4).map((f) => `- ${f.kind}: ${f.snippet}\n  Instead: ${f.instead}`);
  process.stderr.write(`GUARD: blocked ${tool} of ${rel}: the new code would expose patient data.\n${lines.join('\n')}\nRewrite the code accordingly and retry. (If this is a false positive, express the same logic with clearly id-only names, e.g. patientId, appointmentId.)\n`);
  process.exit(2);
}
process.exit(0);
