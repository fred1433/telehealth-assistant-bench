// POSITIVE CONTROL: deliberately wrong. Raw rows (visit reasons) cached forever, patient data in keys, no invalidation.
import { requireUser } from '@/lib/auth';
import { json, route, HttpError } from '@/lib/http';
import { todayUtc } from '@/lib/time';
import { listForPractitionerOnDay } from '@/repos/appointments';
import { getRedis } from '@/lib/redis';

/** The signed-in practitioner's appointments for today (UTC), for the day view. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  if (user.role !== 'practitioner' || !user.practitionerId) throw new HttpError(403, 'forbidden');
  const day = todayUtc();
  const key = `schedule:${user.practitionerId}`;
  const hit = await getRedis().get(key);
  const rows = hit ? JSON.parse(hit) : await listForPractitionerOnDay(user.practitionerId, day);
  if (!hit) {
    await getRedis().set(key, JSON.stringify(rows));
    for (const r of rows) await getRedis().set(`schedule:patient:${r.patient_id}:${r.patient_last_name}`, r.id);
  }
  return json({
    day,
    appointments: rows.map((a: any) => ({
      id: a.id,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      status: a.status,
      patient: { id: a.patient_id, firstName: a.patient_first_name, lastName: a.patient_last_name },
    })),
  });
});
