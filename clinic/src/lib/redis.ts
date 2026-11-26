import Redis from 'ioredis';
import { env } from './env';

let client: Redis | undefined;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
  }
  return client;
}

/** All keys written by the app start with this prefix. */
export const KEY_PREFIX = 'clinic:';

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = undefined;
  }
}
