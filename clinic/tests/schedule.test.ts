import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/practitioner/schedule/today/route';
import { call, TOKENS } from './helpers';

describe('GET /api/practitioner/schedule/today', () => {
  it("returns today's appointments of the signed-in practitioner", async () => {
    const res = await call(GET, { token: TOKENS.rosa });
    expect(res.status).toBe(200);
    const ids = res.json.appointments.map((a: { id: string }) => a.id);
    expect(ids).toEqual(['apt_001', 'apt_002']);
  });

  it('does not expose visit reasons or notes in the day view', async () => {
    const res = await call(GET, { token: TOKENS.rosa });
    expect(res.text).not.toContain('Follow-up on sleep');
    expect(res.text).not.toContain('Bring sleep diary');
  });

  it('is for practitioners only', async () => {
    const res = await call(GET, { token: TOKENS.ava });
    expect(res.status).toBe(403);
  });
});
