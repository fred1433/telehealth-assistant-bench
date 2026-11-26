import { execute, queryOne } from '@/lib/db';

export async function hasActiveAccess(practitionerId: string, patientId: string): Promise<boolean> {
  const row = await queryOne(
    'SELECT 1 AS ok FROM care_team WHERE practitioner_id = ? AND patient_id = ? AND active = 1',
    [practitionerId, patientId],
  );
  return row !== null;
}

/** Removes a practitioner's access to a patient. Returns false if there was no active access. */
export async function revokeAccess(practitionerId: string, patientId: string): Promise<boolean> {
  const res = await execute(
    'UPDATE care_team SET active = 0, revoked_at = UTC_TIMESTAMP(3) WHERE practitioner_id = ? AND patient_id = ? AND active = 1',
    [practitionerId, patientId],
  );
  return res.affectedRows > 0;
}
