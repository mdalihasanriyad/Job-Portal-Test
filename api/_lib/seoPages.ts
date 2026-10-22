import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ServerResponse } from 'node:http';
import type { Db, Document, Filter } from 'mongodb';
import { col, getDb } from './db.js';
import type { Req } from './http.js';
import {
  LONG_EXPIRED_DAYS, SITE_NAME, SITE_URL, breadcrumbJsonLd, ogImageUrl, daysBetween, escapeHtml, formatDateBn,
  formatNumberBn, injectPage, isHttpUrl, todayISO, type PageMeta,
} from './seoShared.js';

// ---------------------------------------------------------------- helpers

const e = escapeHtml;
const NOT_SPECIFIED = 'উল্লেখ নেই';

type JobState = 'open' | 'expired' | 'no-deadline';

function jobState(job: Document, today: string): JobState {
  if (typeof job.deadline !== 'string' || !job.deadline) return 'no-deadline';
  return job.deadline < today ? 'expired' : 'open';
}

function expiredForDays(job: Document, today: string): number {
  return typeof job.deadline === 'string' && job.deadline < today ? daysBetween(job.deadline, today) : 0;
}

function textBlock(title: string, value: unknown): string {
  const text = typeof value === 'string' && value.trim() ? value.trim() : NOT_SPECIFIED;
  return `<section><h2>${e(title)}</h2><p style="white-space:pre-line">${e(text)}</p></section>`;
}

function breadcrumbHtml(items: { name: string; path?: string }[]): string {
  return `<nav aria-label="ব্রেডক্রাম্ব"><ol style="list-style:none;display:flex;flex-wrap:wrap;gap:.5rem;padding:0">${items
    .map((item) => `<li>${item.path ? `<a href="${e(item.path)}">${e(item.name)}</a>` : e(item.name)}</li>`)
    .join('<li aria-hidden="true">/</li>')}</ol></nav>`;
}

function jobListHtml(jobs: Document[]): string {
  if (jobs.length === 0) return '<p>এখন কোনো বিজ্ঞপ্তি নেই।</p>';
  return `<ul>${jobs
    .map(
      (job) =>
        `<li><a href="/jobs/${e(job.slug)}">${e(job.title)}</a> — ${e(job.organization)} (শেষ তারিখ: ${e(formatDateBn(job.deadline))})</li>`,
    )
    .join('')}</ul>`;
}

const EMPLOYMENT_TYPES: Record<string, string> = {
  স্থায়ী: 'FULL_TIME',
  চুক্তিভিত্তিক: 'CONTRACTOR',
  খণ্ডকালীন: 'PART_TIME',
  অস্থায়ী: 'TEMPORARY',
  'full-time': 'FULL_TIME',
  'part-time': 'PART_TIME',
  contract: 'CONTRACTOR',
  temporary: 'TEMPORARY',
};

// ---------------------------------------------------------------- pages

export function renderNotFound(): PageMeta {
  return {
    status: 404,
    title: `পেজটি পাওয়া যায়নি | ${SITE_NAME}`,
    description: 'আপনি যে পেজটি খুঁজছেন তা পাওয়া যায়নি।',
    path: null,
    robots: 'noindex, nofollow',
    ogType: 'website',
    jsonLd: [],
    bodyHtml: '<div class="container-page"><h1>পেজটি পাওয়া যায়নি</h1><p><a href="/">হোমে ফিরে যান</a></p></div>',
  };
}

/**
 * JobPosting structured data is only emitted when it is accurate and useful:
 * published, still open, with a deadline and a description. Expired jobs never get it.
 * Location is country-level (Bangladesh) because the portal lists Bangladeshi government jobs.
 */
function jobPostingJsonLd(job: Document, path: string): Record<string, unknown> | null {
  const hasContent = [job.description, job.education, job.howToApply].some((value) => typeof value === 'string' && value.trim());
  if (!job.deadline || !hasContent || !job.organization || !job.title || !job.publishedAt) return null;

  const parts: string[] = [];
  if (typeof job.description === 'string' && job.description.trim()) parts.push(`<p>${e(job.description.trim())}</p>`);
  if (typeof job.education === 'string' && job.education.trim()) parts.push(`<p>শিক্ষাগত যোগ্যতা: ${e(job.education.trim())}</p>`);
  if (typeof job.howToApply === 'string' && job.howToApply.trim()) parts.push(`<p>আবেদন পদ্ধতি: ${e(job.howToApply.trim())}</p>`);

  const employmentType = typeof job.employmentType === 'string' ? EMPLOYMENT_TYPES[job.employmentType.trim().toLowerCase()] : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: parts.join(''),
    datePosted: job.publishedAt,
    validThrough: `${job.deadline}T23:59:59+06:00`,
    hiringOrganization: { '@type': 'Organization', name: job.organization },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'BD' } },
    directApply: false,
    url: `${SITE_URL}${path}`,
    ...(employmentType ? { employmentType } : {}),
  };
}

export function renderJobPage(job: Document, today: string): PageMeta {
  const path = `/jobs/${job.slug}`;
  const state = jobState(job, today);
  const expired = state === 'expired';
  const longExpired = expiredForDays(job, today) > LONG_EXPIRED_DAYS;

  const title = `${job.seoTitle || `${job.title} — ${job.organization}`} | ${SITE_NAME}`;
  const description =
    job.metaDescription ||
    `${job.organization}-এর ${job.title}। আবেদনের শেষ তারিখ: ${formatDateBn(job.deadline)}। অফিসিয়াল বিজ্ঞপ্তি যাচাই করে আবেদন করুন।`;

  const crumbs = [
    { name: 'হোম', path: '/' },
    { name: 'সব চাকরি', path: '/jobs' },
    { name: String(job.category), path: `/category/${job.categorySlug}` },
    { name: String(job.title) },
  ];

  const jsonLd: Record<string, unknown>[] = [breadcrumbJsonLd(crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name, path } : c)))];
  if (job.status === 'published' && state === 'open') {
    const posting = jobPostingJsonLd(job, path);
    if (posting) jsonLd.push(posting);
  }

  const positions = Array.isArray(job.positions) ? (job.positions as { name?: string; vacancies?: number }[]) : [];
  const positionsHtml = positions.length
    ? `<ul>${positions.map((p) => `<li>${e(p.name)} — ${e(formatNumberBn(p.vacancies))}</li>`).join('')}</ul>`
    : `<p>${NOT_SPECIFIED}</p>`;

  const image = isHttpUrl(job.featuredImage) ? ogImageUrl(job.featuredImage) : undefined;
  const apply = !expired && isHttpUrl(job.applyUrl) ? `<p><a href="${e(job.applyUrl)}" rel="nofollow noopener noreferrer">অফিসিয়াল আবেদন লিংক</a></p>` : '';
  const source = isHttpUrl(job.sourceUrl) ? `<p><a href="${e(job.sourceUrl)}" rel="nofollow noopener noreferrer">অফিসিয়াল বিজ্ঞপ্তির উৎস</a></p>` : '';

  const bodyHtml = `<div class="container-page" style="padding-top:2rem;padding-bottom:2rem">
${breadcrumbHtml(crumbs)}
<article>
<h1>${e(job.title)}</h1>
<p>${e(job.organization)} · ${e(job.category)}</p>
${expired ? '<p role="alert"><strong>এই বিজ্ঞপ্তির আবেদনের সময় শেষ হয়ে গেছে। এটি বর্তমানে খোলা পদ নয়।</strong></p>' : ''}
<p>প্রকাশের তারিখ: ${e(formatDateBn(job.publishedAt))} · আবেদন শুরু: ${e(formatDateBn(job.applicationStart))} · আবেদনের শেষ তারিখ: ${e(formatDateBn(job.deadline))}</p>
<ul>
<li>পদসংখ্যা: ${e(formatNumberBn(job.totalVacancies))}</li>
<li>চাকরির ধরন: ${e(job.employmentType || NOT_SPECIFIED)}</li>
<li>বেতন বা গ্রেড: ${e(job.salary || NOT_SPECIFIED)}</li>
<li>বয়সসীমা: ${e(job.ageLimit || NOT_SPECIFIED)}</li>
<li>আবেদন ফি: ${e(job.applicationFee || NOT_SPECIFIED)}</li>
</ul>
<section><h2>পদের তালিকা</h2>${positionsHtml}</section>
${textBlock('শিক্ষাগত যোগ্যতা', job.education)}
${textBlock('অভিজ্ঞতা', job.experience)}
${textBlock('বিস্তারিত বিবরণ', job.description)}
${textBlock('আবেদন পদ্ধতি', job.howToApply)}
${apply}${source}
</article>
</div>`;

  return {
    status: 200,
    title,
    description,
    path,
    robots: longExpired ? 'noindex, follow' : 'index, follow',
    ogType: 'article',
    image,
    jsonLd,
    bodyHtml,
  };
}

export function renderCategoryPage(category: Document, jobs: Document[]): PageMeta {
  const path = `/category/${category.slug}`;
  const name = String(category.name);
  const crumbs = [{ name: 'হোম', path: '/' }, { name: 'ক্যাটাগরি', path: '/categories' }, { name: name }];
  return {
    status: 200,
    title: `${name} — সরকারি চাকরি | ${SITE_NAME}`,
    description: String(category.description || `${name} ক্যাটাগরির সরকারি চাকরির বিজ্ঞপ্তি।`),
    path,
    robots: jobs.length === 0 ? 'noindex, follow' : 'index, follow',
    ogType: 'website',
    jsonLd: [breadcrumbJsonLd(crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name, path } : c)))],
    bodyHtml: `<div class="container-page" style="padding-top:2rem">${breadcrumbHtml(crumbs)}<h1>${e(name)} — সরকারি চাকরি</h1><p>${e(category.description ?? '')}</p>${jobListHtml(jobs)}</div>`,
  };
}

export function renderOrganizationPage(org: { slug: string; name: string }, jobs: Document[]): PageMeta {
  const path = `/organization/${org.slug}`;
  const crumbs = [{ name: 'হোম', path: '/' }, { name: 'প্রতিষ্ঠান', path: '/organizations' }, { name: org.name }];
  return {
    status: 200,
    title: `${org.name} — চাকরির বিজ্ঞপ্তি | ${SITE_NAME}`,
    description: `${org.name}-এর প্রকাশিত চাকরির বিজ্ঞপ্তিসমূহ।`,
    path,
    robots: 'index, follow',
    ogType: 'website',
    jsonLd: [breadcrumbJsonLd(crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name, path } : c)))],
    bodyHtml: `<div class="container-page" style="padding-top:2rem">${breadcrumbHtml(crumbs)}<h1>${e(org.name)} — চাকরির বিজ্ঞপ্তি</h1>${jobListHtml(jobs)}</div>`,
  };
}

export type ListView = 'jobs' | 'latest-jobs' | 'closing-soon' | 'expired-jobs' | 'categories' | 'organizations';

const LIST_META: Record<ListView, { title: string; description: string; heading: string; crumb: string }> = {
  jobs: { title: 'সব সরকারি চাকরি', description: 'প্রকাশিত সব সরকারি চাকরির বিজ্ঞপ্তি এক জায়গায়। ক্যাটাগরি, প্রতিষ্ঠান ও তারিখ দিয়ে ফিল্টার করুন; মেয়াদোত্তীর্ণ বিজ্ঞপ্তি আলাদাভাবে চিহ্নিত থাকে।', heading: 'সব সরকারি চাকরি', crumb: 'সব চাকরি' },
  'latest-jobs': { title: 'সর্বশেষ চাকরির বিজ্ঞপ্তি', description: 'সম্প্রতি প্রকাশিত ও এখনো আবেদন চলমান সরকারি চাকরির বিজ্ঞপ্তি।', heading: 'সর্বশেষ চাকরির বিজ্ঞপ্তি', crumb: 'সর্বশেষ বিজ্ঞপ্তি' },
  'closing-soon': { title: 'শেষ তারিখ ঘনিয়ে আসছে', description: 'আগামী ৭ দিনের মধ্যে আবেদনের সময় শেষ হবে — এমন সরকারি চাকরির বিজ্ঞপ্তি।', heading: 'শেষ তারিখ ঘনিয়ে আসছে', crumb: 'শেষ তারিখ ঘনিয়ে আসছে' },
  'expired-jobs': { title: 'মেয়াদোত্তীর্ণ চাকরির বিজ্ঞপ্তি', description: 'যেসব বিজ্ঞপ্তির আবেদনের সময় শেষ হয়ে গেছে। এগুলো বর্তমানে খোলা পদ নয়; শুধু তথ্যের জন্য সংরক্ষিত।', heading: 'মেয়াদোত্তীর্ণ চাকরির বিজ্ঞপ্তি', crumb: 'মেয়াদোত্তীর্ণ বিজ্ঞপ্তি' },
  categories: { title: 'চাকরির ক্যাটাগরি', description: 'ব্যাংক, শিক্ষা, স্বাস্থ্য, প্রকৌশলসহ বিভিন্ন ক্যাটাগরি অনুযায়ী সরকারি চাকরির বিজ্ঞপ্তি দেখুন।', heading: 'চাকরির ক্যাটাগরি', crumb: 'ক্যাটাগরি' },
  organizations: { title: 'সরকারি প্রতিষ্ঠান', description: 'প্রতিষ্ঠান অনুযায়ী সরকারি চাকরির বিজ্ঞপ্তি দেখুন।', heading: 'সরকারি প্রতিষ্ঠান', crumb: 'প্রতিষ্ঠান' },
};

export function renderListPage(view: ListView, data: { jobs?: Document[]; links?: { href: string; label: string }[] }): PageMeta {
  const meta = LIST_META[view];
  const path = `/${view}`;
  const crumbs = [{ name: 'হোম', path: '/' }, { name: meta.crumb }];
  const inner = data.links
    ? `<ul>${data.links.map((link) => `<li><a href="${e(link.href)}">${e(link.label)}</a></li>`).join('')}</ul>`
    : jobListHtml(data.jobs ?? []);
  return {
    status: 200,
    title: `${meta.title} | ${SITE_NAME}`,
    description: meta.description,
    path,
    robots: 'index, follow',
    ogType: 'website',
    jsonLd: [breadcrumbJsonLd(crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name, path } : c)))],
    bodyHtml: `<div class="container-page" style="padding-top:2rem">${breadcrumbHtml(crumbs)}<h1>${e(meta.heading)}</h1><p>${e(meta.description)}</p>${inner}</div>`,
  };
}

// ---------------------------------------------------------------- template

let templateCache: { html: string; at: number; source: 'file' | 'http' } | null = null;
const HTTP_TEMPLATE_TTL_MS = 10 * 60 * 1000;
const ROOT_MARKER = '<div id="root"></div>';

async function readTemplateFile(): Promise<string | null> {
  for (const candidate of [join(process.cwd(), 'dist', 'index.html'), join(process.cwd(), 'index.html')]) {
    try {
      const html = await readFile(candidate, 'utf8');
      // The source index.html loads /src/main.tsx; only the BUILT file is usable.
      if (html.includes(ROOT_MARKER) && !html.includes('/src/main.tsx')) return html;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchTemplate(req: Req): Promise<string | null> {
  const hosts: string[] = [];
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) hosts.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (process.env.VERCEL_URL) hosts.push(`https://${process.env.VERCEL_URL}`);
  const host = String(req.headers.host ?? '');
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) hosts.push(`http://${host}`); // local dev only
  for (const base of hosts) {
    try {
      const response = await fetch(`${base}/index.html`, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) continue;
      const html = await response.text();
      if (html.includes(ROOT_MARKER)) return html;
    } catch {
      /* try next host */
    }
  }
  return null;
}

async function getTemplate(req: Req): Promise<string | null> {
  if (templateCache && (templateCache.source === 'file' || Date.now() - templateCache.at < HTTP_TEMPLATE_TTL_MS)) {
    return templateCache.html;
  }
  const fromFile = await readTemplateFile();
  if (fromFile) {
    templateCache = { html: fromFile, at: Date.now(), source: 'file' };
    return fromFile;
  }
  const fromHttp = await fetchTemplate(req);
  if (fromHttp) templateCache = { html: fromHttp, at: Date.now(), source: 'http' };
  return fromHttp;
}

// ---------------------------------------------------------------- handler

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LIST_VIEWS: ListView[] = ['jobs', 'latest-jobs', 'closing-soon', 'expired-jobs', 'categories', 'organizations'];
const LIST_PROJECTION = { slug: 1, title: 1, organization: 1, deadline: 1 };

function activeClause(today: string): Filter<Document> {
  return { $or: [{ deadline: { $exists: false } }, { deadline: { $gte: today } }] };
}

async function buildPage(db: Db, kind: string, slug: string, view: string): Promise<PageMeta> {
  const today = todayISO();
  const jobs = col.jobs(db);

  if (kind === 'job') {
    if (!SLUG.test(slug) || slug.length > 100) return renderNotFound();
    const job = await jobs.findOne({ slug, status: 'published' });
    return job ? renderJobPage(job, today) : renderNotFound();
  }

  if (kind === 'category') {
    if (!SLUG.test(slug)) return renderNotFound();
    const category = await col.categories(db).findOne({ slug });
    if (!category) return renderNotFound();
    const list = await jobs.find({ status: 'published', categorySlug: slug }, { projection: LIST_PROJECTION }).sort({ publishedAt: -1 }).limit(30).toArray();
    return renderCategoryPage(category, list);
  }

  if (kind === 'organization') {
    if (!SLUG.test(slug)) return renderNotFound();
    const list = await jobs.find({ status: 'published', organizationSlug: slug }, { projection: { ...LIST_PROJECTION, organization: 1 } }).sort({ publishedAt: -1 }).limit(30).toArray();
    if (list.length === 0) return renderNotFound();
    return renderOrganizationPage({ slug, name: String(list[0].organization) }, list);
  }

  if (kind === 'list' && (LIST_VIEWS as string[]).includes(view)) {
    const listView = view as ListView;
    if (listView === 'categories') {
      const categories = await col.categories(db).find({}).sort({ name: 1 }).toArray();
      return renderListPage(listView, { links: categories.map((c) => ({ href: `/category/${c.slug}`, label: String(c.name) })) });
    }
    if (listView === 'organizations') {
      const rows = await jobs
        .aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$organizationSlug', name: { $first: '$organization' }, count: { $sum: 1 } } }, { $sort: { count: -1, name: 1 } }, { $limit: 100 }])
        .toArray();
      return renderListPage(listView, { links: rows.map((r) => ({ href: `/organization/${r._id}`, label: String(r.name) })) });
    }
    let filter: Filter<Document> = { status: 'published' };
    let sort: Document = { publishedAt: -1 };
    if (listView === 'latest-jobs') filter = { $and: [{ status: 'published' }, activeClause(today)] };
    if (listView === 'closing-soon') {
      const limit = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
      filter = { status: 'published', deadline: { $gte: today, $lte: limit } };
      sort = { deadline: 1 };
    }
    if (listView === 'expired-jobs') {
      filter = { status: 'published', deadline: { $lt: today } };
      sort = { deadline: -1 };
    }
    const list = await jobs.find(filter, { projection: LIST_PROJECTION }).sort(sort).limit(30).toArray();
    return renderListPage(listView, { jobs: list });
  }
  return renderNotFound();
}

function sendHtml(res: ServerResponse, status: number, html: string, cache: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(html);
}

/**
 * GET /api/ssr?kind=job|category|organization|list — reached through vercel.json rewrites.
 * Returns the built index.html with page-specific <head> metadata, JSON-LD and a plain HTML
 * content snapshot inside #root. React replaces the snapshot when the app loads.
 * If anything fails, the untouched SPA shell is returned so the site keeps working.
 */
export async function handleSsr(req: Req, res: ServerResponse, url: URL): Promise<void> {
  const template = await getTemplate(req);
  if (!template) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Retry-After', '30');
    res.setHeader('Cache-Control', 'no-store');
    res.end('Service temporarily unavailable');
    return;
  }

  const kind = url.searchParams.get('kind') ?? '';
  const slug = (url.searchParams.get('slug') ?? '').slice(0, 120);
  const view = url.searchParams.get('view') ?? '';
  try {
    const db = await getDb();
    const page = await buildPage(db, kind, slug, view);
    const cache = page.status === 200 ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'public, s-maxage=60';
    sendHtml(res, page.status, injectPage(template, page), cache);
  } catch (error) {
    console.error('[ssr] falling back to SPA shell:', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error');
    sendHtml(res, 200, template, 'no-store');
  }
}
