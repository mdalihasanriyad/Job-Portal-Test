import { createHash } from 'node:crypto';

export interface FeedItem {
  title: string;
  link?: string;
  guid?: string;
  summary?: string;
  /** YYYY-MM-DD (Bangladesh time) when the feed provided a usable date */
  date?: string;
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Plain text from feed markup: drops CDATA wrappers, tags, entities and extra whitespace. */
export function toPlainText(markup: string): string {
  const withoutCdata = markup.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const decodedOnce = decodeEntities(withoutCdata);
  const withoutTags = decodedOnce.replace(/<[^>]*>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

function tagContent(block: string, names: string[]): string | undefined {
  for (const name of names) {
    const escaped = name.replace(/[:.]/g, '\\$&');
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`, 'i'));
    if (match) return match[1];
  }
  return undefined;
}

function atomLink(block: string): string | undefined {
  const links = block.match(/<link\b[^>]*>/gi) ?? [];
  let fallback: string | undefined;
  for (const tag of links) {
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const rel = tag.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!rel || rel === 'alternate') return decodeEntities(href);
    fallback ??= decodeEntities(href);
  }
  return fallback;
}

/** Converts many date formats to YYYY-MM-DD in Bangladesh time; undefined if unusable. */
export function toDhakaDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) return undefined;
  const iso = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  return iso > today ? today : iso; // a feed date in the future is clamped to today
}

export function parseRssAtom(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const pattern = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null && items.length < 200) {
    const block = match[2];
    const title = toPlainText(tagContent(block, ['title']) ?? '');
    if (!title) continue;
    const rssLink = tagContent(block, ['link']);
    const link = (rssLink && !rssLink.trim().startsWith('<') ? toPlainText(rssLink) : undefined) || atomLink(block);
    const guid = tagContent(block, ['guid', 'id']);
    const summary = tagContent(block, ['description', 'summary', 'content:encoded', 'content']);
    const date = tagContent(block, ['pubDate', 'published', 'updated', 'dc:date']);
    items.push({
      title,
      link: link || undefined,
      guid: guid ? toPlainText(guid) : undefined,
      summary: summary ? toPlainText(summary) : undefined,
      date: toDhakaDate(date ? toPlainText(date) : undefined),
    });
  }
  return items;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

export function parseJsonFeed(text: string): FeedItem[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON পড়া যায়নি।');
  }
  const root = data as Record<string, unknown>;
  const list = Array.isArray(data) ? data : [root.items, root.entries, root.jobs, root.data].find(Array.isArray);
  if (!Array.isArray(list)) throw new Error('JSON-এ আইটেমের তালিকা পাওয়া যায়নি।');
  const items: FeedItem[] = [];
  for (const entry of list.slice(0, 200)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const obj = entry as Record<string, unknown>;
    const title = pickString(obj, ['title', 'name', 'headline']);
    if (!title) continue;
    items.push({
      title: toPlainText(title),
      link: pickString(obj, ['url', 'link', 'external_url']),
      guid: pickString(obj, ['id', 'guid']),
      summary: toPlainText(pickString(obj, ['summary', 'description', 'content_text', 'content_html']) ?? '') || undefined,
      date: toDhakaDate(pickString(obj, ['date_published', 'published', 'pubDate', 'date', 'created_at'])),
    });
  }
  return items;
}

export function parseFeed(text: string, type: 'rss' | 'json'): FeedItem[] {
  if (type === 'json') return parseJsonFeed(text);
  if (!/<(rss|feed|rdf:RDF)\b/i.test(text)) throw new Error('এটি বৈধ RSS/Atom ফিড নয়।');
  return parseRssAtom(text);
}

// ---------------------------------------------------------------- duplicate detection

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|igshid$)/i;

/** Normalised URL for comparison: lower-case host, no fragment/tracking params, no trailing slash. */
export function normalizeUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '') || '';
    const query = url.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ''}`;
  } catch {
    return undefined;
  }
}

export function titleTokens(title: string): string[] {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

/** Jaccard similarity of title word sets (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const left = new Set(titleTokens(a));
  const right = new Set(titleTokens(b));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

export interface DuplicateCandidate {
  id: unknown;
  slug: string;
  title: string;
  sourceUrlKey?: string;
}

export const SIMILARITY_THRESHOLD = 0.75;

export function findPossibleDuplicate(
  item: { title: string; urlKey?: string },
  existing: DuplicateCandidate[],
): { match: DuplicateCandidate; score: number; reason: 'same-source-url' | 'similar-title' } | null {
  let best: { match: DuplicateCandidate; score: number; reason: 'same-source-url' | 'similar-title' } | null = null;
  for (const candidate of existing) {
    if (item.urlKey && candidate.sourceUrlKey && item.urlKey === candidate.sourceUrlKey) {
      return { match: candidate, score: 1, reason: 'same-source-url' };
    }
    const score = titleSimilarity(item.title, candidate.title);
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) best = { match: candidate, score, reason: 'similar-title' };
  }
  return best;
}

export function itemKey(sourceId: string, item: FeedItem): string {
  return createHash('sha1').update(`${sourceId}|${item.guid || item.link || item.title}`).digest('hex');
}

/** Strips tracking parameters and fragments but keeps the link usable. */
export function cleanLink(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
    const href = url.href;
    return href.length <= 2000 ? href : undefined;
  } catch {
    return undefined;
  }
}
