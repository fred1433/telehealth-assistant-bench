import { execute, query } from '@/lib/db';
import { newId } from '@/lib/ids';
import { utcDayBounds } from '@/lib/time';

export interface AppointmentRow {
  id: string;
  org_id: string;
  patient_id: string;
  practitioner_id: string;
  starts_at: Date;
  ends_at: Date;
  status: 'booked' | 'cancelled' | 'completed';
  visit_reason: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: Date;
}

export async function listForPatient(patientId: string): Promise<AppointmentRow[]> {
  return query<AppointmentRow>(
    'SELECT * FROM appointments WHERE patient_id = ? ORDER BY starts_at',
    [patientId],
  );
}

/**
 * A practitioner's appointments for one UTC day, limited to patients they still have
 * access to. Rows include the patient's name for display.
 */
export async function listForPractitionerOnDay(
  practitionerId: string,
  day: string,
): Promise<Array<AppointmentRow & { patient_first_name: string; patient_last_name: string }>> {
  const { start, end } = utcDayBounds(day);
  return query(
    `SELECT a.*, p.first_name AS patient_first_name, p.last_name AS patient_last_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN care_team ct ON ct.practitioner_id = a.practitioner_id AND ct.patient_id = a.patient_id AND ct.active = 1
      WHERE a.practitioner_id = ? AND a.starts_at >= ? AND a.starts_at < ? AND a.status <> 'cancelled'
      ORDER BY a.starts_at`,
    [practitionerId, start, end],
  );
}

export async function createAppointment(input: {
  orgId: string;
  patientId: string;
  practitionerId: string;
  startsAt: Date;
  endsAt: Date;
  visitReason: string | null;
  createdByUserId: string;
}): Promise<string> {
  const id = newId('apt');
  await execute(
    `INSERT INTO appointments (id, org_id, patient_id, practitioner_id, starts_at, ends_at, status, visit_reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'booked', ?, ?)`,
    [id, input.orgId, input.patientId, input.practitionerId, input.startsAt, input.endsAt, input.visitReason, input.createdByUserId],
  );
  return id;
}
