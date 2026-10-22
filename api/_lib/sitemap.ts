import type { ServerResponse } from 'node:http';
import { col, getDb } from './db.js';
import type { Req } from './http.js';
import { LONG_EXPIRED_DAYS, SITE_URL, escapeXml, todayISO } from './seoShared.js';

export interface SitemapEntry {
  path: string;
  lastmod?: string; // YYYY-MM-DD
}

export const STATIC_PATHS = [
  '/', '/jobs', '/latest-jobs', '/closing-soon', '/expired-jobs', '/categories', '/organizations',
  '/about', '/contact', '/privacy-policy', '/terms', '/disclaimer',
];

const MAX_URLS = 50_000;

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .slice(0, MAX_URLS)
    .map((entry) => `  <url>\n    <loc>${escapeXml(`${SITE_URL}${entry.path === '/' ? '/' : entry.path}`)}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function dateOnly(value: unknown): string | undefined {
  return value instanceof Date ? value.toISOString().slice(0, 10) : undefined;
}

/** Cutoff date: jobs whose deadline is before this are "long expired" and excluded. */
export function longExpiredCutoff(today: string): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - LONG_EXPIRED_DAYS * 86_400_000).toISOString().slice(0, 10);
}

export async function handleSitemap(_req: Req, res: ServerResponse): Promise<void> {
  try {
    const db = await getDb();
    const today = todayISO();
    const cutoff = longExpiredCutoff(today);
    const jobs = col.jobs(db);

    const [jobDocs, categoryRows, orgRows] = await Promise.all([
      jobs
        .find(
          { status: 'published', $or: [{ deadline: { $exists: false } }, { deadline: { $gte: cutoff } }] },
          { projection: { slug: 1, updatedAt: 1 } },
        )
        .sort({ publishedAt: -1 })
        .limit(45_000)
        .toArray(),
      jobs.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$categorySlug', lastmod: { $max: '$updatedAt' } } }]).toArray(),
      jobs.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$organizationSlug', lastmod: { $max: '$updatedAt' } } }, { $limit: 2000 }]).toArray(),
    ]);

    const entries: SitemapEntry[] = [
      ...STATIC_PATHS.map((path) => ({ path })),
      ...categoryRows.map((row) => ({ path: `/category/${row._id}`, lastmod: dateOnly(row.lastmod) })),
      ...orgRows.map((row) => ({ path: `/organization/${row._id}`, lastmod: dateOnly(row.lastmod) })),
      ...jobDocs.map((doc) => ({ path: `/jobs/${doc.slug}`, lastmod: dateOnly(doc.updatedAt) })),
    ];

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.end(buildSitemapXml(entries));
  } catch (error) {
    console.error('[sitemap] failed:', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error');
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '60');
    res.end('Sitemap temporarily unavailable');
  }
}
