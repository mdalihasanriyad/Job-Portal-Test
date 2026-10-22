import { timingSafeEqual } from 'node:crypto';
import { ObjectId, type Db, type Document } from 'mongodb';
import { col } from './db.js';
import { HttpError, readJsonBody, type Req } from './http.js';
import {
  cleanLink, findPossibleDuplicate, itemKey, normalizeUrl, parseFeed, toPlainText,
  type DuplicateCandidate, type FeedItem,
} from './importParse.js';
import { FetchError, assertPublicHttpsUrl, safeFetchText } from './netSafe.js';
import { hit } from './rateLimit.js';
import { checkRobots } from './robots.js';
import { cleanString, organizationSlugFor, type ParseResult } from './validate.js';

const MAX_ITEMS_PER_RUN = 50;
const MIN_RUN_INTERVAL_SECONDS = 600;
const DUPLICATE_WINDOW_DAYS = 120;

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
}

function toObjectId(value: string | undefined): ObjectId {
  if (!value || !/^[0-9a-f]{24}$/i.test(value)) throw new HttpError(404, 'not_found', 'সোর্সটি পাওয়া যায়নি।');
  return new ObjectId(value);
}

function iso(value: unknown): string | undefined {
  return value instanceof Date ? value.toISOString() : undefined;
}

// ---------------------------------------------------------------- sources (admin CRUD)

export interface SourceInput {
  name: string;
  type: 'rss' | 'json';
  url: string;
  defaultOrganization: string;
  defaultCategorySlug: string;
  authorizationNote: string;
  termsUrl?: string;
  enabled: boolean;
}

export function parseSource(body: unknown, categorySlugs: string[]): ParseResult<SourceInput> {
  const errors: Record<string, string> = {};
  const raw = typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!raw) return { ok: false, errors: { _form: 'অনুরোধের তথ্য সঠিক নয়।' } };

  const name = cleanString(raw.name, false);
  if (name.length < 2 || name.length > 80) errors.name = 'নাম ২–৮০ অক্ষরের হতে হবে।';

  const type = raw.type === 'json' ? 'json' : raw.type === 'rss' ? 'rss' : null;
  if (!type) errors.type = 'ধরন বেছে নিন (RSS/Atom অথবা JSON)।';

  const url = cleanString(raw.url, false);
  if (!url || url.length > 500) errors.url = 'ফিডের URL আবশ্যক।';
  else {
    try {
      assertPublicHttpsUrl(url);
    } catch (error) {
      errors.url = error instanceof FetchError ? error.message : 'URL সঠিক নয়।';
    }
  }

  const defaultOrganization = cleanString(raw.defaultOrganization, false);
  if (defaultOrganization.length < 2 || defaultOrganization.length > 150) errors.defaultOrganization = 'প্রতিষ্ঠানের নাম ২–১৫০ অক্ষরের হতে হবে।';

  const defaultCategorySlug = cleanString(raw.defaultCategorySlug, false);
  if (!categorySlugs.includes(defaultCategorySlug)) errors.defaultCategorySlug = 'ক্যাটাগরি বেছে নিন।';

  const authorizationNote = cleanString(raw.authorizationNote, true);
  if (authorizationNote.length < 10 || authorizationNote.length > 500) errors.authorizationNote = 'অনুমতির বিবরণ ১০–৫০০ অক্ষরে লিখুন (কেন এই ফিড স্বয়ংক্রিয়ভাবে আনা বৈধ)।';

  let termsUrl: string | undefined = cleanString(raw.termsUrl, false);
  if (!termsUrl) termsUrl = undefined;
  else {
    try {
      const parsed = new URL(termsUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
    } catch {
      errors.termsUrl = 'শর্তাবলির লিংক সঠিক URL নয়।';
    }
  }

  if (raw.authorized !== true) errors.authorized = 'চালিয়ে যেতে অনুমতির ঘোষণায় টিক দিন।';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, type: type as 'rss' | 'json', url, defaultOrganization, defaultCategorySlug, authorizationNote, termsUrl, enabled: raw.enabled === true } };
}

function toSource(doc: Document): Record<string, unknown> {
  return {
    id: String(doc._id),
    name: doc.name,
    type: doc.type,
    url: doc.url,
    defaultOrganization: doc.defaultOrganization,
    defaultCategorySlug: doc.defaultCategorySlug,
    authorizationNote: doc.authorizationNote,
    termsUrl: doc.termsUrl,
    enabled: Boolean(doc.enabled),
    lastRunAt: iso(doc.lastRunAt),
    lastRunOk: doc.lastRunOk,
    lastRunSummary: doc.lastRunSummary,
    createdAt: iso(doc.createdAt),
  };
}

async function categorySlugs(db: Db): Promise<string[]> {
  const docs = await col.categories(db).find({}, { projection: { slug: 1 } }).toArray();
  return docs.map((doc) => String(doc.slug));
}

export async function listSources(db: Db): Promise<unknown> {
  const docs = await col.importSources(db).find({}).sort({ createdAt: -1 }).toArray();
  return { sources: docs.map(toSource) };
}

export async function createSource(db: Db, req: Req): Promise<{ status: number; body: unknown }> {
  const parsed = parseSource(await readJsonBody(req), await categorySlugs(db));
  if (!parsed.ok) throw new HttpError(422, 'validation', 'ফর্মে কিছু ত্রুটি আছে।', parsed.errors);
  const now = new Date();
  const result = await col.importSources(db).insertOne({ ...parsed.value, createdAt: now, updatedAt: now });
  return { status: 201, body: { source: toSource({ ...parsed.value, _id: result.insertedId, createdAt: now }) } };
}

export async function updateSource(db: Db, req: Req, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id);
  const parsed = parseSource(await readJsonBody(req), await categorySlugs(db));
  if (!parsed.ok) throw new HttpError(422, 'validation', 'ফর্মে কিছু ত্রুটি আছে।', parsed.errors);
  const { termsUrl, ...rest } = parsed.value;
  const update: Document = { $set: { ...rest, updatedAt: new Date(), ...(termsUrl ? { termsUrl } : {}) } };
  if (!termsUrl) update.$unset = { termsUrl: '' };
  const updated = await col.importSources(db).findOneAndUpdate({ _id: objectId }, update, { returnDocument: 'after' });
  if (!updated) throw new HttpError(404, 'not_found', 'সোর্সটি পাওয়া যায়নি।');
  return { source: toSource(updated) };
}

export async function deleteSource(db: Db, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id);
  const result = await col.importSources(db).deleteOne({ _id: objectId });
  if (result.deletedCount === 0) throw new HttpError(404, 'not_found', 'সোর্সটি পাওয়া যায়নি।');
  return { ok: true }; // already-imported jobs stay; their import info keeps the source name
}

export async function listRuns(db: Db, id: string | undefined): Promise<unknown> {
  const docs = await col.importRuns(db).find({ sourceId: toObjectId(id) }).sort({ startedAt: -1 }).limit(15).toArray();
  return {
    runs: docs.map((doc) => ({
      id: String(doc._id),
      trigger: doc.trigger,
      startedAt: iso(doc.startedAt),
      finishedAt: iso(doc.finishedAt),
      ok: Boolean(doc.ok),
      summary: doc.summary,
      error: doc.error,
    })),
  };
}

// ---------------------------------------------------------------- running an import

export interface RunSummary {
  fetched: number;
  created: number;
  skippedKnown: number;
  skippedInvalid: number;
  possibleDuplicates: number;
}

async function loadDuplicateCandidates(db: Db, urlKey: string | undefined): Promise<DuplicateCandidate[]> {
  const since = new Date(Date.parse(`${todayISO()}T00:00:00Z`) - DUPLICATE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const recent = await col.jobs(db)
    .find({ publishedAt: { $gte: since } }, { projection: { title: 1, slug: 1, sourceUrlKey: 1 } })
    .sort({ publishedAt: -1 })
    .limit(800)
    .toArray();
  const list: DuplicateCandidate[] = recent.map((doc) => ({ id: doc._id, slug: String(doc.slug), title: String(doc.title), sourceUrlKey: doc.sourceUrlKey as string | undefined }));
  if (urlKey) {
    const same = await col.jobs(db).findOne({ sourceUrlKey: urlKey }, { projection: { title: 1, slug: 1, sourceUrlKey: 1 } });
    if (same && !list.some((entry) => String(entry.id) === String(same._id))) {
      list.push({ id: same._id, slug: String(same.slug), title: String(same.title), sourceUrlKey: urlKey });
    }
  }
  return list;
}

export async function importItem(db: Db, source: Document, item: FeedItem, summary: RunSummary, now: Date): Promise<void> {
  const sourceId = String(source._id);
  const key = itemKey(sourceId, item);

  if (await col.importSeen(db).findOne({ itemKey: key })) {
    summary.skippedKnown += 1; // imported before (even if the job was later deleted)
    return;
  }
  const title = item.title.replace(/\s+/g, ' ').trim();
  if (title.length < 5) {
    summary.skippedInvalid += 1;
    return;
  }

  const sourceUrl = cleanLink(item.link);
  const urlKey = normalizeUrl(sourceUrl);
  const duplicate = findPossibleDuplicate({ title, urlKey }, await loadDuplicateCandidates(db, urlKey));

  const category = await col.categories(db).findOne({ slug: source.defaultCategorySlug });
  const doc: Document = {
    slug: `imp-${key.slice(0, 10)}`,
    organization: source.defaultOrganization,
    organizationSlug: organizationSlugFor(String(source.defaultOrganization)),
    title: title.slice(0, 200),
    positions: [],
    categorySlug: source.defaultCategorySlug,
    category: category ? String(category.name) : String(source.defaultCategorySlug),
    publishedAt: item.date ?? todayISO(),
    status: 'pending_review',
    verified: false,
    featured: false,
    createdAt: now,
    updatedAt: now,
    import: {
      sourceId: source._id,
      sourceName: source.name,
      itemKey: key,
      retrievedAt: now,
      // Admin-only reference. Never published: the admin must write the job from the official notice.
      excerpt: toPlainText(item.summary ?? '').slice(0, 280),
      ...(sourceUrl ? { itemUrl: sourceUrl } : {}),
      ...(duplicate
        ? { possibleDuplicate: { jobId: duplicate.match.id, slug: duplicate.match.slug, title: duplicate.match.title, score: Number(duplicate.score.toFixed(2)), reason: duplicate.reason } }
        : {}),
    },
  };
  if (sourceUrl) {
    doc.sourceUrl = sourceUrl;
    if (urlKey) doc.sourceUrlKey = urlKey;
  }

  try {
    await col.jobs(db).insertOne(doc);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      summary.skippedKnown += 1;
      return;
    }
    throw error;
  }
  await col.importSeen(db).updateOne({ itemKey: key }, { $setOnInsert: { itemKey: key, sourceId: source._id, at: now } }, { upsert: true });
  summary.created += 1;
  if (duplicate) summary.possibleDuplicates += 1;
}

/** Fetches one authorized source and stores NEW items as pending_review jobs. Never publishes. */
export async function runImportForSource(db: Db, source: Document, trigger: 'manual' | 'cron'): Promise<{ ok: boolean; summary: RunSummary; error?: string }> {
  const startedAt = new Date();
  const summary: RunSummary = { fetched: 0, created: 0, skippedKnown: 0, skippedInvalid: 0, possibleDuplicates: 0 };
  let error: string | undefined;

  try {
    if (!source.enabled && trigger === 'cron') throw new Error('সোর্সটি বন্ধ আছে।');
    const robots = await checkRobots(String(source.url));
    if (!robots.allowed) throw new Error(robots.reason ?? 'robots.txt অনুমতি দেয়নি।');

    const response = await safeFetchText(String(source.url), {
      maxBytes: 2_000_000,
      timeoutMs: 10_000,
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.1',
    });
    const items = parseFeed(response.text, source.type === 'json' ? 'json' : 'rss').slice(0, MAX_ITEMS_PER_RUN);
    summary.fetched = items.length;
    for (const item of items) await importItem(db, source, item, summary, startedAt);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'অজানা ত্রুটি';
  }

  const finishedAt = new Date();
  const ok = error === undefined;
  await col.importRuns(db).insertOne({ sourceId: source._id, trigger, startedAt, finishedAt, ok, summary, ...(error ? { error } : {}) });
  await col.importSources(db).updateOne({ _id: source._id }, { $set: { lastRunAt: finishedAt, lastRunOk: ok, lastRunSummary: error ? error : summary } });
  return { ok, summary, error };
}

export async function runSourceNow(db: Db, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id);
  const source = await col.importSources(db).findOne({ _id: objectId });
  if (!source) throw new HttpError(404, 'not_found', 'সোর্সটি পাওয়া যায়নি।');
  const limit = await hit(db, `import:run:${String(objectId)}`, 1, MIN_RUN_INTERVAL_SECONDS);
  if (!limit.allowed) {
    throw new HttpError(429, 'rate_limited', `এই সোর্স সম্প্রতি চালানো হয়েছে। প্রায় ${Math.ceil(limit.retryAfterSeconds / 60)} মিনিট পরে আবার চেষ্টা করুন।`);
  }
  const result = await runImportForSource(db, source, 'manual');
  return { ok: result.ok, summary: result.summary, error: result.error };
}

/** Scheduled run (Vercel Cron). Disabled unless CRON_SECRET is configured. */
export function isCronAuthorized(authorization: string | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function runCron(db: Db): Promise<unknown> {
  const sources = await col.importSources(db).find({ enabled: true }).sort({ lastRunAt: 1 }).limit(3).toArray();
  const results: { name: string; ok: boolean; created: number; error?: string }[] = [];
  for (const source of sources) {
    const result = await runImportForSource(db, source, 'cron');
    results.push({ name: String(source.name), ok: result.ok, created: result.summary.created, error: result.error });
  }
  return { ran: results.length, results };
}
