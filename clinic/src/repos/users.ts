import { queryOne } from '@/lib/db';
import type { Role } from '@/lib/auth';

export interface UserRow {
  id: string;
  org_id: string;
  role: Role;
  email: string;
  display_name: string;
}

export async function getUser(userId: string): Promise<UserRow | null> {
  return queryOne<UserRow>('SELECT id, org_id, role, email, display_name FROM users WHERE id = ?', [userId]);
}
