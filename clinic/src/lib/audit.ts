import { execute } from './db';
import type { CurrentUser } from './auth';

/** Records who did what to which record. Store ids only, never content. */
export async function audit(user: CurrentUser, action: string, targetType: string, targetId: string): Promise<void> {
  await execute(
    'INSERT INTO audit_log (user_id, action, target_type, target_id) VALUES (?, ?, ?, ?)',
    [user.id, action, targetType, targetId],
  );
}
