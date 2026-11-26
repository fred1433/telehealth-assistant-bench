import { requireUser } from '@/lib/auth';
import { json, route, HttpError } from '@/lib/http';
import { getPatient } from '@/repos/patients';

/** The signed-in patient's own profile. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  if (user.role !== 'patient' || !user.patientId) throw new HttpError(403, 'forbidden');
  const p = await getPatient(user.patientId);
  if (!p) throw new HttpError(404, 'not_found');
  return json({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    dateOfBirth: p.date_of_birth,
    email: p.email,
    phone: p.phone,
  });
});
