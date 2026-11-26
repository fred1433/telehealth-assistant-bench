import { execute, query, queryOne } from '@/lib/db';
import { newId } from '@/lib/ids';

export interface MessageRow {
  id: string;
  org_id: string;
  sender_user_id: string;
  recipient_user_id: string;
  patient_id: string | null;
  subject: string;
  body: string;
  created_at: Date;
  read_at: Date | null;
}

export async function createMessage(input: {
  orgId: string;
  senderUserId: string;
  recipientUserId: string;
  patientId: string | null;
  subject: string;
  body: string;
}): Promise<string> {
  const id = newId('msg');
  await execute(
    `INSERT INTO messages (id, org_id, sender_user_id, recipient_user_id, patient_id, subject, body)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.orgId, input.senderUserId, input.recipientUserId, input.patientId, input.subject, input.body],
  );
  return id;
}

/** Inbox listing: no bodies. */
export async function listInbox(userId: string): Promise<Array<{ id: string; subject: string; sender_name: string; created_at: Date; read_at: Date | null }>> {
  return query(
    `SELECT m.id, m.subject, u.display_name AS sender_name, m.created_at, m.read_at
       FROM messages m JOIN users u ON u.id = m.sender_user_id
      WHERE m.recipient_user_id = ?
      ORDER BY m.created_at DESC`,
    [userId],
  );
}

/**
 * Full message with everything around it (sender, recipient, patient), as used by the
 * support console when staff investigate a delivery problem.
 */
export async function findWithContext(messageId: string): Promise<Record<string, unknown> | null> {
  return queryOne(
    `SELECT m.*,
            s.display_name AS sender_name, s.email AS sender_email,
            r.display_name AS recipient_name, r.email AS recipient_email,
            p.first_name AS patient_first_name, p.last_name AS patient_last_name,
            p.mrn AS patient_mrn, p.date_of_birth AS patient_dob, p.reason_for_care AS patient_reason_for_care
       FROM messages m
       JOIN users s ON s.id = m.sender_user_id
       JOIN users r ON r.id = m.recipient_user_id
       LEFT JOIN patients p ON p.id = m.patient_id
      WHERE m.id = ?`,
    [messageId],
  );
}

export async function getMessage(messageId: string): Promise<MessageRow | null> {
  return queryOne<MessageRow>('SELECT * FROM messages WHERE id = ?', [messageId]);
}

export async function markRead(messageId: string): Promise<void> {
  await execute('UPDATE messages SET read_at = UTC_TIMESTAMP(3) WHERE id = ? AND read_at IS NULL', [messageId]);
}

/** Every message a user sent or received. */
export async function listForUser(userId: string): Promise<MessageRow[]> {
  return query<MessageRow>(
    'SELECT * FROM messages WHERE sender_user_id = ? OR recipient_user_id = ? ORDER BY created_at',
    [userId, userId],
  );
}
