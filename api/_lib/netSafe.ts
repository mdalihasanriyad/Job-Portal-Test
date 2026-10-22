import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { request } from 'node:https';

/**
 * Safe outbound fetching for admin-configured URLs (job import sources).
 * Protects against SSRF: HTTPS only, port 443 only, no credentials in the URL, every DNS
 * result (and every redirect hop) must be a public address, bounded size and time.
 */

export const IMPORT_USER_AGENT = 'GovtJobBD-Importer/1.0 (+https://govtjob.bd)';

export class FetchError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** True for loopback, private, link-local, multicast, reserved and unparsable addresses. */
export function isPrivateAddress(address: string): boolean {
  let ip = address.trim().toLowerCase();
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);

  const family = isIP(ip);
  if (family === 4) return isPrivateV4(ip);
  if (family === 6) {
    if (ip === '::' || ip === '::1') return true;
    const mappedDotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedDotted) return isPrivateV4(mappedDotted[1]);
    const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return isPrivateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    const first = parseInt(ip.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
    if ((first & 0xff00) === 0xff00) return true; // multicast
    return false;
  }
  return true; // not an IP address: treat as unsafe
}

export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError('URL সঠিক নয়।');
  }
  if (url.protocol !== 'https:') throw new FetchError('শুধু https URL অনুমোদিত।');
  if (url.username || url.password) throw new FetchError('URL-এ ইউজারনেম/পাসওয়ার্ড থাকতে পারবে না।');
  if (url.port && url.port !== '443') throw new FetchError('শুধু স্ট্যান্ডার্ড পোর্ট (443) অনুমোদিত।');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) !== 0) {
    if (isPrivateAddress(host)) throw new FetchError('এই ঠিকানায় সংযোগ অনুমোদিত নয়।');
  } else if (!host.includes('.') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new FetchError('এই হোস্ট অনুমোদিত নয়।');
  }
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void;

/** DNS lookup that refuses to resolve to private addresses (also defeats DNS rebinding). */
function guardedLookup(hostname: string, options: { all?: boolean } | undefined, callback: LookupCallback): void {
  lookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, '');
    const list = addresses as { address: string; family: number }[];
    if (list.length === 0 || list.some((entry) => isPrivateAddress(entry.address))) {
      return callback(new FetchError('এই ঠিকানায় সংযোগ অনুমোদিত নয়।') as NodeJS.ErrnoException, '');
    }
    if (options?.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  });
}

interface RawResponse {
  status: number;
  location?: string;
  contentType: string;
  body: Buffer;
}

function requestOnce(url: URL, maxBytes: number, timeoutMs: number, accept: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        protocol: 'https:',
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { 'User-Agent': IMPORT_USER_AGENT, Accept: accept, 'Accept-Encoding': 'identity' },
        lookup: guardedLookup as unknown as undefined,
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers['content-type'] ?? '');
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, location: res.headers.location, contentType, body: Buffer.alloc(0) });
          return;
        }
        const declared = Number(res.headers['content-length'] ?? 0);
        if (declared > maxBytes) {
          req.destroy(new FetchError('প্রতিক্রিয়া অনেক বড়।'));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy(new FetchError('প্রতিক্রিয়া অনেক বড়।'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ status, contentType, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new FetchError('সময় শেষ হয়ে গেছে।')));
    req.on('error', reject);
    req.end();
  });
}

export interface FetchResult {
  text: string;
  finalUrl: string;
  contentType: string;
}

export async function safeFetchText(
  rawUrl: string,
  options: { maxBytes?: number; timeoutMs?: number; accept?: string; maxRedirects?: number } = {},
): Promise<FetchResult> {
  const maxBytes = options.maxBytes ?? 2_000_000;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const accept = options.accept ?? '*/*';
  const maxRedirects = options.maxRedirects ?? 3;

  let url = assertPublicHttpsUrl(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const response = await requestOnce(url, maxBytes, timeoutMs, accept);
    if (response.status >= 300 && response.status < 400 && response.location) {
      url = assertPublicHttpsUrl(new URL(response.location, url).href); // re-validated on every hop
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new FetchError(`সার্ভার HTTP ${response.status} দিয়েছে।`, response.status);
    return { text: response.body.toString('utf8'), finalUrl: url.href, contentType: response.contentType };
  }
  throw new FetchError('অনেকবার রিডাইরেক্ট হয়েছে।');
}
