/** Plain session tokens from db/seed.sql (fictional users). */
export const TOKENS = {
  rosa: 'tok-rosa',   // practitioner, Juniper Hollow
  malik: 'tok-malik', // practitioner, Juniper Hollow
  dana: 'tok-dana',   // admin, Juniper Hollow
  ava: 'tok-ava',     // patient of Rosa
  theo: 'tok-theo',   // patient of Rosa
  priya: 'tok-priya', // patient of Malik
  hal: 'tok-hal',     // practitioner, Fernside (other practice)
  june: 'tok-june',   // patient, Fernside
} as const;

type AnyHandler = (req: Request, ctx: any) => Promise<Response>;

export async function call(
  handler: AnyHandler,
  opts: { method?: string; path?: string; token?: string; body?: unknown; params?: Record<string, string> } = {},
): Promise<{ status: number; json: any; text: string }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const req = new Request(`http://localhost${opts.path ?? '/'}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}
