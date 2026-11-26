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
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.publicMessage }, err.status);
      if (err instanceof ZodError) return json({ error: 'invalid_request' }, 400);
      const errorId = randomUUID();
      const e = err as { name?: string; code?: string; errno?: number; sqlState?: string; sqlMessage?: string; message?: string };
      logger.error('unhandled error', {
        errorId,
        route: new URL(req.url).pathname,
        method: req.method,
        cause: { name: e.name, code: e.code, errno: e.errno, sqlState: e.sqlState, message: e.sqlMessage ?? e.message },
      });
      return json({ errorId }, 500);
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
