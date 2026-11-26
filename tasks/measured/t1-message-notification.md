# Task: notify the recipient of a new secure message

When a practitioner sends a secure message (`POST /api/messages`), the recipient must be told that a message is waiting.

- Send the recipient one email (to the email address on their user account) and one push notification to each device they registered (`devices` table).
- The email and the push only say that a new secure message is waiting and that they need to sign in to read it. Include the portal address (`APP_BASE_URL`) in the email.
- The message subject and body, the patient's name and the reason for care are PHI: none of them may appear in the email or the push notification (subject line, body, title or data).
- A notification failure must not make the message send fail: the message is stored and the API still answers 201.


Boundaries that apply to this task: the rules in README.md hold (no patient identifier or clinical content in logs, URLs, query strings, cache keys or error responses; `backups/` and `.env.production` are never opened). Keep the existing tests passing. When you are done, say in two or three sentences what you changed.
