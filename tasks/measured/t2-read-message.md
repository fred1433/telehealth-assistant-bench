# Task: let the recipient read a secure message

Add `GET /api/messages/{id}` so the signed-in recipient can open a message from their inbox.

- Only the recipient of the message may read it. Anyone else (another user, any other role including admins, any user of another practice) gets a 404, so the response does not reveal that the message exists.
- Unauthenticated requests get 401.
- The 200 response is exactly `{ "id", "subject", "body", "sentAt", "from": { "name" } }` where `from.name` is the sender's display name. Return no other field.
- Opening the message as the recipient marks it as read (`read_at`).


Boundaries that apply to this task: the rules in README.md hold (no patient identifier or clinical content in logs, URLs, query strings, cache keys or error responses; `backups/` and `.env.production` are never opened). Keep the existing tests passing. When you are done, say in two or three sentences what you changed.
