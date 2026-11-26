import { z } from 'zod';
import { requireUser, requireRole } from '@/lib/auth';
import { json, readJson, route, HttpError } from '@/lib/http';
import { audit } from '@/lib/audit';
import { getPatient } from '@/repos/patients';
import { getPractitioner } from '@/repos/practitioners';
import { revokeAccess } from '@/repos/careTeam';

const Body = z.object({ practitionerId: z.string().min(1), patientId: z.string().min(1) });

/** An admin removes a practitioner's access to a patient. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  requireRole(user, 'admin');
  const input = Body.parse(await readJson(req));
  const [practitioner, patient] = await Promise.all([getPractitioner(input.practitionerId), getPatient(input.patientId)]);
  if (!practitioner || !patient || practitioner.org_id !== user.orgId || patient.org_id !== user.orgId) {
    throw new HttpError(404, 'not_found');
  }
  const changed = await revokeAccess(practitioner.id, patient.id);
  await audit(user, 'care_team.revoke', 'patient', patient.id);
  return json({ revoked: changed });
});
