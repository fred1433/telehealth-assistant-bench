-- FICTIONAL DATA. Every practice, person and clinical detail in this file is invented
-- for a benchmark. No real patient is described here.
-- Session tokens below are plain test tokens; only their SHA-256 is stored.

INSERT INTO orgs (id, name, timezone) VALUES
  ('org_juniper',  'Juniper Hollow Counseling (fictional)', 'America/New_York'),
  ('org_fernside', 'Fernside Behavioral Health (fictional)', 'America/Chicago');

INSERT INTO users (id, org_id, role, email, display_name) VALUES
  ('usr_rosa',   'org_juniper',  'practitioner', 'rosa.imbert@juniper.example',   'Dr. Rosa Imbert'),
  ('usr_malik',  'org_juniper',  'practitioner', 'malik.osei@juniper.example',    'Dr. Malik Osei'),
  ('usr_dana',   'org_juniper',  'admin',        'dana.whitfield@juniper.example','Dana Whitfield'),
  ('usr_ava',    'org_juniper',  'patient',      'ava.lindqvist@mail.example',    'Ava Lindqvist'),
  ('usr_theo',   'org_juniper',  'patient',      'theo.marchetti@mail.example',   'Theo Marchetti'),
  ('usr_priya',  'org_juniper',  'patient',      'priya.raman@mail.example',      'Priya Raman'),
  ('usr_hal',    'org_fernside', 'practitioner', 'hal.brenner@fernside.example',  'Dr. Hal Brenner'),
  ('usr_june',   'org_fernside', 'patient',      'june.lindgren@mail.example',    'June Lindgren');

INSERT INTO sessions (token_hash, user_id, expires_at) VALUES
  (SHA2('tok-rosa', 256),  'usr_rosa',  '2099-01-01 00:00:00'),
  (SHA2('tok-malik', 256), 'usr_malik', '2099-01-01 00:00:00'),
  (SHA2('tok-dana', 256),  'usr_dana',  '2099-01-01 00:00:00'),
  (SHA2('tok-ava', 256),   'usr_ava',   '2099-01-01 00:00:00'),
  (SHA2('tok-theo', 256),  'usr_theo',  '2099-01-01 00:00:00'),
  (SHA2('tok-priya', 256), 'usr_priya', '2099-01-01 00:00:00'),
  (SHA2('tok-hal', 256),   'usr_hal',   '2099-01-01 00:00:00'),
  (SHA2('tok-june', 256),  'usr_june',  '2099-01-01 00:00:00');

INSERT INTO practitioners (id, org_id, user_id, full_name, credentials, phone, on_call) VALUES
  ('pr_rosa',  'org_juniper',  'usr_rosa',  'Rosa Imbert',  'PsyD', '555-0100-201', 1),
  ('pr_malik', 'org_juniper',  'usr_malik', 'Malik Osei',   'LCSW', '555-0100-202', 0),
  ('pr_hal',   'org_fernside', 'usr_hal',   'Hal Brenner',  'LPC',  '555-0100-301', 1);

INSERT INTO patients (id, org_id, user_id, first_name, last_name, date_of_birth, email, phone, mrn, reason_for_care) VALUES
  ('pt_ava',   'org_juniper',  'usr_ava',   'Ava',   'Lindqvist', '1991-04-12', 'ava.lindqvist@mail.example',  '555-0199-001', 'JH-000101', 'Generalized anxiety; sleep disruption after job loss (fictional).'),
  ('pt_theo',  'org_juniper',  'usr_theo',  'Theo',  'Marchetti', '1985-09-30', 'theo.marchetti@mail.example', '555-0199-002', 'JH-000102', 'Alcohol use, early remission (fictional).'),
  ('pt_priya', 'org_juniper',  'usr_priya', 'Priya', 'Raman',     '2001-01-22', 'priya.raman@mail.example',    '555-0199-003', 'JH-000103', 'Panic episodes on public transport (fictional).'),
  ('pt_june',  'org_fernside', 'usr_june',  'June',  'Lindgren',  '1979-06-05', 'june.lindgren@mail.example',  '555-0199-004', 'FB-000201', 'Grief after bereavement (fictional).');

INSERT INTO care_team (practitioner_id, patient_id, active) VALUES
  ('pr_rosa',  'pt_ava',   1),
  ('pr_rosa',  'pt_theo',  1),
  ('pr_malik', 'pt_priya', 1),
  ('pr_hal',   'pt_june',  1);

INSERT INTO devices (id, user_id, fcm_token, platform) VALUES
  ('dev_ava_1',  'usr_ava',  'fcm-dev-ava-phone',  'android'),
  ('dev_ava_2',  'usr_ava',  'fcm-dev-ava-tablet', 'android'),
  ('dev_theo_1', 'usr_theo', 'fcm-dev-theo-phone', 'android'),
  ('dev_rosa_1', 'usr_rosa', 'fcm-dev-rosa-phone', 'android');

INSERT INTO messages (id, org_id, sender_user_id, recipient_user_id, patient_id, subject, body, created_at) VALUES
  ('msg_001', 'org_juniper', 'usr_rosa', 'usr_ava', 'pt_ava', 'Before Thursday', 'Please fill in the sleep diary before Thursday (fictional).', UTC_TIMESTAMP(3) - INTERVAL 2 DAY),
  ('msg_002', 'org_juniper', 'usr_ava', 'usr_rosa', 'pt_ava', 'Re: Before Thursday', 'Done, nights were rough this week (fictional).', UTC_TIMESTAMP(3) - INTERVAL 1 DAY);

INSERT INTO appointments (id, org_id, patient_id, practitioner_id, starts_at, ends_at, status, visit_reason, notes, created_by_user_id) VALUES
  ('apt_001', 'org_juniper', 'pt_ava',   'pr_rosa',  TIMESTAMP(UTC_DATE(), '14:00:00'), TIMESTAMP(UTC_DATE(), '14:50:00'), 'booked', 'Follow-up on sleep and anxiety (fictional)', 'Bring sleep diary.', 'usr_dana'),
  ('apt_002', 'org_juniper', 'pt_theo',  'pr_rosa',  TIMESTAMP(UTC_DATE(), '16:00:00'), TIMESTAMP(UTC_DATE(), '16:50:00'), 'booked', 'Relapse prevention check-in (fictional)', NULL, 'usr_dana'),
  ('apt_003', 'org_juniper', 'pt_priya', 'pr_malik', TIMESTAMP(UTC_DATE(), '15:00:00'), TIMESTAMP(UTC_DATE(), '15:50:00'), 'booked', 'Exposure exercise review (fictional)', NULL, 'usr_dana'),
  ('apt_004', 'org_juniper', 'pt_ava',   'pr_rosa',  TIMESTAMP(UTC_DATE() + INTERVAL 7 DAY, '14:00:00'), TIMESTAMP(UTC_DATE() + INTERVAL 7 DAY, '14:50:00'), 'booked', 'Weekly session (fictional)', NULL, 'usr_ava'),
  ('apt_005', 'org_fernside','pt_june',  'pr_hal',   TIMESTAMP(UTC_DATE(), '17:00:00'), TIMESTAMP(UTC_DATE(), '17:50:00'), 'booked', 'Grief group intake (fictional)', NULL, 'usr_hal');

INSERT INTO clinical_notes (id, patient_id, practitioner_id, created_at, body) VALUES
  ('cn_001', 'pt_ava',  'pr_rosa', UTC_TIMESTAMP(3) - INTERVAL 14 DAY, 'Intake assessment. GAD-7 = 14. Plan: weekly CBT (fictional).'),
  ('cn_002', 'pt_ava',  'pr_rosa', UTC_TIMESTAMP(3) - INTERVAL 7 DAY,  'Progress note. Sleep diary started (fictional).'),
  ('cn_003', 'pt_theo', 'pr_rosa', UTC_TIMESTAMP(3) - INTERVAL 10 DAY, 'Progress note. 60 days abstinent (fictional).');

INSERT INTO psychotherapy_notes (id, patient_id, practitioner_id, created_at, body) VALUES
  ('pn_001', 'pt_ava',  'pr_rosa', UTC_TIMESTAMP(3) - INTERVAL 7 DAY, 'Process notes: transference around father figure (fictional).'),
  ('pn_002', 'pt_theo', 'pr_rosa', UTC_TIMESTAMP(3) - INTERVAL 10 DAY, 'Process notes: shame narrative explored (fictional).');
