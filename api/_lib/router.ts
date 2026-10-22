import type { ServerResponse } from 'node:http';
import type { Db } from 'mongodb';
import { col, getDb } from './db.js';
import { HttpError, assertSameOrigin, getIp, readJsonBody, sendJson, type Req } from './http.js';
import { createSession, destroySession, getSessionAdmin, requireAdmin } from './auth.js';
import { verifyPassword } from './password.js';
import { hit, reset } from './rateLimit.js';
import {
  adminDeleteComment, adminDeleteMessage, adminListComments, adminListMessages, adminSetCommentStatus,
  adminSetMessageStatus, adminUpdateComment, createComment, createContactMessage, listApprovedComments,
} from './engagement.js';
import { recordView } from './analytics.js';
import { aiConfig } from './aiProvider.js';
import { createCategory, deleteCategory, listAdminCategories, updateCategory } from './categoriesService.js';
import { createSource, deleteSource, isCronAuthorized, listRuns, listSources, runCron, runSourceNow, updateSource } from './importService.js';
import { signUpload, uploadsEnabled } from './uploads.js';
import { createScript, generateScriptWithAi, deleteScript, getScript, listScripts, refreshPrompt, updateScript } from './scriptsService.js';
import { handleSitemap } from './sitemap.js';
import { handleSsr } from './seoPages.js';
import { getHome, getPublicJob, listPublicCategories, listPublicJobs, listPublicOrganizations } from './publicService.js';
import { clearDuplicateFlag, createJob, deleteJob, getJob, getStats, listJobs, setJobStatus, updateJob } from './jobsService.js';

const LOGIN_WINDOW_SECONDS = 15 * 60;

function methodNotAllowed(res: ServerResponse, allowed: string[]): never {
  res.setHeader('Allow', allowed.join(', '));
  throw new HttpError(405, 'method_not_allowed', 'এই পদ্ধতি অনুমোদিত নয়।');
}

async function handleLogin(db: Db, req: Req, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password || password.length > 200) {
    throw new HttpError(400, 'invalid_credentials', 'ইমেইল ও পাসওয়ার্ড দিন।');
  }

  const ip = getIp(req);
  const pairKey = `login:pair:${ip}:${email}`;
  const ipKey = `login:ip:${ip}`;
  const [pair, byIp] = await Promise.all([
    hit(db, pairKey, 5, LOGIN_WINDOW_SECONDS),
    hit(db, ipKey, 20, LOGIN_WINDOW_SECONDS),
  ]);
  if (!pair.allowed || !byIp.allowed) {
    const wait = Math.max(pair.allowed ? 0 : pair.retryAfterSeconds, byIp.allowed ? 0 : byIp.retryAfterSeconds);
    res.setHeader('Retry-After', String(wait));
    throw new HttpError(429, 'rate_limited', `অনেকবার ভুল চেষ্টা করা হয়েছে। প্রায় ${Math.ceil(wait / 60)} মিনিট পরে আবার চেষ্টা করুন।`);
  }

  const admin = await col.admins(db).findOne({ email });
  const valid = await verifyPassword(password, admin ? String(admin.passwordHash) : undefined);
  if (!admin || !valid) {
    throw new HttpError(401, 'invalid_credentials', 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।');
  }

  await reset(db, pairKey);
  await createSession(db, req, res, admin._id);
  await col.admins(db).updateOne({ _id: admin._id }, { $set: { lastLoginAt: new Date() } });
  sendJson(res, 200, { user: { id: String(admin._id), email: String(admin.email), name: admin.name ? String(admin.name) : undefined } });
}

async function handleAdmin(db: Db, req: Req, res: ServerResponse, segments: string[], url: URL): Promise<void> {
  // Authorization first, on the server, for every admin route.
  const admin = await requireAdmin(db, req);
  const method = req.method ?? 'GET';
  const [, resource, id, action] = segments;

  if (resource === 'stats' && !id) {
    if (method !== 'GET') methodNotAllowed(res, ['GET']);
    return sendJson(res, 200, await getStats(db));
  }
  if (resource === 'categories') {
    if (!id) {
      if (method === 'GET') return sendJson(res, 200, await listAdminCategories(db));
      if (method === 'POST') {
        const result = await createCategory(db, req);
        return sendJson(res, result.status, result.body);
      }
      methodNotAllowed(res, ['GET', 'POST']);
    }
    if (!action) {
      if (method === 'PUT') return sendJson(res, 200, await updateCategory(db, req, id));
      if (method === 'DELETE') return sendJson(res, 200, await deleteCategory(db, id));
      methodNotAllowed(res, ['PUT', 'DELETE']);
    }
  }
  if (resource === 'features' && !id) {
    if (method !== 'GET') methodNotAllowed(res, ['GET']);
    const ai = aiConfig();
    return sendJson(res, 200, { uploads: uploadsEnabled(), ai: { enabled: ai.enabled, model: ai.model } });
  }
  if (resource === 'uploads' && id === 'sign' && !action) {
    if (method !== 'POST') methodNotAllowed(res, ['POST']);
    const limit = await hit(db, `upload:sign:${admin.id}`, 40, 3600);
    if (!limit.allowed) throw new HttpError(429, 'rate_limited', 'অনেক বেশি আপলোড অনুরোধ। কিছুক্ষণ পরে চেষ্টা করুন।');
    const body = (await readJsonBody(req)) as { kind?: unknown } | null;
    return sendJson(res, 200, signUpload(body?.kind));
  }
  if (resource === 'import-sources') {
    if (!id) {
      if (method === 'GET') return sendJson(res, 200, await listSources(db));
      if (method === 'POST') {
        const result = await createSource(db, req);
        return sendJson(res, result.status, result.body);
      }
      methodNotAllowed(res, ['GET', 'POST']);
    }
    if (!action) {
      if (method === 'PUT') return sendJson(res, 200, await updateSource(db, req, id));
      if (method === 'DELETE') return sendJson(res, 200, await deleteSource(db, id));
      methodNotAllowed(res, ['PUT', 'DELETE']);
    }
    if (action === 'run') {
      if (method !== 'POST') methodNotAllowed(res, ['POST']);
      return sendJson(res, 200, await runSourceNow(db, id));
    }
    if (action === 'runs') {
      if (method !== 'GET') methodNotAllowed(res, ['GET']);
      return sendJson(res, 200, await listRuns(db, id));
    }
  }
  if (resource === 'jobs') {
    if (!id) {
      if (method === 'GET') return sendJson(res, 200, await listJobs(db, url));
      if (method === 'POST') {
        const result = await createJob(db, req, admin.id);
        return sendJson(res, result.status, result.body);
      }
      methodNotAllowed(res, ['GET', 'POST']);
    }
    if (!action) {
      if (method === 'GET') return sendJson(res, 200, await getJob(db, id));
      if (method === 'PUT') return sendJson(res, 200, await updateJob(db, req, id));
      if (method === 'DELETE') return sendJson(res, 200, await deleteJob(db, id));
      methodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
    }
    if (action === 'status') {
      if (method !== 'POST') methodNotAllowed(res, ['POST']);
      return sendJson(res, 200, await setJobStatus(db, req, id));
    }
    if (action === 'clear-duplicate') {
      if (method !== 'POST') methodNotAllowed(res, ['POST']);
      return sendJson(res, 200, await clearDuplicateFlag(db, id));
    }
  }
  if (resource === 'scripts') {
    if (!id) {
      if (method === 'GET') return sendJson(res, 200, await listScripts(db, url));
      if (method === 'POST') {
        const result = await createScript(db, req);
        return sendJson(res, result.status, result.body);
      }
      methodNotAllowed(res, ['GET', 'POST']);
    }
    if (!action) {
      if (method === 'GET') return sendJson(res, 200, await getScript(db, id));
      if (method === 'PUT') return sendJson(res, 200, await updateScript(db, req, id));
      if (method === 'DELETE') return sendJson(res, 200, await deleteScript(db, id));
      methodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
    }
    if (action === 'generate') {
      if (method !== 'POST') methodNotAllowed(res, ['POST']);
      return sendJson(res, 200, await generateScriptWithAi(db, req, id));
    }
    if (action === 'refresh-prompt') {
      if (method !== 'POST') methodNotAllowed(res, ['POST']);
      return sendJson(res, 200, await refreshPrompt(db, id));
    }
  }
  if (resource === 'comments') {
    if (!id) {
      if (method !== 'GET') methodNotAllowed(res, ['GET']);
      return sendJson(res, 200, await adminListComments(db, url));
    }
    if (!action) {
      if (method === 'PUT') return sendJson(res, 200, await adminUpdateComment(db, req, id));
      if (method === 'DELETE') return sendJson(res, 200, await adminDeleteComment(db, id));
      methodNotAllowed(res, ['PUT', 'DELETE']);
    }
    if (action === 'status') {
      if (method !== 'POST') methodNotAllowed(res, ['POST']);
      return sendJson(res, 200, await adminSetCommentStatus(db, req, id));
    }
  }
  if (resource === 'messages') {
    if (!id) {
      if (method !== 'GET') methodNotAllowed(res, ['GET']);
      return sendJson(res, 200, await adminListMessages(db, url));
    }
    if (!action) {
      if (method !== 'DELETE') methodNotAllowed(res, ['DELETE']);
      return sendJson(res, 200, await adminDeleteMessage(db, id));
    }
    if (action === 'status') {
      if (method !== 'POST') methodNotAllowed(res, ['POST']);
      return sendJson(res, 200, await adminSetMessageStatus(db, req, id));
    }
  }
  throw new HttpError(404, 'not_found', 'অনুরোধকৃত রিসোর্স পাওয়া যায়নি।');
}

const PUBLIC_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';

async function handlePublic(db: Db, req: Req, res: ServerResponse, segments: string[], url: URL): Promise<void> {
  const method = req.method ?? 'GET';
  const [, resource, slug, sub] = segments;
  const cacheable = () => res.setHeader('Cache-Control', PUBLIC_CACHE);

  if (resource === 'home' && !slug) {
    if (method !== 'GET') methodNotAllowed(res, ['GET']);
    cacheable();
    return sendJson(res, 200, await getHome(db));
  }
  if (resource === 'categories' && !slug) {
    if (method !== 'GET') methodNotAllowed(res, ['GET']);
    cacheable();
    return sendJson(res, 200, await listPublicCategories(db));
  }
  if (resource === 'organizations' && !slug) {
    if (method !== 'GET') methodNotAllowed(res, ['GET']);
    cacheable();
    return sendJson(res, 200, await listPublicOrganizations(db));
  }
  if (resource === 'contact' && !slug) {
    if (method !== 'POST') methodNotAllowed(res, ['POST']);
    return sendJson(res, 201, await createContactMessage(db, req));
  }
  if (resource === 'jobs') {
    if (!slug) {
      if (method !== 'GET') methodNotAllowed(res, ['GET']);
      cacheable();
      return sendJson(res, 200, await listPublicJobs(db, url));
    }
    if (!sub) {
      if (method !== 'GET') methodNotAllowed(res, ['GET']);
      cacheable();
      return sendJson(res, 200, await getPublicJob(db, slug));
    }
    if (sub === 'view') {
      if (method !== 'POST') methodNotAllowed(res, ['POST']);
      await recordView(db, req, slug);
      return sendJson(res, 200, { ok: true });
    }
    if (sub === 'comments') {
      if (method === 'GET') {
        res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
        return sendJson(res, 200, await listApprovedComments(db, slug));
      }
      if (method === 'POST') return sendJson(res, 201, await createComment(db, req, slug));
      methodNotAllowed(res, ['GET', 'POST']);
    }
  }
  throw new HttpError(404, 'not_found', 'অনুরোধকৃত রিসোর্স পাওয়া যায়নি।');
}

export interface ApiPath {
  /** Path after /api, e.g. "public/home" ("" when none). */
  path: string;
  /** "url": taken from the request path; "rewrite": taken from the ?route= parameter added by vercel.json. */
  via: 'url' | 'rewrite';
}

/**
 * Works out which API route was requested, however Vercel presents the URL to the function:
 *  - original path ("/api/public/home")                -> used directly
 *  - rewritten path ("/api?route=public/home")          -> ?route= is used
 *  - original non-API path for SSR/sitemap rewrites     -> ?route= is used
 */
export function resolveApiPath(url: URL): ApiPath {
  const match = url.pathname.match(/^\/api(?:\/(.*))?$/);
  const direct = match?.[1]?.replace(/\/+$/g, '') ?? '';
  if (match && direct !== '' && direct !== 'index') return { path: direct, via: 'url' };
  return { path: (url.searchParams.get('route') ?? '').replace(/^\/+|\/+$/g, ''), via: 'rewrite' };
}

export async function handleRequest(req: Req, res: ServerResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const resolved = resolveApiPath(url);
    let segments: string[];
    try {
      segments = resolved.path.split('/').filter(Boolean).map(decodeURIComponent);
    } catch {
      throw new HttpError(400, 'bad_request', 'অনুরোধের ঠিকানা সঠিক নয়।');
    }
    const method = req.method ?? 'GET';
    const [first, second] = segments;

    if (first === 'health' && segments.length === 1) {
      if (method !== 'GET') methodNotAllowed(res, ['GET']);
      // /api/health            -> app is up (no database access)
      // /api/health?deep=1     -> also pings MongoDB; reports only ok/not ok, never details
      if (url.searchParams.get('deep') === '1') {
        try {
          const db = await getDb();
          await db.command({ ping: 1 });
          return sendJson(res, 200, { ok: true, database: true, time: new Date().toISOString() });
        } catch {
          return sendJson(res, 503, { ok: false, database: false, time: new Date().toISOString() });
        }
      }
      return sendJson(res, 200, { ok: true, service: 'govtjob-bd', routing: resolved.via, time: new Date().toISOString() });
    }

    if ((first === 'ssr' || first === 'sitemap') && segments.length === 1) {
      if (method !== 'GET' && method !== 'HEAD') methodNotAllowed(res, ['GET', 'HEAD']);
      return first === 'ssr' ? await handleSsr(req, res, url) : await handleSitemap(req, res);
    }

    if (first === 'cron' && second === 'import' && segments.length === 2) {
      if (method !== 'GET') methodNotAllowed(res, ['GET']);
      if (!process.env.CRON_SECRET) throw new HttpError(404, 'not_found', 'অনুরোধকৃত রিসোর্স পাওয়া যায়নি।');
      const header = req.headers.authorization;
      if (!isCronAuthorized(Array.isArray(header) ? header[0] : header)) throw new HttpError(401, 'unauthorized', 'অনুমতি নেই।');
      return sendJson(res, 200, await runCron(await getDb()));
    }

    if (first === 'auth' && segments.length === 2) {
      const db = await getDb();
      assertSameOrigin(req);
      if (second === 'login') {
        if (method !== 'POST') methodNotAllowed(res, ['POST']);
        return await handleLogin(db, req, res);
      }
      if (second === 'logout') {
        if (method !== 'POST') methodNotAllowed(res, ['POST']);
        await destroySession(db, req, res);
        return sendJson(res, 200, { ok: true });
      }
      if (second === 'me') {
        if (method !== 'GET') methodNotAllowed(res, ['GET']);
        const user = await getSessionAdmin(db, req);
        if (!user) throw new HttpError(401, 'unauthorized', 'লগইন করা নেই।');
        return sendJson(res, 200, { user });
      }
    }

    if (first === 'public') {
      const db = await getDb();
      assertSameOrigin(req);
      return await handlePublic(db, req, res, segments, url);
    }

    if (first === 'admin') {
      const db = await getDb();
      assertSameOrigin(req);
      return await handleAdmin(db, req, res, segments, url);
    }

    throw new HttpError(404, 'not_found', 'অনুরোধকৃত রিসোর্স পাওয়া যায়নি।');
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    if (error instanceof HttpError) {
      return sendJson(res, error.status, { error: error.code, message: error.message, details: error.details });
    }
    const message = error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error';
    console.error('[api] unhandled error:', message);
    const misconfigured = message.includes('Invalid environment configuration');
    return sendJson(res, 500, {
      error: misconfigured ? 'server_misconfigured' : 'server_error',
      message: misconfigured ? 'সার্ভারের কনফিগারেশন সম্পূর্ণ নয়। সাইট অ্যাডমিনকে জানান।' : 'সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
    });
  }
}
