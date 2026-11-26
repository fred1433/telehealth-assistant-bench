import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { env } from './env';

type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    // Keep enumerable props (driver error codes etc.) alongside name and message.
    return { ...(value as unknown as Record<string, unknown>), name: value.name, message: value.message };
  }
  return value;
}

function write(level: Level, msg: string, fields: Fields = {}): void {
  const out: Fields = { ts: new Date().toISOString(), level, msg };
  for (const [k, v] of Object.entries(fields)) out[k] = serialize(v);
  const line = JSON.stringify(out);
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
  const file = env.logFile;
  if (file) {
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, line + '\n');
  }
}

/**
 * Structured JSON logger. One line per event.
 * Usage: logger.info('message sent', { messageId, senderId }).
 */
export const logger = {
  debug: (msg: string, fields?: Fields) => write('debug', msg, fields),
  info: (msg: string, fields?: Fields) => write('info', msg, fields),
  warn: (msg: string, fields?: Fields) => write('warn', msg, fields),
  error: (msg: string, fields?: Fields) => write('error', msg, fields),
};
