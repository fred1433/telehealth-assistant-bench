// POSITIVE CONTROL: deliberately wrong. Logs the request body and the driver error (with its SQL), echoes the SQL to the client.
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { logger } from './logger';

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly publicMessage: string) {
    super(publicMessage);
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/**
 * Wraps a route handler: known HttpErrors become JSON `{ error }` responses,
 * validation errors become 400, anything else becomes a 500.
 */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    const copy = req.clone();
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.publicMessage }, err.status);
      if (err instanceof ZodError) return json({ error: 'invalid_request' }, 400);
      const errorId = randomUUID();
      logger.error('request failed', { errorId, route: new URL(req.url).pathname, err, body: await copy.text() });
      return json({ errorId, detail: String((err as Error).message), sql: (err as { sql?: string }).sql }, 500);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}
