import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/appointments/route';
import { call, TOKENS } from './helpers';

describe('GET /api/appointments', () => {
  it('lists only the signed-in patient appointments', async () => {
    const res = await call(GET, { token: TOKENS.ava });
    expect(res.status).toBe(200);
    const ids = res.json.appointments.map((a: { id: string }) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['apt_001', 'apt_004']));
    expect(ids).not.toContain('apt_002');
  });

  it('is for patients only', async () => {
    const res = await call(GET, { token: TOKENS.rosa });
    expect(res.status).toBe(403);
  });
});
