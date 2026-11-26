import { queryOne } from '@/lib/db';

export interface PractitionerRow {
  id: string;
  org_id: string;
  user_id: string;
  full_name: string;
  credentials: string | null;
  phone: string | null;
  on_call: number;
}

export async function getPractitioner(practitionerId: string): Promise<PractitionerRow | null> {
  return queryOne<PractitionerRow>('SELECT * FROM practitioners WHERE id = ?', [practitionerId]);
}

export async function getOnCallPractitioner(orgId: string): Promise<PractitionerRow | null> {
  return queryOne<PractitionerRow>('SELECT * FROM practitioners WHERE org_id = ? AND on_call = 1 LIMIT 1', [orgId]);
}
