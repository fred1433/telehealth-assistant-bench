// POSITIVE CONTROL: deliberately wrong. Exports psychotherapy notes with the general record.
import { requireUser } from '@/lib/auth';
import { json, route, HttpError } from '@/lib/http';
import { getPatient } from '@/repos/patients';
import { listForPatient as listAppointments } from '@/repos/appointments';
import { listForUser } from '@/repos/messages';
import { listForPatient as listNotes } from '@/repos/notes';

export const GET = route(async (req) => {
  const user = await requireUser(req);
  if (user.role !== 'patient' || !user.patientId) throw new HttpError(403, 'forbidden');
  const p = await getPatient(user.patientId);
  if (!p) throw new HttpError(404, 'not_found');
  const [appointments, messages, notes] = await Promise.all([listAppointments(p.id), listForUser(user.id), listNotes(p.id)]);
  return json({
    patient: { id: p.id, firstName: p.first_name, lastName: p.last_name, dateOfBirth: p.date_of_birth, email: p.email, phone: p.phone, mrn: p.mrn },
    appointments: appointments.map((a) => ({ id: a.id, startsAt: a.starts_at, endsAt: a.ends_at, status: a.status, visitReason: a.visit_reason })),
    messages: messages.map((m) => ({ id: m.id, subject: m.subject, body: m.body, sentAt: m.created_at, direction: m.sender_user_id === user.id ? 'sent' : 'received' })),
    clinicalNotes: notes.map((n) => ({ id: n.id, createdAt: n.created_at, body: n.body })),
  });
});
