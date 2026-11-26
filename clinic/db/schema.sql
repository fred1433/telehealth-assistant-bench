-- clinic-portal schema (MySQL 8). Current state of all migrations in db/migrations.
-- Times are stored in UTC.

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_log, devices, psychotherapy_notes, clinical_notes, appointments,
  messages, care_team, patients, practitioners, sessions, users, orgs;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE orgs (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  timezone    VARCHAR(64)  NOT NULL DEFAULT 'America/New_York'
) ENGINE=InnoDB;

CREATE TABLE users (
  id            VARCHAR(32)  NOT NULL PRIMARY KEY,
  org_id        VARCHAR(32)  NOT NULL,
  role          ENUM('patient','practitioner','admin') NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  display_name  VARCHAR(120) NOT NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_users_org FOREIGN KEY (org_id) REFERENCES orgs(id)
) ENGINE=InnoDB;

CREATE TABLE sessions (
  token_hash  CHAR(64)    NOT NULL PRIMARY KEY,
  user_id     VARCHAR(32) NOT NULL,
  expires_at  DATETIME(3) NOT NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE practitioners (
  id           VARCHAR(32)  NOT NULL PRIMARY KEY,
  org_id       VARCHAR(32)  NOT NULL,
  user_id      VARCHAR(32)  NOT NULL UNIQUE,
  full_name    VARCHAR(120) NOT NULL,
  credentials  VARCHAR(40)  NULL,
  phone        VARCHAR(40)  NULL,
  on_call      TINYINT(1)   NOT NULL DEFAULT 0,
  CONSTRAINT fk_pract_org FOREIGN KEY (org_id) REFERENCES orgs(id),
  CONSTRAINT fk_pract_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE patients (
  id               VARCHAR(32)  NOT NULL PRIMARY KEY,
  org_id           VARCHAR(32)  NOT NULL,
  user_id          VARCHAR(32)  NULL UNIQUE,
  first_name       VARCHAR(80)  NOT NULL,
  last_name        VARCHAR(80)  NOT NULL,
  date_of_birth    DATE         NOT NULL,
  email            VARCHAR(190) NULL,
  phone            VARCHAR(40)  NULL,
  mrn              VARCHAR(32)  NOT NULL UNIQUE,
  reason_for_care  TEXT         NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_patients_org_name (org_id, last_name, first_name),
  CONSTRAINT fk_patients_org FOREIGN KEY (org_id) REFERENCES orgs(id),
  CONSTRAINT fk_patients_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Which practitioner may see which patient. Access is removed by setting active = 0.
CREATE TABLE care_team (
  practitioner_id  VARCHAR(32) NOT NULL,
  patient_id       VARCHAR(32) NOT NULL,
  active           TINYINT(1)  NOT NULL DEFAULT 1,
  granted_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at       DATETIME(3) NULL,
  PRIMARY KEY (practitioner_id, patient_id),
  CONSTRAINT fk_ct_pract FOREIGN KEY (practitioner_id) REFERENCES practitioners(id),
  CONSTRAINT fk_ct_patient FOREIGN KEY (patient_id) REFERENCES patients(id)
) ENGINE=InnoDB;

CREATE TABLE messages (
  id                 VARCHAR(32)  NOT NULL PRIMARY KEY,
  org_id             VARCHAR(32)  NOT NULL,
  sender_user_id     VARCHAR(32)  NOT NULL,
  recipient_user_id  VARCHAR(32)  NOT NULL,
  patient_id         VARCHAR(32)  NULL,
  subject            VARCHAR(200) NOT NULL,
  body               TEXT         NOT NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  read_at            DATETIME(3)  NULL,
  KEY idx_messages_recipient (recipient_user_id, created_at),
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_user_id) REFERENCES users(id),
  CONSTRAINT fk_msg_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  CONSTRAINT fk_msg_patient FOREIGN KEY (patient_id) REFERENCES patients(id)
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id                  VARCHAR(32)  NOT NULL PRIMARY KEY,
  org_id              VARCHAR(32)  NOT NULL,
  patient_id          VARCHAR(32)  NOT NULL,
  practitioner_id     VARCHAR(32)  NOT NULL,
  starts_at           DATETIME     NOT NULL,
  ends_at             DATETIME     NOT NULL,
  status              ENUM('booked','cancelled','completed') NOT NULL DEFAULT 'booked',
  visit_reason        VARCHAR(500) NULL,
  notes               TEXT         NULL,
  created_by_user_id  VARCHAR(32)  NOT NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_appt_pract_day (practitioner_id, starts_at),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_appt_pract FOREIGN KEY (practitioner_id) REFERENCES practitioners(id)
) ENGINE=InnoDB;

-- General clinical record (progress notes, assessments).
CREATE TABLE clinical_notes (
  id               VARCHAR(32) NOT NULL PRIMARY KEY,
  patient_id       VARCHAR(32) NOT NULL,
  practitioner_id  VARCHAR(32) NOT NULL,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  body             TEXT        NOT NULL,
  CONSTRAINT fk_cn_patient FOREIGN KEY (patient_id) REFERENCES patients(id)
) ENGINE=InnoDB;

-- Psychotherapy notes are kept apart from the general record (see docs/sources.md).
CREATE TABLE psychotherapy_notes (
  id               VARCHAR(32) NOT NULL PRIMARY KEY,
  patient_id       VARCHAR(32) NOT NULL,
  practitioner_id  VARCHAR(32) NOT NULL,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  body             TEXT        NOT NULL,
  CONSTRAINT fk_pn_patient FOREIGN KEY (patient_id) REFERENCES patients(id)
) ENGINE=InnoDB;

CREATE TABLE devices (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  user_id     VARCHAR(32)  NOT NULL,
  fcm_token   VARCHAR(255) NOT NULL UNIQUE,
  platform    ENUM('android','web') NOT NULL DEFAULT 'android',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_dev_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE audit_log (
  id           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      VARCHAR(32)  NOT NULL,
  action       VARCHAR(64)  NOT NULL,
  target_type  VARCHAR(32)  NOT NULL,
  target_id    VARCHAR(32)  NOT NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
