import { z } from 'zod';
import { requireUser, requireRole } from '@/lib/auth';
import { json, readJson, route } from '@/lib/http';
import { searchByName } from '@/repos/patients';

const Body = z.object({ q: z.string().trim().min(2).max(80) });

/** POST so the name fragment travels in the body, never in the request line. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  requireRole(user, 'practitioner');
  const { q } = Body.parse(await readJson(req));
  const rows = await searchByName(user.orgId, q);
  return json({ results: rows.map((p) => ({ id: p.id, firstName: p.first_name, lastName: p.last_name, dateOfBirth: p.date_of_birth })) });
});
