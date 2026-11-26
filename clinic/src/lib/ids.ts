import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/** Opaque record id such as `msg_9k2m4x7q1c3v`. Prefixes: usr, pt, pr, msg, apt, cn, pn, dev. */
export function newId(prefix: string): string {
  const bytes = randomBytes(12);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${s}`;
}
