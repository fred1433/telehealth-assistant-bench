// POSITIVE CONTROL: deliberately wrong. Any signed-in user of any practice reads any message, with joined patient fields.
import { requireUser } from '@/lib/auth';
import { json, route, HttpError } from '@/lib/http';
import { findWithContext, markRead } from '@/repos/messages';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  await requireUser(req);
  const { id } = await params;
  const m = await findWithContext(id);
  if (!m) throw new HttpError(404, 'not_found');
  await markRead(id);
  return json({ ...m, sentAt: m.created_at, from: { name: m.sender_name } });
});
