import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { col } from './db.js';
import { HttpError } from './http.js';
import { isValidIsoDate } from './validate.js';

const CLOSING_SOON_DAYS = 7;

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
}

function addDaysISO(days: number): string {
  const base = Date.parse(`${todayISO()}T00:00:00Z`) + days * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const number = Number.parseInt(value ?? '', 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

const LIST_PROJECTION = {
  slug: 1, title: 1, organization: 1, organizationSlug: 1, category: 1, categorySlug: 1,
  positions: 1, totalVacancies: 1, employmentType: 1, applicationStart: 1, deadline: 1,
  publishedAt: 1, verifiedAt: 1, verified: 1, featured: 1, status: 1,
};

const LIST_FIELDS = Object.keys(LIST_PROJECTION);

/** Whitelist (not just a DB projection): internal fields such as import metadata can never leak. */
function toPublicList(doc: Document): Record<string, unknown> {
  const out: Record<string, unknown> = { id: String(doc._id) };
  for (const key of LIST_FIELDS) if (doc[key] !== undefined) out[key] = doc[key];
  return out;
}

const DETAIL_FIELDS = [
  'slug', 'title', 'organization', 'organizationSlug', 'category', 'categorySlug', 'positions',
  'totalVacancies', 'employmentType', 'education', 'experience', 'ageLimit', 'salary', 'applicationFee',
  'applicationStart', 'deadline', 'publishedAt', 'verifiedAt', 'verified', 'featured', 'status',
  'applyUrl', 'sourceUrl', 'circularRef', 'description', 'howToApply', 'seoTitle', 'metaDescription', 'featuredImage',
];

function toPublicDetail(doc: Document): Record<string, unknown> {
  const out: Record<string, unknown> = { id: String(doc._id) };
  for (const key of DETAIL_FIELDS) if (doc[key] !== undefined) out[key] = doc[key];
  return out;
}

const activeClause = (): Filter<Document> => ({
  $or: [{ deadline: { $exists: false } }, { deadline: { $gte: todayISO() } }],
});

function dateParam(params: URLSearchParams, key: string): string | undefined {
  const value = (params.get(key) ?? '').trim();
  return value && isValidIsoDate(value) ? value : undefined;
}

/** Builds the filter + sort for public job lists. Only published jobs are ever returned. */
function buildListQuery(params: URLSearchParams): { filter: Filter<Document>; sort: Document } {
  const and: Filter<Document>[] = [{ status: 'published' }];
  const scope = params.get('scope') ?? 'all';
  const today = todayISO();
  let sort: Document = { publishedAt: -1, _id: -1 };

  if (scope === 'latest') and.push(activeClause());
  else if (scope === 'featured') and.push({ featured: true }, activeClause());
  else if (scope === 'closing-soon') {
    and.push({ deadline: { $gte: today, $lte: addDaysISO(CLOSING_SOON_DAYS) } });
    sort = { deadline: 1, _id: 1 };
  } else if (scope === 'expired') {
    and.push({ deadline: { $lt: today } });
    sort = { deadline: -1, _id: -1 };
  } else {
    const state = params.get('state');
    if (state === 'active') and.push(activeClause());
    else if (state === 'expired') and.push({ deadline: { $lt: today } });
  }

  const category = (params.get('category') ?? '').trim().slice(0, 60);
  if (category) and.push({ categorySlug: category });
  const organization = (params.get('org') ?? '').trim().slice(0, 100);
  if (organization) and.push({ organizationSlug: organization });

  const pubFrom = dateParam(params, 'pubFrom');
  const pubTo = dateParam(params, 'pubTo');
  if (pubFrom) and.push({ publishedAt: { $gte: pubFrom } });
  if (pubTo) and.push({ publishedAt: { $lte: pubTo } });
  const dlFrom = dateParam(params, 'dlFrom');
  const dlTo = dateParam(params, 'dlTo');
  if (dlFrom) and.push({ deadline: { $gte: dlFrom } });
  if (dlTo) and.push({ deadline: { $lte: dlTo } });

  const terms = (params.get('q') ?? '')
    .split(/\s+/)
    .map((term) => term.trim().slice(0, 50))
    .filter(Boolean)
    .slice(0, 5);
  for (const term of terms) {
    const pattern = new RegExp(escapeRegex(term), 'i');
    and.push({ $or: [{ title: pattern }, { organization: pattern }, { category: pattern }, { 'positions.name': pattern }] });
  }
  return { filter: { $and: and }, sort };
}

export async function listPublicJobs(db: Db, url: URL): Promise<unknown> {
  const page = intParam(url.searchParams.get('page'), 1, 1, 100_000);
  const pageSize = intParam(url.searchParams.get('pageSize'), 12, 3, 30);
  const { filter, sort } = buildListQuery(url.searchParams);
  const jobs = col.jobs(db);
  const [total, docs] = await Promise.all([
    jobs.countDocuments(filter),
    jobs.find(filter, { projection: LIST_PROJECTION }).sort(sort).skip((page - 1) * pageSize).limit(pageSize).toArray(),
  ]);
  return { items: docs.map(toPublicList), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getPublicJob(db: Db, slug: string): Promise<unknown> {
  const jobs = col.jobs(db);
  const doc = await jobs.findOne({ slug, status: 'published' });
  if (!doc) throw new HttpError(404, 'not_found', 'চাকরিটি পাওয়া যায়নি।');
  const related = await jobs
    .find(
      { $and: [{ status: 'published' }, { _id: { $ne: doc._id } }, activeClause(), { $or: [{ categorySlug: doc.categorySlug }, { organizationSlug: doc.organizationSlug }] }] },
      { projection: LIST_PROJECTION },
    )
    .sort({ publishedAt: -1, _id: -1 })
    .limit(3)
    .toArray();
  return { job: toPublicDetail(doc), related: related.map(toPublicList) };
}

export async function listPublicCategories(db: Db): Promise<{ categories: Record<string, unknown>[] }> {
  const [categories, counts] = await Promise.all([
    col.categories(db).find({}).sort({ name: 1 }).toArray(),
    col.jobs(db).aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$categorySlug', count: { $sum: 1 } } }]).toArray(),
  ]);
  const countMap = new Map(counts.map((item) => [String(item._id), Number(item.count)]));
  return {
    categories: categories.map((category) => ({
      slug: String(category.slug),
      name: String(category.name),
      description: String(category.description ?? ''),
      count: countMap.get(String(category.slug)) ?? 0,
    })),
  };
}

export async function listPublicOrganizations(db: Db): Promise<{ organizations: Record<string, unknown>[] }> {
  const rows = await col.jobs(db)
    .aggregate([
      { $match: { status: 'published' } },
      { $sort: { publishedAt: -1 } },
      { $group: { _id: '$organizationSlug', name: { $first: '$organization' }, count: { $sum: 1 } } },
      { $sort: { count: -1, name: 1 } },
      { $limit: 500 },
    ])
    .toArray();
  return { organizations: rows.map((row) => ({ slug: String(row._id), name: String(row.name), count: Number(row.count) })) };
}

export async function getHome(db: Db): Promise<unknown> {
  const jobs = col.jobs(db);
  const run = async (scope: string, limit: number) => {
    const params = new URLSearchParams({ scope });
    const { filter, sort } = buildListQuery(params);
    const docs = await jobs.find(filter, { projection: LIST_PROJECTION }).sort(sort).limit(limit).toArray();
    return docs.map(toPublicList);
  };
  const [latest, featured, closingSoon, categories, organizations] = await Promise.all([
    run('latest', 6),
    run('featured', 3),
    run('closing-soon', 3),
    listPublicCategories(db),
    listPublicOrganizations(db),
  ]);
  return { latest, featured, closingSoon, categories: categories.categories, organizations: organizations.organizations.slice(0, 4) };
}

export async function findPublishedJobBySlug(db: Db, slug: string): Promise<{ _id: ObjectId; title: string; slug: string }> {
  const doc = await col.jobs(db).findOne({ slug, status: 'published' }, { projection: { title: 1, slug: 1 } });
  if (!doc) throw new HttpError(404, 'not_found', 'চাকরিটি পাওয়া যায়নি।');
  return { _id: doc._id as ObjectId, title: String(doc.title), slug: String(doc.slug) };
}
