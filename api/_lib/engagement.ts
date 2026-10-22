import type { Db, Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import { col } from './db.js';
import { HttpError, getIp, readJsonBody, type Req } from './http.js';
import { hit } from './rateLimit.js';
import { parseComment, parseContact } from './validatePublic.js';
import { findPublishedJobBySlug } from './publicService.js';

const HOUR = 3600;

function iso(value: unknown): string | undefined {
  return value instanceof Date ? value.toISOString() : undefined;
}

function toObjectId(value: string | undefined): ObjectId {
  if (!value || !/^[0-9a-f]{24}$/i.test(value)) throw new HttpError(404, 'not_found', 'রেকর্ডটি পাওয়া যায়নি।');
  return new ObjectId(value);
}

async function enforceLimit(db: Db, key: string, limit: number): Promise<void> {
  const result = await hit(db, key, limit, HOUR);
  if (!result.allowed) {
    throw new HttpError(429, 'rate_limited', `অনেক বেশি অনুরোধ পাঠানো হয়েছে। প্রায় ${Math.ceil(result.retryAfterSeconds / 60)} মিনিট পরে আবার চেষ্টা করুন।`);
  }
}

// ---------- public: comments ----------

export async function listApprovedComments(db: Db, slug: string): Promise<unknown> {
  const docs = await col.comments(db)
    .find({ jobSlug: slug, status: 'approved' }, { projection: { name: 1, comment: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return { comments: docs.map((doc) => ({ id: String(doc._id), name: doc.name, comment: doc.comment, createdAt: iso(doc.createdAt) })) };
}

export async function createComment(db: Db, req: Req, slug: string): Promise<unknown> {
  const body = await readJsonBody(req);
  const parsed = parseComment(body);
  if (!parsed.ok) throw new HttpError(422, 'validation', 'ফর্মে কিছু ত্রুটি আছে।', parsed.errors);
  await enforceLimit(db, `comment:ip:${getIp(req)}`, 5);
  const job = await findPublishedJobBySlug(db, slug);

  const message = 'ধন্যবাদ! আপনার মন্তব্য অ্যাডমিনের অনুমোদনের পর প্রকাশিত হবে।';
  if (parsed.value.honeypot) return { ok: true, message }; // silently drop bot submissions

  const now = new Date();
  await col.comments(db).insertOne({
    jobId: job._id,
    jobSlug: job.slug,
    jobTitle: job.title,
    name: parsed.value.name,
    comment: parsed.value.comment,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true, message };
}

// ---------- public: contact ----------

export async function createContactMessage(db: Db, req: Req): Promise<unknown> {
  const body = await readJsonBody(req);
  const parsed = parseContact(body);
  if (!parsed.ok) throw new HttpError(422, 'validation', 'ফর্মে কিছু ত্রুটি আছে।', parsed.errors);
  await enforceLimit(db, `contact:ip:${getIp(req)}`, 5);

  const message = 'ধন্যবাদ! আপনার বার্তা পাঠানো হয়েছে।';
  if (parsed.value.honeypot) return { ok: true, message };

  const { honeypot: _honeypot, ...fields } = parsed.value;
  await col.messages(db).insertOne({ ...fields, status: 'new', createdAt: new Date() });
  return { ok: true, message };
}

// ---------- admin: comments ----------

function toAdminComment(doc: Document): Record<string, unknown> {
  return {
    id: String(doc._id),
    jobSlug: doc.jobSlug,
    jobTitle: doc.jobTitle,
    name: doc.name,
    comment: doc.comment,
    status: doc.status,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

function pageParams(url: URL): { page: number; pageSize: number } {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  return { page, pageSize: 15 };
}

export async function adminListComments(db: Db, url: URL): Promise<unknown> {
  const { page, pageSize } = pageParams(url);
  const status = url.searchParams.get('status');
  const filter: Document = status === 'pending' || status === 'approved' || status === 'hidden' ? { status } : {};
  const [total, docs] = await Promise.all([
    col.comments(db).countDocuments(filter),
    col.comments(db).find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
  ]);
  return { items: docs.map(toAdminComment), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function adminUpdateComment(db: Db, req: Req, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id);
  const parsed = parseComment(await readJsonBody(req));
  if (!parsed.ok) throw new HttpError(422, 'validation', 'ফর্মে কিছু ত্রুটি আছে।', parsed.errors);
  const updated = await col.comments(db).findOneAndUpdate(
    { _id: objectId },
    { $set: { name: parsed.value.name, comment: parsed.value.comment, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'not_found', 'মন্তব্যটি পাওয়া যায়নি।');
  return { comment: toAdminComment(updated) };
}

export async function adminSetCommentStatus(db: Db, req: Req, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id);
  const status = ((await readJsonBody(req)) as { status?: unknown } | null)?.status;
  if (status !== 'pending' && status !== 'approved' && status !== 'hidden') {
    throw new HttpError(422, 'validation', 'স্ট্যাটাস সঠিক নয়।');
  }
  const updated = await col.comments(db).findOneAndUpdate(
    { _id: objectId },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'not_found', 'মন্তব্যটি পাওয়া যায়নি।');
  return { comment: toAdminComment(updated) };
}

export async function adminDeleteComment(db: Db, id: string | undefined): Promise<unknown> {
  const result = await col.comments(db).deleteOne({ _id: toObjectId(id) });
  if (result.deletedCount === 0) throw new HttpError(404, 'not_found', 'মন্তব্যটি পাওয়া যায়নি।');
  return { ok: true };
}

// ---------- admin: contact messages ----------

function toAdminMessage(doc: Document): Record<string, unknown> {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    subject: doc.subject,
    message: doc.message,
    status: doc.status,
    createdAt: iso(doc.createdAt),
  };
}

export async function adminListMessages(db: Db, url: URL): Promise<unknown> {
  const { page, pageSize } = pageParams(url);
  const status = url.searchParams.get('status');
  const filter: Document = status === 'new' || status === 'read' || status === 'archived' ? { status } : {};
  const [total, docs] = await Promise.all([
    col.messages(db).countDocuments(filter),
    col.messages(db).find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
  ]);
  return { items: docs.map(toAdminMessage), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function adminSetMessageStatus(db: Db, req: Req, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id);
  const status = ((await readJsonBody(req)) as { status?: unknown } | null)?.status;
  if (status !== 'new' && status !== 'read' && status !== 'archived') {
    throw new HttpError(422, 'validation', 'স্ট্যাটাস সঠিক নয়।');
  }
  const updated = await col.messages(db).findOneAndUpdate({ _id: objectId }, { $set: { status } }, { returnDocument: 'after' });
  if (!updated) throw new HttpError(404, 'not_found', 'বার্তাটি পাওয়া যায়নি।');
  return { message: toAdminMessage(updated) };
}

export async function adminDeleteMessage(db: Db, id: string | undefined): Promise<unknown> {
  const result = await col.messages(db).deleteOne({ _id: toObjectId(id) });
  if (result.deletedCount === 0) throw new HttpError(404, 'not_found', 'বার্তাটি পাওয়া যায়নি।');
  return { ok: true };
}
