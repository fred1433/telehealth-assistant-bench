import { requireUser } from '@/lib/auth';
import { json, route, HttpError } from '@/lib/http';
import { todayUtc } from '@/lib/time';
import { listForPractitionerOnDay } from '@/repos/appointments';

/** The signed-in practitioner's appointments for today (UTC), for the day view. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  if (user.role !== 'practitioner' || !user.practitionerId) throw new HttpError(403, 'forbidden');
  const day = todayUtc();
  const rows = await listForPractitionerOnDay(user.practitionerId, day);
  return json({
    day,
    appointments: rows.map((a) => ({
      id: a.id,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      status: a.status,
      patient: { id: a.patient_id, firstName: a.patient_first_name, lastName: a.patient_last_name },
    })),
  });
});
