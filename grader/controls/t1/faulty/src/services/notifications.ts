// POSITIVE CONTROL: deliberately wrong. Puts message content and the patient's name in the notifications.
import { env } from '@/lib/env';
import { sendMail } from '@/lib/mailer';
import { sendPush } from '@/lib/push';
import { listPushTokens } from '@/repos/devices';
import { getUser } from '@/repos/users';

export async function notifyNewMessage(recipient: { id: string; email: string }, _id: string, subject: string, body: string): Promise<void> {
  const u = await getUser(recipient.id);
  await sendMail({ to: recipient.email, subject: `New message: ${subject}`, text: `Hi ${u?.display_name},\n\n${body}\n\n${env.appBaseUrl}` });
  for (const token of await listPushTokens(recipient.id)) {
    await sendPush({ token, notification: { title: `${u?.display_name}, new message`, body: body.slice(0, 80) } });
  }
}
