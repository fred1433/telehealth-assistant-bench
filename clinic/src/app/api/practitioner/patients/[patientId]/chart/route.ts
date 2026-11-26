import { requireUser } from '@/lib/auth';
import { json, route, HttpError } from '@/lib/http';
import { audit } from '@/lib/audit';
import { hasActiveAccess } from '@/repos/careTeam';
import { getPatient } from '@/repos/patients';
import { listForPatient } from '@/repos/notes';

type Ctx = { params: Promise<{ patientId: string }> };

/** Chart view for a practitioner on the patient's care team. */
export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  if (user.role !== 'practitioner' || !user.practitionerId) throw new HttpError(403, 'forbidden');
  const { patientId } = await params;
  const patient = await getPatient(patientId);
  if (!patient || patient.org_id !== user.orgId) throw new HttpError(404, 'not_found');
  if (!(await hasActiveAccess(user.practitionerId, patient.id))) throw new HttpError(403, 'forbidden');

  const notes = await listForPatient(patient.id);
  await audit(user, 'chart.view', 'patient', patient.id);
  return json({
    patient: {
      id: patient.id,
      firstName: patient.first_name,
      lastName: patient.last_name,
      dateOfBirth: patient.date_of_birth,
      mrn: patient.mrn,
      reasonForCare: patient.reason_for_care,
    },
    notes: notes.map((n) => ({ id: n.id, kind: n.kind, createdAt: n.created_at, body: n.body })),
  });
});
