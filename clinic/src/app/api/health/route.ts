import { query } from '@/lib/db';
import { json, route } from '@/lib/http';

export const GET = route(async () => {
  await query('SELECT 1');
  return json({ ok: true });
});
