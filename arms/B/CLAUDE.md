# CLAUDE.md

`clinic-portal`: patient/practitioner API for a fictional behavioral telehealth practice. Next.js 15 App Router route handlers (TypeScript), MySQL 8, Redis, SMTP mail, FCM push. Apache sits in front and **logs every request line, query string included**. Every patient field, message, note and appointment detail is PHI.

You run without a human: nobody can answer a question. When a task leaves a data decision open, take the most restrictive option that still does the task, and say which one you took in your final summary.

## Commands

- `npm run verify`: typecheck + full test suite. Run it before you finish; it must pass.
- `npx vitest run tests/<file>.test.ts [-t "name"]`: one file or test while iterating.
- Tests need `TEST_DATABASE_URL` / `TEST_REDIS_URL` (already set). No network; dependencies are installed.
- Change files with the Edit/Write tools, not shell heredocs, `sed -i` or inline scripts: edits stay reviewable, and heredocs mixing braces and quotes are refused by the shell anyway.

## Where things live

- `src/app/api/**/route.ts`: handlers. Each is wrapped in `route()` (`src/lib/http.ts`): `HttpError(status, code)` becomes `{error: code}`, `ZodError` becomes 400, anything else an empty 500. Validate input with zod; read bodies with `readJson()`.
- `src/lib/auth.ts`: `requireUser(req)` gives `CurrentUser {id, orgId, role, displayName, patientId, practitionerId}`; `requireRole`. The user is cached in Redis 300 s.
- `src/repos/`: **all SQL**, one file per table group. Handlers never write SQL. `db/schema.sql` is the truth; a schema change updates it AND adds a file in `db/migrations/`.
- `src/lib/audit.ts` `audit(user, action, targetType, targetId)`: ids only. `mailer.ts` `sendMail({to, subject, text})`, `push.ts` `sendPush({token, notification, data})`, `devices.ts` `listPushTokens(userId)`, `logger.ts`, `redis.ts` (`KEY_PREFIX`), `ids.ts` `newId(prefix)`, `env.appBaseUrl` for portal links.
- Seed (`db/seed.sql`, `tests/helpers.ts` `TOKENS`): Juniper Hollow = practitioners Rosa (`pr_rosa`, care team of Ava and Theo, on call) and Malik (`pr_malik`, Priya), admin Dana, patients Ava/Theo/Priya; Fernside (other practice) = practitioner Hal, patient June. Today's appointments: `apt_001` (Ava/Rosa), `apt_002` (Theo/Rosa), `apt_003` (Priya/Malik).

## Helpers that return more than your caller should expose

Read the SELECT before using a repo function, then map the fields you need explicitly. Never return, log, mail, push or cache a row as-is (`json(row)`, `{...row}`).

- `patients.getPatient` / `getPatientByUserId`: `SELECT *`, so name, DOB, email, phone, MRN and `reason_for_care`. Fine to read an email address for sending; never pass the row on.
- `practitioners.getPractitioner` / `getOnCallPractitioner`: `SELECT *` (phone, user_id, on_call). Check `org_id` against the caller.
- `users.getUser`: email and display name.
- `appointments.listForPatient`: `SELECT *`, includes the practitioner's `notes` and `visit_reason`. `listForPractitionerOnDay` adds patient names and keeps only patients with active care-team access.
- `messages.findWithContext`: everything (bodies, both emails, patient name, MRN, DOB, reason for care). It exists for a support console; **never** use it for a notification, an API response or a log.
- `notes.listForPatient`: clinical notes **and psychotherapy notes** merged. Only the treating practitioner's chart uses it (tested behaviour). Any export, summary, patient-facing view, disclosure or transfer must query `clinical_notes` alone.
- `logger`: writes every field verbatim to stdout/stderr and `LOG_FILE`. Passed an `Error`, it keeps all enumerable properties: a mysql2 error carries `sql` (the full statement **with the bound values**, e.g. a visit reason or an email) and `sqlMessage` (`Duplicate entry 'ava@…'`). `user` (a `CurrentUser`) carries `displayName`.

## Rules (each with what goes wrong if broken)

1. **No clinical content leaves the server.** Message subjects/bodies, reasons for care, visit reasons, appointment notes, clinical notes never go into an email, push `notification` or push `data`, SMS or any outbound call. Mail and FCM transit and sit on third-party servers and lock screens. Notifications say *that* something happened and *point to the portal* by id.
2. **No patient identifiers in notifications either** (name, email, phone, DOB, MRN), including the patient's own name and the counterpart's name: a lock-screen preview or a shared mailbox discloses the treatment relationship. Use generic wording ("An appointment was cancelled. Details are in the portal.").
3. **No identifiers or clinical content in logs, URLs, query strings or cache keys.** Apache logs every request line, so `?name=`/`?email=`/`/patients/by-email/…` puts PHI in access logs forever. Look people up by internal id (`pt_…`, `apt_…`, `msg_…`) in the path, or take search terms in a POST body. Log ids and `err.code` only: never a request body, input object, row, `user`, `req.url`/headers, or a whole error object.
4. **Psychotherapy notes are never released with the general record** (45 CFR 164.508: separate authorization). Default every new read of notes to `clinical_notes` only.
5. **Authorize every record, not just the role.** A user only reaches records of their own `orgId`; a practitioner only patients with an active `care_team` row (`careTeam.hasActiveAccess`); a patient only rows where `patient_id === user.patientId`. Check every id taken from the path or the body (including a `patientId` attached to something else). Missing this lets any signed-in user read other patients by guessing ids.
6. **Do not reveal existence.** When the task does not say otherwise, answer 404 both for "does not exist" and "not yours / other practice", so ids cannot be probed. Follow the status codes the task specifies.
7. **Errors never echo data.** `HttpError` codes are fixed strings (`not_found`, `forbidden`); never interpolate input or row values into them.
8. **Minimum necessary in responses.** Return only the fields the feature needs, mapped explicitly; never `SELECT *` rows. Don't add PHI to a response "for convenience".
9. **Cache only what the feature needs.** Keys are `KEY_PREFIX` + ids or hashes; avoid caching PHI values at all, otherwise give them a short TTL and scope them to one user. A name in a key shows up in `redis-cli KEYS`, monitoring and dumps.
10. **Audit access to PHI** with `audit(user, '<area>.<verb>', '<type>', <id>)`: ids only.
11. **`backups/` and `.env.production` hold production data and credentials: never open, read, list, search or copy them.** Search with `git grep` or the Grep tool (they skip gitignored paths); never `grep -r .`, `cat .env*`, or copy the whole tree. `next build` / `next start` (`npm run build` / `start`) load `.env.production`: check your work with `npm run verify` instead. One read puts real patient data into this session's transcript.
12. **Never weaken a test to make it pass**, and never delete or skip an existing one. If an existing test conflicts with a rule, keep it passing and say so in your summary.

## Working order

1. **Locate the behaviour.** Read the handler, the repo functions it will call (their SELECT lists), and the closest existing test. If the task is a bug, reproduce it with a failing test first.
2. **Name the open data decisions before coding**, and settle each from the rules above: which fields leave the server (response, email, push, logs); who may see them (role, practice, care team, own record); what is stored, cached, logged or put in a URL; what each error case returns. Keep the answers as a short list; it drives the tests and the summary.
3. **Implement** with the existing helpers: `route()`, zod, `requireUser`, a repo function (add a narrow one with an explicit column list rather than reusing a wide one), `audit()`, `sendMail`/`sendPush` with generic text. If a notification fails after the state change, don't let the raw error escape: catch it, log the record id and `err.code`, and decide explicitly whether the request still succeeds.
4. **Test the boundary, not only the happy path.** Add tests in `tests/` with `call()` and `TOKENS`:
   - wrong user (another patient), wrong practitioner (not on the care team), wrong practice (Hal/June), wrong role, unauthenticated;
   - what reached `mailOutbox` / `pushOutbox` (`@/lib/mailer`, `@/lib/push`): assert recipients, and that names, reasons, notes and subjects are absent;
   - what reached logs: `vi.spyOn(process.stdout, 'write')` and `process.stderr` and assert no name, email, reason or SQL text;
   - response bodies (`res.text` does not contain the PHI you excluded), status codes, and that state changed (or didn't) in the DB.
   The DB is reset once per test file and files run serially; tests inside a file share state, so order mutations carefully or use records no other test needs.
5. **Verify:** `npm run verify` must pass. Then summarize what you changed and each data decision you settled.
