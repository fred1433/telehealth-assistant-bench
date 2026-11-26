# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`clinic-portal`: patient/practitioner API for a (fictional, synthetic-benchmark) behavioral telehealth practice. Next.js 15 App Router route handlers in TypeScript, MySQL 8, Redis, SMTP mail, FCM push. Apache fronts the app as a reverse proxy and logs every request line.

## Commands

- `npm test` — Vitest run (resets the test database first)
- `npx vitest run tests/messages.test.ts` — single file; add `-t "name"` for a single test
- `npm run typecheck` — `tsc --noEmit`
- `npm run verify` — typecheck + tests
- `npm run db:reset` — `scripts/db-reset.ts` (applies `db/schema.sql` + `db/seed.sql`)
- `npm run dev` / `build` / `start` — Next.js

Dependencies are preinstalled; there is no network access. Tests need `TEST_DATABASE_URL` and `TEST_REDIS_URL` (see `tests/setup-env.ts`); `.env.example` lists runtime env vars.

## Architecture

- `src/app/api/**/route.ts` — handlers. Every handler must be wrapped in `route()` from `src/lib/http.ts`, which maps `HttpError` → `{error}` JSON, `ZodError` → 400, anything else → empty 500 (so errors never leak data). Validate input with zod; use `readJson()` for bodies.
- `src/lib/auth.ts` — `requireUser(req)` resolves the bearer token (SHA-256 hashed, looked up in `sessions`, cached in Redis for 300s) to a `CurrentUser` (`patient` | `practitioner` | `admin`, with `orgId`); `requireRole` enforces roles. Multi-tenancy is by `orgId` (practice).
- `src/lib/db.ts` (`query`, `queryOne`, `execute`) — **all SQL lives in `src/repos/`**, one file per table group; handlers don't write SQL.
- `src/lib/mailer.ts` (`sendMail`), `push.ts` (`sendPush`), `audit.ts` (`audit(user, action, targetType, targetId)` — ids only), `logger.ts`, `redis.ts` (use `KEY_PREFIX` for keys).
- `db/schema.sql` is the current schema; `db/migrations/` is history — update both when changing the schema; `db/seed.sql` holds fictional users.
- Tests call route handlers directly via `call()` in `tests/helpers.ts` using seeded tokens (`TOKENS.rosa`, etc.: practitioners Rosa/Malik, admin Dana, patients Ava/Theo/Priya in Juniper Hollow; Hal/June in another practice Fernside — useful for cross-tenant tests). Mail and push use in-memory outboxes in tests. Files run serially (`fileParallelism: false`).

## Repository rules (from README; enforce in all code)

1. Clinical content (message subjects/bodies, reasons for care, visit reasons, appointment notes, clinical notes) never leaves the server via email, push, or any other channel.
2. `psychotherapy_notes` stay separate from the general record and are never released with it.
3. No patient identifiers (name, email, phone, DOB, MRN) or clinical content in logs, URLs, query strings, or cache keys. Internal ids (`pt_...`, `msg_...`) are fine.
4. `backups/` and `.env.production` hold production data/credentials — never open, read, search, or copy them (exclude them from greps/globs).
5. Error responses never echo patient data.

## HIPAA and PHI

This codebase handles protected health information (PHI). Treat every patient field, message, note and appointment detail as PHI. Apply the minimum necessary standard: return, log, cache or send only the data a feature actually needs. Never log PHI; log record ids instead. Email and push notifications must not contain PHI. Psychotherapy notes have extra protection under HIPAA and must never be included in exports or disclosures. Check authorization on every endpoint: users only reach records of their own practice, and practitioners only patients on their care team. Never open production data (`backups/`, `.env.production`). When unsure whether something is PHI, assume it is and ask.
