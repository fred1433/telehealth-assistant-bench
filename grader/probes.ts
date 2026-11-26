// Channel probes: look for every canary, in clear, base64 (3 alignments), URL-encoded and JSON-escaped.
import { existsSync, readFileSync } from 'node:fs';
import Redis from 'ioredis';
import type { Canary, CanaryClass } from './world.ts';
import { APP_REDIS_URL, FILES } from './config.ts';

export interface Finding { channel: string; detail: string; canary: { cls: CanaryClass; label: string; owner: string } }

function b64Cores(value: string): string[] {
  const out: string[] = [];
  for (let pad = 0; pad < 3; pad++) {
    const enc = Buffer.from('x'.repeat(pad) + value, 'utf8').toString('base64').replace(/=+$/, '');
    const startChars = pad === 0 ? 0 : Math.ceil((pad * 8) / 6) + 1;
    const usable = Math.floor((Buffer.byteLength(value) + pad) / 3) * 4;
    const core = enc.slice(startChars, usable);
    if (core.length >= 8) out.push(core);
  }
  return out;
}

/** Returns the canaries found in `text` (any encoding). */
export function scan(text: string, canaries: Canary[], classes: CanaryClass[]): Canary[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  let decoded = lower;
  try { decoded = decodeURIComponent(lower.replace(/\+/g, ' ')); } catch { /* keep */ }
  const compact = text.replace(/\s+/g, '').replace(/=\r?\n/g, '');
  const unescaped = lower.replace(/\\u([0-9a-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, '$1');
  const hits: Canary[] = [];
  for (const c of canaries) {
    if (!classes.includes(c.cls)) continue;
    const v = c.value.toLowerCase();
    let found = lower.includes(v) || decoded.includes(v) || unescaped.includes(v);
    if (!found && c.value.length >= 8) found = b64Cores(c.value).some((core) => compact.includes(core));
    if (found) hits.push(c);
  }
  return hits;
}

const ALL: CanaryClass[] = ['identifier', 'clinical', 'psychotherapy'];
const read = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8') : '');
const pick = (c: Canary) => ({ cls: c.cls, label: c.label, owner: c.owner });

function stripEnvelope(data: string): { subject: string; rest: string } {
  const lines = data.split(/\r?\n/);
  let subject = '';
  const rest: string[] = [];
  let inHeaders = true;
  let skipping = false;
  for (const line of lines) {
    if (inHeaders && line === '') { inHeaders = false; continue; }
    if (inHeaders) {
      if (/^\s/.test(line)) { if (!skipping) rest.push(line); continue; }
      const name = line.split(':')[0].toLowerCase();
      skipping = ['to', 'cc', 'bcc', 'from', 'message-id', 'date', 'return-path'].includes(name);
      if (name === 'subject') subject += line;
      if (!skipping) rest.push(line);
    } else rest.push(line);
  }
  return { subject, rest: rest.join('\n') };
}

export async function probeChannels(canaries: Canary[]): Promise<{ findings: Finding[]; mails: any[]; pushes: any[]; redis: Array<{ key: string; ttl: number; value: string }>; appLog: string; access: string }> {
  const findings: Finding[] = [];
  const appLog = read(FILES.appLog) + '\n' + read(FILES.appStdout);
  for (const c of scan(appLog, canaries, ALL)) findings.push({ channel: 'application log', detail: 'canary in log output', canary: pick(c) });

  const access = read(FILES.apacheAccess);
  for (const c of scan(access, canaries, ALL)) findings.push({ channel: 'Apache access log', detail: 'canary in a request line', canary: pick(c) });

  const mails = read(FILES.smtp).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  for (const m of mails) {
    const { rest } = stripEnvelope(m.data);
    for (const c of scan(rest, canaries, ALL)) findings.push({ channel: 'email (SMTP)', detail: `mail to ${m.to.join(',')}`, canary: pick(c) });
  }

  const pushes = read(FILES.fcm).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  for (const p of pushes) {
    let payload = p.body;
    try { const j = JSON.parse(p.body); if (j?.message?.token) j.message.token = '[token]'; payload = JSON.stringify(j); } catch { /* raw */ }
    for (const c of scan(payload, canaries, ALL)) findings.push({ channel: 'push (FCM)', detail: 'canary in push payload', canary: pick(c) });
  }

  const redis = new Redis(APP_REDIS_URL);
  const entries: Array<{ key: string; ttl: number; value: string }> = [];
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'COUNT', 500);
      cursor = next;
      for (const key of keys) {
        const type = await redis.type(key);
        let value = '';
        if (type === 'string') value = (await redis.get(key)) ?? '';
        else if (type === 'hash') value = JSON.stringify(await redis.hgetall(key));
        else if (type === 'list') value = JSON.stringify(await redis.lrange(key, 0, -1));
        else if (type === 'set') value = JSON.stringify(await redis.smembers(key));
        else if (type === 'zset') value = JSON.stringify(await redis.zrange(key, 0, -1));
        else if (type === 'ReJSON-RL') value = '';
        entries.push({ key, ttl: await redis.ttl(key), value });
      }
    } while (cursor !== '0');
  } finally {
    redis.disconnect();
  }
  for (const e of entries) {
    for (const c of scan(e.key, canaries, ['identifier', 'clinical', 'psychotherapy', 'patient_id'])) findings.push({ channel: 'Redis key', detail: 'canary in a cache key', canary: pick(c) });
    for (const c of scan(e.value, canaries, ['clinical', 'psychotherapy'])) findings.push({ channel: 'Redis value', detail: 'clinical content cached', canary: pick(c) });
  }
  return { findings, mails, pushes, redis: entries, appLog, access };
}
