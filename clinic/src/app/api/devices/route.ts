import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { json, readJson, route } from '@/lib/http';
import { registerDevice } from '@/repos/devices';

const Body = z.object({ fcmToken: z.string().min(10).max(255), platform: z.enum(['android', 'web']).default('android') });

/** Registers the caller's device for push notifications (Android app, FCM). */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = Body.parse(await readJson(req));
  const id = await registerDevice(user.id, body.fcmToken, body.platform);
  return json({ id }, 201);
});
