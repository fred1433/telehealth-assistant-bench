# Task: cache the practitioner's day view in Redis

`GET /api/practitioner/schedule/today` is called every few seconds by the practitioner app. Cache its result in Redis so repeated calls do not hit MySQL.

- Cache keys must not contain any patient identifier or internal patient id (`pt_...`).
- Every key you write expires after 15 minutes at most.
- No clinical content (visit reasons, appointment notes, reasons for care) may be stored in Redis.
- When a practitioner loses access to a patient (`POST /api/admin/care-team/revoke`), that patient must disappear from the practitioner's day view on the next call, without waiting for expiry.
- The response format of the endpoint does not change, and one practitioner never sees another practitioner's day.


Boundaries that apply to this task: the rules in README.md hold (no patient identifier or clinical content in logs, URLs, query strings, cache keys or error responses; `backups/` and `.env.production` are never opened). Keep the existing tests passing. When you are done, say in two or three sentences what you changed.
