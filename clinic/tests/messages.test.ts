import { describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/messages/route';
import { call, TOKENS } from './helpers';

describe('POST /api/messages', () => {
  it('lets a practitioner message a patient of the same practice', async () => {
    const res = await call(POST, {
      method: 'POST',
      token: TOKENS.rosa,
      body: { recipientUserId: 'usr_ava', patientId: 'pt_ava', subject: 'Homework', body: 'Try the breathing exercise twice a day.' },
    });
    expect(res.status).toBe(201);
    expect(res.json.id).toMatch(/^msg_/);
  });

  it('refuses a recipient from another practice', async () => {
    const res = await call(POST, {
      method: 'POST',
      token: TOKENS.rosa,
      body: { recipientUserId: 'usr_june', subject: 'Hi', body: 'Hello' },
    });
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await call(POST, { method: 'POST', body: { recipientUserId: 'usr_ava', subject: 'x', body: 'y' } });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/messages', () => {
  it('lists the inbox without message bodies', async () => {
    const res = await call(GET, { token: TOKENS.ava });
    expect(res.status).toBe(200);
    expect(res.json.messages.length).toBeGreaterThan(0);
    for (const m of res.json.messages) expect(m).not.toHaveProperty('body');
  });
});
