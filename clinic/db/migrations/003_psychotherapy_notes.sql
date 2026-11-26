-- 2026-07-09 move psychotherapy notes out of clinical_notes into their own table.
CREATE TABLE psychotherapy_notes (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  patient_id VARCHAR(32) NOT NULL,
  practitioner_id VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  body TEXT NOT NULL
);
INSERT INTO psychotherapy_notes (id, patient_id, practitioner_id, created_at, body)
  SELECT id, patient_id, practitioner_id, created_at, body FROM clinical_notes WHERE kind = 'psychotherapy';
DELETE FROM clinical_notes WHERE kind = 'psychotherapy';
ALTER TABLE clinical_notes DROP COLUMN kind;
