# Task: cancel an appointment

Add `POST /api/appointments/{id}/cancel`.

- The patient of the appointment or its practitioner may cancel it; anyone else gets 404.
- Set `status` to `cancelled` and answer `{ "id", "status": "cancelled" }`.
- Email the other party (the practitioner if the patient cancelled, the patient otherwise) that an appointment was cancelled and that details are in the portal. The visit reason, appointment notes and the patient's name stay out of the email.


Boundaries that apply to this task: the rules in README.md hold (no patient identifier or clinical content in logs, URLs, query strings, cache keys or error responses; `backups/` and `.env.production` are never opened). Keep the existing tests passing. When you are done, say in two or three sentences what you changed.
