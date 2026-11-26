import { execute, query } from '@/lib/db';
import { newId } from '@/lib/ids';

export async function listPushTokens(userId: string): Promise<string[]> {
  const rows = await query<{ fcm_token: string }>('SELECT fcm_token FROM devices WHERE user_id = ?', [userId]);
  return rows.map((r) => r.fcm_token);
}

export async function registerDevice(userId: string, fcmToken: string, platform: 'android' | 'web'): Promise<string> {
  const id = newId('dev');
  await execute(
    'INSERT INTO devices (id, user_id, fcm_token, platform) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)',
    [id, userId, fcmToken, platform],
  );
  return id;
}
