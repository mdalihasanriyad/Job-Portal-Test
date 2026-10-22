import { randomBytes } from 'node:crypto';
import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { col } from './db.js';
import { HttpError, readJsonBody, type Req } from './http.js';
import { getAnalytics } from './analytics.js';
import { normalizeUrl } from './importParse.js';
import {
  OPTIONAL_JOB_KEYS,
  checkPublishable,
  organizationSlugFor,
  parseJobInput,
  type JobInput,
  type JobStatus,
} from './validate.js';

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
}

function toObjectId(value: string | undefined): ObjectId {
  if (!value || !/^[0-9a-f]{24}$/i.test(value)) throw new HttpError(404, 'not_found', 'চাকরিটি পাওয়া যায়নি।');
  return new ObjectId(value);
}

function toAdminJob(doc: Document): Record<string, unknown> {
  const { _id, createdBy: _createdBy, ...rest } = doc;
  return {
    id: String(_id),
    ...rest,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : undefined,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : undefined,
  };
}

function toListItem(doc: Document): Record<string, unknown> {
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    organization: doc.organization,
    category: doc.category,
    categorySlug: doc.categorySlug,
    status: doc.status,
    featured: Boolean(doc.featured),
    imported: Boolean(doc.import),
    possibleDuplicate: Boolean((doc.import as Document | undefined)?.possibleDuplicate),
    deadline: doc.deadline,
    publishedAt: doc.publishedAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : undefined,
  };
}

async function loadCategories(db: Db): Promise<{ slug: string; name: string }[]> {
  const docs = await col.categories(db).find({}, { projection: { slug: 1, name: 1 } }).sort({ name: 1 }).toArray();
  return docs.map((doc) => ({ slug: String(doc.slug), name: String(doc.name) }));
}

export async function listCategories(db: Db): Promise<unknown> {
  return { categories: await loadCategories(db) };
}

async function parseBody(db: Db, req: Req): Promise<{ input: JobInput; categoryName: string }> {
  const body = await readJsonBody(req);
  const categories = await loadCategories(db);
  const parsed = parseJobInput(body, categories.map((category) => category.slug));
  if (!parsed.ok) throw new HttpError(422, 'validation', 'ফর্মে কিছু ত্রুটি আছে। অনুগ্রহ করে সংশোধন করুন।', parsed.errors);
  if (parsed.value.status === 'published') {
    const problem = checkPublishable(parsed.value);
    if (problem) throw new HttpError(422, 'validation', problem, { status: problem });
  }
  const category = categories.find((item) => item.slug === parsed.value.categorySlug);
  return { input: parsed.value, categoryName: category?.name ?? parsed.value.categorySlug };
}

function buildFields(input: JobInput, categoryName: string): { set: Document; unset: Document } {
  const set: Document = {
    organization: input.organization,
    organizationSlug: organizationSlugFor(input.organization),
    title: input.title,
    positions: input.positions,
    categorySlug: input.categorySlug,
    category: categoryName,
    publishedAt: input.publishedAt,
    featured: input.featured,
    verified: input.verified,
  };
  const unset: Document = {};
  const sourceUrlKey = normalizeUrl(input.sourceUrl);
  if (sourceUrlKey) set.sourceUrlKey = sourceUrlKey;
  else unset.sourceUrlKey = '';
  for (const key of OPTIONAL_JOB_KEYS) {
    const value = input[key];
    if (value === undefined) unset[key] = '';
    else set[key] = value;
  }
  return { set, unset };
}

const IMPORT_VERIFY_MESSAGE = 'আমদানিকৃত চাকরি প্রকাশের আগে অফিসিয়াল বিজ্ঞপ্তির সাথে মিলিয়ে "যাচাই করেছি" টিক দিতে হবে।';

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number }).code === 11000;
}

export async function createJob(db: Db, req: Req, adminId: string): Promise<{ status: number; body: unknown }> {
  const { input, categoryName } = await parseBody(db, req);
  const { set } = buildFields(input, categoryName);
  const now = new Date();
  const status: JobStatus = input.status ?? 'draft';

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug = input.slug ?? `job-${randomBytes(4).toString('hex')}`;
    const doc: Document = {
      ...set,
      slug,
      status,
      createdAt: now,
      updatedAt: now,
      createdBy: new ObjectId(adminId),
    };
    if (input.verified) doc.verifiedAt = todayISO();
    try {
      const result = await col.jobs(db).insertOne(doc);
      const saved = await col.jobs(db).findOne({ _id: result.insertedId });
      return { status: 201, body: { job: toAdminJob(saved ?? doc) } };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      if (input.slug) throw new HttpError(409, 'duplicate_slug', 'এই স্লাগটি ইতিমধ্যে ব্যবহৃত হয়েছে।', { slug: 'এই স্লাগটি ইতিমধ্যে ব্যবহৃত হয়েছে।' });
    }
  }
  throw new HttpError(500, 'slug_generation_failed', 'স্লাগ তৈরি করা যায়নি, আবার চেষ্টা করুন।');
}

export async function getJob(db: Db, id: string | undefined): Promise<unknown> {
  const doc = await col.jobs(db).findOne({ _id: toObjectId(id) });
  if (!doc) throw new HttpError(404, 'not_found', 'চাকরিটি পাওয়া যায়নি।');
  return { job: toAdminJob(doc) };
}

export async function updateJob(db: Db, req: Req, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id);
  const existing = await col.jobs(db).findOne({ _id: objectId });
  if (!existing) throw new HttpError(404, 'not_found', 'চাকরিটি পাওয়া যায়নি।');

  const { input, categoryName } = await parseBody(db, req);
  const { set, unset } = buildFields(input, categoryName);
  set.status = input.status ?? existing.status;
  if (set.status === 'published' && existing.import && !input.verified) {
    throw new HttpError(422, 'validation', IMPORT_VERIFY_MESSAGE, { status: IMPORT_VERIFY_MESSAGE, verified: IMPORT_VERIFY_MESSAGE });
  }
  set.updatedAt = new Date();
  if (input.slug) set.slug = input.slug;

  if (input.verified) {
    if (!existing.verified || !existing.verifiedAt) set.verifiedAt = todayISO();
  } else {
    unset.verifiedAt = '';
  }

  try {
    const updated = await col.jobs(db).findOneAndUpdate(
      { _id: objectId },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { returnDocument: 'after' },
    );
    if (!updated) throw new HttpError(404, 'not_found', 'চাকরিটি পাওয়া যায়নি।');
    return { job: toAdminJob(updated) };
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new HttpError(409, 'duplicate_slug', 'এই স্লাগটি ইতিমধ্যে ব্যবহৃত হয়েছে।', { slug: 'এই স্লাগটি ইতিমধ্যে ব্যবহৃত হয়েছে।' });
    }
    throw error;
  }
}

export async function deleteJob(db: Db, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id);
  const result = await col.jobs(db).deleteOne({ _id: objectId });
  if (result.deletedCount === 0) throw new HttpError(404, 'not_found', 'চাকরিটি পাওয়া যায়নি।');
  await col.comments(db).deleteMany({ jobId: objectId });
  await col.scripts(db).deleteMany({ jobId: objectId });
  await col.jobViews(db).deleteMany({ jobId: objectId });
  return { ok: true };
}

export async function setJobStatus(db: Db, req: Req, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id);
  const body = await readJsonBody(req);
  const status = (body as { status?: unknown } | null)?.status;
  if (status !== 'draft' && status !== 'pending_review' && status !== 'published') {
    throw new HttpError(422, 'validation', 'স্ট্যাটাস সঠিক নয়।', { status: 'স্ট্যাটাস সঠিক নয়।' });
  }
  const existing = await col.jobs(db).findOne({ _id: objectId });
  if (!existing) throw new HttpError(404, 'not_found', 'চাকরিটি পাওয়া যায়নি।');

  if (status === 'published' && !existing.sourceUrl && !existing.applyUrl && !existing.circularRef) {
    const message = 'প্রকাশ করতে অন্তত একটি অফিসিয়াল সূত্র (আবেদন লিংক, বিজ্ঞপ্তির উৎস বা সার্কুলার URL) দিতে হবে।';
    throw new HttpError(422, 'validation', message, { status: message });
  }
  if (status === 'published' && existing.import && !existing.verified) {
    throw new HttpError(422, 'validation', IMPORT_VERIFY_MESSAGE, { status: IMPORT_VERIFY_MESSAGE });
  }
  const updated = await col.jobs(db).findOneAndUpdate(
    { _id: objectId },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'not_found', 'চাকরিটি পাওয়া যায়নি।');
  return { job: toAdminJob(updated) };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const number = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export async function listJobs(db: Db, url: URL): Promise<unknown> {
  const page = intParam(url.searchParams.get('page'), 1, 1, 100_000);
  const pageSize = intParam(url.searchParams.get('pageSize'), 10, 5, 50);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
  const status = url.searchParams.get('status') ?? '';
  const category = (url.searchParams.get('category') ?? '').trim().slice(0, 60);

  const and: Filter<Document>[] = [];
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: pattern }, { organization: pattern }, { slug: pattern }] });
  }
  if (status === 'expired') and.push({ status: 'published', deadline: { $lt: todayISO() } });
  else if (status === 'draft' || status === 'pending_review' || status === 'published') and.push({ status });
  if (category) and.push({ categorySlug: category });
  const filter: Filter<Document> = and.length ? { $and: and } : {};

  const jobs = col.jobs(db);
  const [total, docs] = await Promise.all([
    jobs.countDocuments(filter),
    jobs.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
  ]);
  return {
    items: docs.map(toListItem),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getStats(db: Db): Promise<unknown> {
  const jobs = col.jobs(db);
  const today = todayISO();
  const [total, published, draft, pendingReview, expired, recent, pendingComments, newMessages] = await Promise.all([
    jobs.countDocuments({}),
    jobs.countDocuments({ status: 'published' }),
    jobs.countDocuments({ status: 'draft' }),
    jobs.countDocuments({ status: 'pending_review' }),
    jobs.countDocuments({ status: 'published', deadline: { $lt: today } }),
    jobs.find({}).sort({ updatedAt: -1 }).limit(5).toArray(),
    col.comments(db).countDocuments({ status: 'pending' }),
    col.messages(db).countDocuments({ status: 'new' }),
  ]);
  return {
    counts: { total, published, draft, pendingReview, expired, pendingComments, newMessages },
    recent: recent.map(toListItem),
    analytics: await getAnalytics(db),
  };
}

/** The admin reviewed the possible-duplicate warning and decided this is a different job. */
export async function clearDuplicateFlag(db: Db, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id);
  const updated = await col.jobs(db).findOneAndUpdate(
    { _id: objectId },
    { $unset: { 'import.possibleDuplicate': '' }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'not_found', 'চাকরিটি পাওয়া যায়নি।');
  return { job: toAdminJob(updated) };
}
