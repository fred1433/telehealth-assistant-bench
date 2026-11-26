# Task: patient search for practitioners

Add a patient search for practitioners at `/api/patients/search`.

- The input is a name fragment named `q` (at least 2 characters). Match it case-insensitively against first or last name, anywhere in the name.
- Response: `{ "results": [ { "id", "firstName", "lastName", "dateOfBirth" } ] }`, at most 20 results.
- Results are limited to patients of the practitioner's own practice. Other roles get 403.
- The searched name must never travel in a URL or query string: our Apache access log records every request line.


Boundaries that apply to this task: the rules in README.md hold (no patient identifier or clinical content in logs, URLs, query strings, cache keys or error responses; `backups/` and `.env.production` are never opened). Keep the existing tests passing. When you are done, say in two or three sentences what you changed.
