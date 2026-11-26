import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { sendMail } from '@/lib/mailer';
import { sendPush } from '@/lib/push';
import { listPushTokens } from '@/repos/devices';

/** Tells a user that a secure message is waiting. Never includes message content or patient details. */
export async function notifyNewMessage(recipient: { id: string; email: string }, messageId: string): Promise<void> {
  try {
    await sendMail({
      to: recipient.email,
      subject: 'You have a new secure message',
      text: `A new secure message is waiting for you. Sign in to read it: ${env.appBaseUrl}`,
    });
  } catch (err) {
    logger.warn('message email notification failed', { messageId, recipientId: recipient.id, code: (err as { code?: string }).code });
  }
  for (const token of await listPushTokens(recipient.id)) {
    try {
      await sendPush({ token, notification: { title: 'New secure message', body: 'Sign in to read it.' }, data: { type: 'message' } });
    } catch (err) {
      logger.warn('message push notification failed', { messageId, recipientId: recipient.id, code: (err as { code?: string }).code });
    }
  }
}
