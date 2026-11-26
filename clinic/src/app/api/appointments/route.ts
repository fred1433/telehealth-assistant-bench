import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { json, readJson, route, HttpError } from '@/lib/http';
import { audit } from '@/lib/audit';
import { hasActiveAccess } from '@/repos/careTeam';
import { getPractitioner } from '@/repos/practitioners';
import { createAppointment, listForPatient } from '@/repos/appointments';

const BookBody = z.object({
  practitionerId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  visitReason: z.string().max(500).nullable().optional(),
});

/** The signed-in patient's appointments. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  if (user.role !== 'patient' || !user.patientId) throw new HttpError(403, 'forbidden');
  const rows = await listForPatient(user.patientId);
  return json({
    appointments: rows.map((a) => ({
      id: a.id,
      practitionerId: a.practitioner_id,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      status: a.status,
      visitReason: a.visit_reason,
    })),
  });
});

/** A patient books an appointment with a practitioner of their care team. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  if (user.role !== 'patient' || !user.patientId) throw new HttpError(403, 'forbidden');
  const input = BookBody.parse(await readJson(req));

  const practitioner = await getPractitioner(input.practitionerId);
  if (!practitioner || practitioner.org_id !== user.orgId) throw new HttpError(404, 'not_found');
  if (!(await hasActiveAccess(practitioner.id, user.patientId))) throw new HttpError(403, 'forbidden');

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!(endsAt > startsAt)) throw new HttpError(400, 'invalid_time_range');

  const id = await createAppointment({
    orgId: user.orgId,
    patientId: user.patientId,
    practitionerId: practitioner.id,
    startsAt,
    endsAt,
    visitReason: input.visitReason ?? null,
    createdByUserId: user.id,
  });
  await audit(user, 'appointment.book', 'appointment', id);
  return json({ id }, 201);
});
