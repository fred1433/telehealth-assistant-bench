import { requireUser } from '@/lib/auth';
import { json, route, HttpError } from '@/lib/http';
import { todayUtc } from '@/lib/time';
import { listForPractitionerOnDay } from '@/repos/appointments';
import { getRedis, KEY_PREFIX } from '@/lib/redis';

export const scheduleKey = (practitionerId: string, day: string) => `${KEY_PREFIX}schedule:${practitionerId}:${day}`;

/** The signed-in practitioner's appointments for today (UTC), for the day view. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  if (user.role !== 'practitioner' || !user.practitionerId) throw new HttpError(403, 'forbidden');
  const day = todayUtc();
  const key = scheduleKey(user.practitionerId, day);
  const cached = await getRedis().get(key);
  if (cached) return json(JSON.parse(cached));
  const rows = await listForPractitionerOnDay(user.practitionerId, day);
  const body = {
    day,
    appointments: rows.map((a) => ({
      id: a.id,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      status: a.status,
      patient: { id: a.patient_id, firstName: a.patient_first_name, lastName: a.patient_last_name },
    })),
  };
  await getRedis().set(key, JSON.stringify(body), 'EX', 300);
  return json(body);
});
