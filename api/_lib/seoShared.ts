export const SITE_URL = 'https://govtjob.bd';
export const SITE_NAME = 'GovtJob.bd';
export const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;
/** Jobs expired for longer than this are marked noindex and left out of the sitemap. */
export const LONG_EXPIRED_DAYS = 180;

export interface PageMeta {
  status: number;
  title: string;
  description: string;
  /** Canonical path (e.g. "/jobs/my-job"); null for pages that should have no canonical (404). */
  path: string | null;
  robots: 'index, follow' | 'noindex, follow' | 'noindex, nofollow';
  ogType: 'website' | 'article';
  image?: string;
  jsonLd: Record<string, unknown>[];
  bodyHtml: string;
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] === '&#39;' ? '&apos;' : HTML_ESCAPES[char] ?? char);
}

const dateFormatter = new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' });
const numberFormatter = new Intl.NumberFormat('bn-BD');

export function formatDateBn(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return 'উল্লেখ নেই';
  const date = new Date(`${iso}T00:00:00+06:00`);
  return Number.isNaN(date.getTime()) ? 'উল্লেখ নেই' : dateFormatter.format(date);
}

export function formatNumberBn(value: unknown): string {
  return typeof value === 'number' ? numberFormatter.format(value) : 'উল্লেখ নেই';
}

export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** Social-preview image: Cloudinary images get a 1200x630 JPEG crop; other URLs are used as they are. */
export function ogImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const marker = '/image/upload/';
    const index = parsed.pathname.indexOf(marker);
    if (parsed.hostname !== 'res.cloudinary.com' || index === -1) return url;
    const rest = parsed.pathname.slice(index + marker.length);
    if (!/^v\d+\//.test(rest)) return url;
    parsed.pathname = `${parsed.pathname.slice(0, index + marker.length)}f_jpg,q_auto,w_1200,h_630,c_fill,g_auto/${rest}`;
    return parsed.href;
  } catch {
    return url;
  }
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** JSON for a <script type="application/ld+json"> block; "<" is escaped so "</script>" cannot break out. */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function breadcrumbJsonLd(items: { name: string; path?: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: `${SITE_URL}${item.path}` } : {}),
    })),
  };
}

/** Replaces head metadata and the empty #root of the built index.html with page-specific content. */
export function injectPage(template: string, page: PageMeta): string {
  const canonical = page.path === null ? null : `${SITE_URL}${page.path}`;
  const title = `${page.title}`;
  const image = page.image ?? DEFAULT_IMAGE;
  const tags: string[] = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<meta name="robots" content="${page.robots}" />`,
  ];
  if (canonical) tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  tags.push(
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="bn_BD" />`,
    `<meta property="og:type" content="${page.ogType}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  );
  if (canonical) tags.push(`<meta property="og:url" content="${escapeHtml(canonical)}" />`);
  for (const block of page.jsonLd) {
    tags.push(`<script type="application/ld+json" data-ssr="${escapeHtml(page.path ?? '')}">${safeJsonLd(block)}</script>`);
  }

  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>\s*/i, '');
  html = html.replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]*|twitter:[^"]*)"[^>]*>\s*/gi, '');
  html = html.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
  html = html.replace('</head>', () => `    ${tags.join('\n    ')}\n  </head>`);
  html = html.replace('<div id="root"></div>', () => `<div id="root">${page.bodyHtml}</div>`);
  return html;
}
