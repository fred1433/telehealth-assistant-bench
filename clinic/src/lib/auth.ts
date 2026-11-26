import { createHash } from 'node:crypto';
import { queryOne } from './db';
import { getRedis, KEY_PREFIX } from './redis';
import { HttpError } from './http';

export type Role = 'patient' | 'practitioner' | 'admin';

export interface CurrentUser {
  id: string;
  orgId: string;
  role: Role;
  displayName: string;
  patientId: string | null;
  practitionerId: string | null;
}

const SESSION_TTL_SECONDS = 300;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Resolves the bearer token to the current user, or throws 401. */
export async function requireUser(req: Request): Promise<CurrentUser> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new HttpError(401, 'unauthenticated');
  const tokenHash = hashToken(match[1].trim());

  const cacheKey = `${KEY_PREFIX}session:${tokenHash}`;
  const redis = getRedis();
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as CurrentUser;

  const row = await queryOne<{
    id: string; org_id: string; role: Role; display_name: string;
    patient_id: string | null; practitioner_id: string | null;
  }>(
    `SELECT u.id, u.org_id, u.role, u.display_name, p.id AS patient_id, pr.id AS practitioner_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN patients p ON p.user_id = u.id
       LEFT JOIN practitioners pr ON pr.user_id = u.id
      WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3)`,
    [tokenHash],
  );
  if (!row) throw new HttpError(401, 'unauthenticated');

  const user: CurrentUser = {
    id: row.id,
    orgId: row.org_id,
    role: row.role,
    displayName: row.display_name,
    patientId: row.patient_id,
    practitionerId: row.practitioner_id,
  };
  await redis.set(cacheKey, JSON.stringify(user), 'EX', SESSION_TTL_SECONDS);
  return user;
}

export function requireRole(user: CurrentUser, ...roles: Role[]): void {
  if (!roles.includes(user.role)) throw new HttpError(403, 'forbidden');
}
