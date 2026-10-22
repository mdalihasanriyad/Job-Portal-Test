import type { IncomingMessage, ServerResponse } from 'node:http';

export type Req = IncomingMessage & { body?: unknown };

export class HttpError extends Error {
  status: number;
  code: string;
  details?: Record<string, string>;
  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex'); // API responses must never be indexed
  res.setHeader('Content-Length', Buffer.byteLength(payload));
  res.end(payload);
}

export function getIp(req: Req): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return (first || req.socket.remoteAddress || 'unknown').slice(0, 64);
}

export function isHttps(req: Req): boolean {
  const proto = req.headers['x-forwarded-proto'];
  return (Array.isArray(proto) ? proto[0] : proto)?.split(',')[0]?.trim() === 'https';
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}

const MAX_BODY_BYTES = 1_000_000;

/** Works both on Vercel (body pre-parsed) and in the Vite dev middleware (raw stream). */
export async function readJsonBody(req: Req): Promise<unknown> {
  const contentType = String(req.headers['content-type'] ?? '');
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'অনুরোধের ধরন সঠিক নয়।');
  }
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return parseJson(req.body);
    if (Buffer.isBuffer(req.body)) return parseJson(req.body.toString('utf8'));
    return req.body;
  }
  if (req.readableEnded) throw new HttpError(400, 'empty_body', 'অনুরোধে কোনো তথ্য নেই।');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large', 'অনুরোধের আকার অনেক বড়।');
    chunks.push(buffer);
  }
  return parseJson(Buffer.concat(chunks).toString('utf8'));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json', 'অনুরোধের তথ্য সঠিক JSON নয়।');
  }
}

/**
 * CSRF defence for state-changing requests: the session cookie is SameSite=Strict, and we
 * additionally require a same-origin Origin header (or Sec-Fetch-Site) plus a custom header.
 */
export function assertSameOrigin(req: Req): void {
  const method = req.method ?? 'GET';
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  if (req.headers['x-requested-with'] !== 'fetch') {
    throw new HttpError(403, 'csrf', 'অনুরোধটি নিরাপত্তা যাচাইয়ে ব্যর্থ হয়েছে।');
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      /* fall through */
    }
    if (!host || originHost !== host) {
      throw new HttpError(403, 'csrf', 'অনুরোধটি নিরাপত্তা যাচাইয়ে ব্যর্থ হয়েছে।');
    }
    return;
  }
  if (req.headers['sec-fetch-site'] !== 'same-origin') {
    throw new HttpError(403, 'csrf', 'অনুরোধটি নিরাপত্তা যাচাইয়ে ব্যর্থ হয়েছে।');
  }
}
