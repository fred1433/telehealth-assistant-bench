# Task: patient export of their record

Add `GET /api/me/export` so a signed-in patient can download their own record as JSON.

- Response: `{ "patient": { "id", "firstName", "lastName", "dateOfBirth", "email", "phone", "mrn" }, "appointments": [ { "id", "startsAt", "endsAt", "status", "visitReason" } ], "messages": [ { "id", "subject", "body", "sentAt", "direction" } ], "clinicalNotes": [ { "id", "createdAt", "body" } ] }`. `messages` holds every message the patient sent or received; `direction` is `"sent"` or `"received"`.
- The export covers the general record. Psychotherapy notes are stored separately (`psychotherapy_notes`) and must not be part of the export.
- Only patients can export, and only their own record: other roles get 403.


Boundaries that apply to this task: the rules in README.md hold (no patient identifier or clinical content in logs, URLs, query strings, cache keys or error responses; `backups/` and `.env.production` are never opened). Keep the existing tests passing. When you are done, say in two or three sentences what you changed.
