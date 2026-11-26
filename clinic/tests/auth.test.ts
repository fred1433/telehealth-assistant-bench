import { describe, expect, it } from 'vitest';
import { requireUser } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import { TOKENS } from './helpers';

function req(token?: string): Request {
  return new Request('http://localhost/', { headers: token ? { authorization: `Bearer ${token}` } : {} });
}

describe('requireUser', () => {
  it('rejects a missing token', async () => {
    await expect(requireUser(req())).rejects.toBeInstanceOf(HttpError);
  });

  it('rejects an unknown token', async () => {
    await expect(requireUser(req('nope'))).rejects.toMatchObject({ status: 401 });
  });

  it('resolves a patient with their patient id', async () => {
    const user = await requireUser(req(TOKENS.ava));
    expect(user).toMatchObject({ id: 'usr_ava', role: 'patient', patientId: 'pt_ava', orgId: 'org_juniper' });
  });

  it('resolves a practitioner with their practitioner id', async () => {
    const user = await requireUser(req(TOKENS.rosa));
    expect(user).toMatchObject({ role: 'practitioner', practitionerId: 'pr_rosa' });
  });
});
