import { env } from './env';

export interface PushMessage {
  token: string;
  notification: { title: string; body: string };
  data?: Record<string, string>;
}

/** In-memory outbox used when PUSH_TRANSPORT=memory (tests). */
export const pushOutbox: PushMessage[] = [];

/** Sends one push through the FCM HTTP v1 API. */
export async function sendPush(message: PushMessage): Promise<void> {
  if (env.pushTransport === 'memory') {
    pushOutbox.push(message);
    return;
  }
  const url = `${env.fcmEndpoint}/v1/projects/${env.fcmProject}/messages:send`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.fcmAccessToken}`,
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`fcm_send_failed status=${res.status}`);
}
