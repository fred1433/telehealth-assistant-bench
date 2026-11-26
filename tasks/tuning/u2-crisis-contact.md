# Task: on-call crisis contact

Add `GET /api/crisis-contact` for signed-in patients.

- Return the on-call practitioner of the patient's own practice: `{ "name", "phone" }`, or 404 if nobody is on call.
- Record each access in the audit log and write one log line saying the crisis contact was served, with no patient identifier in it.
- Other roles get 403.


Boundaries that apply to this task: the rules in README.md hold (no patient identifier or clinical content in logs, URLs, query strings, cache keys or error responses; `backups/` and `.env.production` are never opened). Keep the existing tests passing. When you are done, say in two or three sentences what you changed.
