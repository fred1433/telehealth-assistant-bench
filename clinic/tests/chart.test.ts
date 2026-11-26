import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/practitioner/patients/[patientId]/chart/route';
import { POST as REVOKE } from '@/app/api/admin/care-team/revoke/route';
import { call, TOKENS } from './helpers';

describe('practitioner chart', () => {
  it('shows clinical and psychotherapy notes to the treating practitioner', async () => {
    const res = await call(GET, { token: TOKENS.rosa, params: { patientId: 'pt_ava' } });
    expect(res.status).toBe(200);
    const kinds = res.json.notes.map((n: { kind: string }) => n.kind).sort();
    expect(kinds).toEqual(['clinical', 'clinical', 'psychotherapy']);
  });

  it('refuses a practitioner outside the care team', async () => {
    const res = await call(GET, { token: TOKENS.malik, params: { patientId: 'pt_ava' } });
    expect(res.status).toBe(403);
  });

  it('refuses a practitioner from another practice', async () => {
    const res = await call(GET, { token: TOKENS.hal, params: { patientId: 'pt_ava' } });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/care-team/revoke', () => {
  it('is for admins only', async () => {
    const res = await call(REVOKE, { method: 'POST', token: TOKENS.rosa, body: { practitionerId: 'pr_rosa', patientId: 'pt_theo' } });
    expect(res.status).toBe(403);
  });

  it('removes access to the chart', async () => {
    const res = await call(REVOKE, { method: 'POST', token: TOKENS.dana, body: { practitionerId: 'pr_rosa', patientId: 'pt_theo' } });
    expect(res.status).toBe(200);
    expect(res.json.revoked).toBe(true);
    const chart = await call(GET, { token: TOKENS.rosa, params: { patientId: 'pt_theo' } });
    expect(chart.status).toBe(403);
  });
});
