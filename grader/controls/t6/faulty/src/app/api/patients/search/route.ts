// POSITIVE CONTROL: deliberately wrong. Name in the query string, no practice filter, every column returned.
import { requireUser } from '@/lib/auth';
import { json, route } from '@/lib/http';
import { searchAll } from '@/repos/patients';

export const GET = route(async (req) => {
  await requireUser(req);
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const rows = await searchAll(q);
  return json({ results: rows.map((p) => ({ ...p, firstName: p.first_name, lastName: p.last_name, dateOfBirth: p.date_of_birth })) });
});
