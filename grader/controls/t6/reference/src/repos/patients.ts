import { query, queryOne } from '@/lib/db';

export interface PatientRow {
  id: string;
  org_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: Date;
  email: string | null;
  phone: string | null;
  mrn: string;
  reason_for_care: string | null;
  created_at: Date;
}

export async function getPatient(patientId: string): Promise<PatientRow | null> {
  return queryOne<PatientRow>('SELECT * FROM patients WHERE id = ?', [patientId]);
}

export async function getPatientByUserId(userId: string): Promise<PatientRow | null> {
  return queryOne<PatientRow>('SELECT * FROM patients WHERE user_id = ?', [userId]);
}

/** Name search within one practice. */
export async function searchByName(orgId: string, fragment: string): Promise<PatientRow[]> {
  const like = `%${fragment.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return query<PatientRow>(
    'SELECT * FROM patients WHERE org_id = ? AND (first_name LIKE ? OR last_name LIKE ?) ORDER BY last_name, first_name LIMIT 20',
    [orgId, like, like],
  );
}
