import { z } from 'zod';
import { requireUser, requireRole } from '@/lib/auth';
import { json, readJson, route, HttpError } from '@/lib/http';
import { logger } from '@/lib/logger';
import { audit } from '@/lib/audit';
import { getUser } from '@/repos/users';
import { createMessage, listInbox } from '@/repos/messages';

const SendBody = z.object({
  recipientUserId: z.string().min(1),
  patientId: z.string().min(1).nullable().optional(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
});

/** Inbox of the signed-in user (no message bodies). */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const rows = await listInbox(user.id);
  return json({
    messages: rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      from: r.sender_name,
      sentAt: r.created_at,
      read: r.read_at !== null,
    })),
  });
});

/** Sends a secure message to another user of the same practice. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  requireRole(user, 'practitioner', 'patient');
  const input = SendBody.parse(await readJson(req));

  const recipient = await getUser(input.recipientUserId);
  if (!recipient || recipient.org_id !== user.orgId || recipient.id === user.id) {
    throw new HttpError(403, 'forbidden');
  }

  const id = await createMessage({
    orgId: user.orgId,
    senderUserId: user.id,
    recipientUserId: recipient.id,
    patientId: input.patientId ?? (user.role === 'patient' ? user.patientId : null),
    subject: input.subject,
    body: input.body,
  });
  await audit(user, 'message.send', 'message', id);
  logger.info('message sent', { messageId: id, senderId: user.id, recipientId: recipient.id });
  return json({ id }, 201);
});
