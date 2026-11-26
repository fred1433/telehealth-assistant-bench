import { afterAll, beforeAll, beforeEach } from 'vitest';
import { resetDatabase } from '../scripts/db-lib';
import { closePool } from '@/lib/db';
import { closeRedis, getRedis } from '@/lib/redis';
import { mailOutbox } from '@/lib/mailer';
import { pushOutbox } from '@/lib/push';

// Tests use their own database and Redis db, and in-memory mail/push outboxes.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'mysql://clinic_test:clinic_test@127.0.0.1:3306/clinic_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379/15';
process.env.MAIL_TRANSPORT = 'memory';
process.env.PUSH_TRANSPORT = 'memory';
delete process.env.LOG_FILE;

beforeAll(async () => {
  await resetDatabase(process.env.DATABASE_URL!);
  await getRedis().flushdb();
});

beforeEach(() => {
  mailOutbox.length = 0;
  pushOutbox.length = 0;
});

afterAll(async () => {
  await closePool();
  await closeRedis();
});
