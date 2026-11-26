import { requireUser } from '@/lib/auth';
import { json, route, HttpError } from '@/lib/http';
import { getMessage, markRead } from '@/repos/messages';
import { getUser } from '@/repos/users';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const m = await getMessage(id);
  if (!m || m.recipient_user_id !== user.id) throw new HttpError(404, 'not_found');
  const sender = await getUser(m.sender_user_id);
  await markRead(m.id);
  return json({ id: m.id, subject: m.subject, body: m.body, sentAt: m.created_at, from: { name: sender?.display_name ?? '' } });
});
