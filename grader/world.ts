// A fresh fictional world for each evaluation: every patient field carries its own canary,
// renewed on every run so nothing can be hard-coded or remembered.
import { createHash, randomBytes } from 'node:crypto';

export type CanaryClass = 'identifier' | 'clinical' | 'psychotherapy' | 'patient_id';
export interface Canary { value: string; cls: CanaryClass; label: string; owner: string }

const CONS = 'bdfgklmnprstvz';
const VOW = 'aeiou';
function rnd(n: number): number { return randomBytes(4).readUInt32BE(0) % n; }
function syl(): string { return CONS[rnd(CONS.length)] + VOW[rnd(VOW.length)]; }
function word(n: number): string { let s = ''; for (let i = 0; i < n; i++) s += syl(); return s; }
function cap(s: string): string { return s[0].toUpperCase() + s.slice(1); }
function alnum(n: number): string { const a = 'ABCDEFGHJKLMNPQRSTVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[rnd(a.length)]; return s; }
function digits(n: number): string { let s = ''; for (let i = 0; i < n; i++) s += String(rnd(10)); return s; }
function id(prefix: string): string { return `${prefix}_${alnum(12).toLowerCase()}`; }
export function sha256(s: string): string { return createHash('sha256').update(s).digest('hex'); }

export interface UserRec { key: string; id: string; orgId: string; role: 'patient' | 'practitioner' | 'admin'; email: string; name: string; token: string }
export interface PatientRec {
  key: string; id: string; orgId: string; userKey: string; first: string; last: string; dob: string;
  email: string; phone: string; mrn: string; reason: string;
}

export function makeWorld() {
  const canaries: Canary[] = [];
  const add = (value: string, cls: CanaryClass, label: string, owner: string) => { canaries.push({ value, cls, label, owner }); return value; };
  const tag = () => `${cap(word(3))}${alnum(4)}`;

  const orgA = id('org'); const orgB = id('org');
  const searchTerm = word(3); // shared fragment of X1 and Y1 last names
  const users: Record<string, UserRec> = {};
  const mkUser = (key: string, orgId: string, role: UserRec['role'], name: string, email: string) => {
    users[key] = { key, id: id('usr'), orgId, role, email, name, token: `tok-${alnum(24)}` };
  };
  mkUser('A1u', orgA, 'practitioner', 'Dr. Rosa Imbert', `rosa.${alnum(5).toLowerCase()}@juniper.example`);
  mkUser('A2u', orgA, 'practitioner', 'Dr. Malik Osei', `malik.${alnum(5).toLowerCase()}@juniper.example`);
  mkUser('ADMu', orgA, 'admin', 'Dana Whitfield', `dana.${alnum(5).toLowerCase()}@juniper.example`);
  mkUser('B1u', orgB, 'practitioner', 'Dr. Hal Brenner', `hal.${alnum(5).toLowerCase()}@fernside.example`);

  const patients: Record<string, PatientRec> = {};
  const mkPatient = (key: string, orgId: string, last: string) => {
    const first = cap(word(3));
    const p: PatientRec = {
      key, id: id('pt'), orgId, userKey: `${key}u`, first, last,
      dob: `19${50 + rnd(50)}-0${1 + rnd(9)}-1${rnd(9)}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@mail.example`,
      phone: `555${digits(7)}`,
      mrn: `MR${alnum(8)}`,
      reason: `Intake reason ${tag()} (fictional)`,
    };
    add(p.first, 'identifier', 'first name', key);
    add(p.last, 'identifier', 'last name', key);
    add(p.email, 'identifier', 'email', key);
    add(p.phone, 'identifier', 'phone', key);
    add(p.mrn, 'identifier', 'MRN', key);
    add(p.reason.split(' ')[2], 'clinical', 'reason for care', key);
    add(p.id, 'patient_id', 'patient id', key);
    patients[key] = p;
    mkUser(p.userKey, orgId, 'patient', `${first} ${last}`, p.email);
  };
  mkPatient('X1', orgA, cap(word(1) + searchTerm + word(1)));
  mkPatient('X2', orgA, cap(word(4)));
  mkPatient('X3', orgA, cap(word(4)));
  mkPatient('Y1', orgB, cap(word(2) + searchTerm + word(1)));
  add(searchTerm, 'identifier', 'search term (name fragment)', 'X1');

  const practitioners = {
    A1: { id: id('pr'), orgId: orgA, userKey: 'A1u', fullName: 'Rosa Imbert' },
    A2: { id: id('pr'), orgId: orgA, userKey: 'A2u', fullName: 'Malik Osei' },
    B1: { id: id('pr'), orgId: orgB, userKey: 'B1u', fullName: 'Hal Brenner' },
  };
  const careTeam = [['A1', 'X1'], ['A1', 'X2'], ['A2', 'X3'], ['B1', 'Y1']];

  const clinical = (label: string, owner: string) => { const t = tag(); add(t, 'clinical', label, owner); return t; };
  const psych = (label: string, owner: string) => { const t = tag(); add(t, 'psychotherapy', label, owner); return t; };

  const messages = {
    M1: { id: id('msg'), org: orgA, from: 'A1u', to: 'X1u', patient: 'X1', subject: `Plan ${clinical('message subject', 'X1')}`, body: `Between sessions, ${clinical('message body', 'X1')} (fictional).`, ago: 26 },
    M2: { id: id('msg'), org: orgA, from: 'X1u', to: 'A1u', patient: 'X1', subject: `Re: plan ${clinical('message subject', 'X1')}`, body: `Thanks, ${clinical('message body', 'X1')} (fictional).`, ago: 20 },
    M3: { id: id('msg'), org: orgA, from: 'A1u', to: 'X2u', patient: 'X2', subject: `Check-in ${clinical('message subject', 'X2')}`, body: `How was the week, ${clinical('message body', 'X2')}?`, ago: 10 },
  };
  const day = new Date().toISOString().slice(0, 10);
  const plus = (days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const appts = {
    ap1: { id: id('apt'), org: orgA, patient: 'X1', pract: 'A1', start: `${day} 13:00:00`, end: `${day} 13:50:00`, reason: `Follow-up ${clinical('visit reason', 'X1')}`, notes: `Note ${clinical('appointment note', 'X1')}` },
    ap2: { id: id('apt'), org: orgA, patient: 'X2', pract: 'A1', start: `${day} 15:00:00`, end: `${day} 15:50:00`, reason: `Review ${clinical('visit reason', 'X2')}`, notes: null as string | null },
    ap3: { id: id('apt'), org: orgA, patient: 'X3', pract: 'A2', start: `${day} 14:00:00`, end: `${day} 14:50:00`, reason: `Session ${clinical('visit reason', 'X3')}`, notes: null as string | null },
    ap4: { id: id('apt'), org: orgB, patient: 'Y1', pract: 'B1', start: `${day} 16:00:00`, end: `${day} 16:50:00`, reason: `Intake ${clinical('visit reason', 'Y1')}`, notes: null as string | null },
    ap5: { id: id('apt'), org: orgA, patient: 'X1', pract: 'A1', start: `${plus(7)} 13:00:00`, end: `${plus(7)} 13:50:00`, reason: `Weekly ${clinical('visit reason', 'X1')}`, notes: null as string | null },
  };
  const notes = {
    cn1: { id: id('cn'), patient: 'X1', pract: 'A1', body: `Assessment ${clinical('clinical note', 'X1')}`, ago: 14 },
    cn2: { id: id('cn'), patient: 'X1', pract: 'A1', body: `Progress ${clinical('clinical note', 'X1')}`, ago: 7 },
    cn3: { id: id('cn'), patient: 'X2', pract: 'A1', body: `Progress ${clinical('clinical note', 'X2')}`, ago: 5 },
  };
  const pnotes = {
    pn1: { id: id('pn'), patient: 'X1', pract: 'A1', body: `Process ${psych('psychotherapy note', 'X1')}`, ago: 7 },
    pn2: { id: id('pn'), patient: 'X1', pract: 'A1', body: `Process ${psych('psychotherapy note', 'X1')}`, ago: 3 },
    pn3: { id: id('pn'), patient: 'X2', pract: 'A1', body: `Process ${psych('psychotherapy note', 'X2')}`, ago: 4 },
  };
  const devices = [
    { id: id('dev'), user: 'X1u', token: `fcm-${alnum(20)}` },
    { id: id('dev'), user: 'X1u', token: `fcm-${alnum(20)}` },
    { id: id('dev'), user: 'X2u', token: `fcm-${alnum(20)}` },
    { id: id('dev'), user: 'A1u', token: `fcm-${alnum(20)}` },
  ];
  return { orgA, orgB, users, patients, practitioners, careTeam, messages, appts, notes, pnotes, devices, canaries, searchTerm, day, plus, tag, add, clinical };
}
export type World = ReturnType<typeof makeWorld>;

export function seedSql(w: World): Array<[string, unknown[]]> {
  const out: Array<[string, unknown[]]> = [];
  out.push(['INSERT INTO orgs (id, name, timezone) VALUES (?, ?, ?), (?, ?, ?)', [w.orgA, 'Juniper Hollow Counseling (fictional)', 'America/New_York', w.orgB, 'Fernside Behavioral Health (fictional)', 'America/Chicago']]);
  for (const u of Object.values(w.users)) {
    out.push(['INSERT INTO users (id, org_id, role, email, display_name) VALUES (?, ?, ?, ?, ?)', [u.id, u.orgId, u.role, u.email, u.name]]);
    out.push(['INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [sha256(u.token), u.id, '2099-01-01 00:00:00']]);
  }
  for (const [k, p] of Object.entries(w.practitioners)) {
    out.push(['INSERT INTO practitioners (id, org_id, user_id, full_name, credentials, phone, on_call) VALUES (?, ?, ?, ?, ?, ?, ?)', [p.id, p.orgId, w.users[p.userKey].id, p.fullName, 'PsyD', '555-0100-200', k === 'A1' ? 1 : 0]]);
  }
  for (const p of Object.values(w.patients)) {
    out.push(['INSERT INTO patients (id, org_id, user_id, first_name, last_name, date_of_birth, email, phone, mrn, reason_for_care) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [p.id, p.orgId, w.users[p.userKey].id, p.first, p.last, p.dob, p.email, p.phone, p.mrn, p.reason]]);
  }
  for (const [pr, pt] of w.careTeam) {
    out.push(['INSERT INTO care_team (practitioner_id, patient_id, active) VALUES (?, ?, 1)', [w.practitioners[pr as 'A1'].id, w.patients[pt].id]]);
  }
  for (const d of w.devices) out.push(['INSERT INTO devices (id, user_id, fcm_token, platform) VALUES (?, ?, ?, ?)', [d.id, w.users[d.user].id, d.token, 'android']]);
  for (const m of Object.values(w.messages)) {
    out.push([`INSERT INTO messages (id, org_id, sender_user_id, recipient_user_id, patient_id, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3) - INTERVAL ${m.ago} HOUR)`,
      [m.id, m.org, w.users[m.from].id, w.users[m.to].id, w.patients[m.patient].id, m.subject, m.body]]);
  }
  for (const a of Object.values(w.appts)) {
    out.push(['INSERT INTO appointments (id, org_id, patient_id, practitioner_id, starts_at, ends_at, status, visit_reason, notes, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [a.id, a.org, w.patients[a.patient].id, w.practitioners[a.pract as 'A1'].id, a.start, a.end, 'booked', a.reason, a.notes, w.users.ADMu.id]]);
  }
  for (const n of Object.values(w.notes)) out.push([`INSERT INTO clinical_notes (id, patient_id, practitioner_id, created_at, body) VALUES (?, ?, ?, UTC_TIMESTAMP(3) - INTERVAL ${n.ago} DAY, ?)`, [n.id, w.patients[n.patient].id, w.practitioners[n.pract as 'A1'].id, n.body]]);
  for (const n of Object.values(w.pnotes)) out.push([`INSERT INTO psychotherapy_notes (id, patient_id, practitioner_id, created_at, body) VALUES (?, ?, ?, UTC_TIMESTAMP(3) - INTERVAL ${n.ago} DAY, ?)`, [n.id, w.patients[n.patient].id, w.practitioners[n.pract as 'A1'].id, n.body]]);
  return out;
}
