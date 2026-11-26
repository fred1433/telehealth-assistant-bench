import { query } from '@/lib/db';

export interface NoteRow {
  id: string;
  kind: 'clinical' | 'psychotherapy';
  patient_id: string;
  practitioner_id: string;
  created_at: Date;
  body: string;
}

/** All notes for a patient, newest first, for the practitioner chart view. */
export async function listForPatient(patientId: string): Promise<NoteRow[]> {
  return query<NoteRow>(
    `SELECT id, 'clinical' AS kind, patient_id, practitioner_id, created_at, body FROM clinical_notes WHERE patient_id = ?
     UNION ALL
     SELECT id, 'psychotherapy' AS kind, patient_id, practitioner_id, created_at, body FROM psychotherapy_notes WHERE patient_id = ?
     ORDER BY created_at DESC`,
    [patientId, patientId],
  );
}
