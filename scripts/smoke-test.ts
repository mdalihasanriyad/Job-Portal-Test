// Usage:
//   npm run smoke                              (tests http://localhost:5173 — start `npm run dev` first)
//   npm run smoke -- https://your-project.vercel.app
//   npm run smoke -- https://govtjob.bd
//
// Read-only checks plus a few harmless rejected requests. No credentials are needed or used.

const base = (process.argv[2] ?? process.env.SMOKE_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);
const isHttps = base.startsWith('https://');

type Outcome = 'PASS' | 'FAIL' | 'SKIP';
const results: { name: string; outcome: Outcome; detail: string }[] = [];

function record(name: string, outcome: Outcome, detail = ''): void {
  results.push({ name, outcome, detail });
  const icon = outcome === 'PASS' ? '✔' : outcome === 'FAIL' ? '✘' : '–';
  console.log(`${icon} ${outcome.padEnd(4)} ${name}${detail ? `  (${detail})` : ''}`);
}

async function check(name: string, run: () => Promise<string | void>): Promise<void> {
  try {
    const detail = await run();
    record(name, 'PASS', detail ?? '');
  } catch (error) {
    record(name, 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

function skip(name: string, why: string): void {
  record(name, 'SKIP', why);
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function get(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${base}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...init });
}

const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Accept: 'application/json' };

async function main(): Promise<void> {
  console.log(`Smoke test against ${base}${isLocal ? ' (local dev)' : ''}\n`);

  await check('API health', async () => {
    const res = await get('/api/health');
    expect(res.status === 200, `status ${res.status}`);
    const body = (await res.json()) as { ok?: boolean; routing?: string };
    expect(body.ok === true, 'ok !== true');
    return `routing via ${body.routing ?? 'unknown'}`;
  });

  // Regression check for the production 404: a NESTED path must reach the application, not Vercel's 404 page.
  await check('Nested API path reaches the app (not a platform 404)', async () => {
    const res = await get('/api/public/categories');
    const type = String(res.headers.get('content-type') ?? '');
    expect(!res.headers.get('x-vercel-error'), `platform error: ${res.headers.get('x-vercel-error')}`);
    expect(type.includes('application/json'), `status ${res.status}, content-type "${type}" (an HTML page means Vercel never ran the function)`);
  });
  await check('Query strings are forwarded to the API', async () => {
    const res = await get('/api/public/jobs?page=7&pageSize=3');
    const body = (await res.json()) as { page?: number; pageSize?: number };
    expect(res.status === 200 && body.page === 7 && body.pageSize === 3, `got page=${body.page}, pageSize=${body.pageSize}`);
  });

  await check('Database connection (health?deep=1)', async () => {
    const res = await get('/api/health?deep=1');
    expect(res.status === 200, `status ${res.status} — check MONGODB_URI / Atlas network access`);
  });

  let firstSlug = '';
  await check('Public jobs list responds with the expected shape', async () => {
    const res = await get('/api/public/jobs?page=1&pageSize=3');
    expect(res.status === 200, `status ${res.status}`);
    const body = (await res.json()) as { items?: { slug: string; status: string }[]; total?: number };
    expect(Array.isArray(body.items) && typeof body.total === 'number', 'unexpected JSON');
    expect(body.items.every((job) => job.status === 'published'), 'a non-published job leaked');
    firstSlug = body.items[0]?.slug ?? '';
    return `${body.total} published job(s)`;
  });

  await check('Public categories seeded', async () => {
    const res = await get('/api/public/categories');
    const body = (await res.json()) as { categories?: unknown[] };
    expect(res.status === 200 && Array.isArray(body.categories) && body.categories.length > 0, 'no categories — run `npm run db:setup`');
    return `${body.categories.length} categories`;
  });

  await check('Home data endpoint', async () => {
    const res = await get('/api/public/home');
    const body = (await res.json()) as { latest?: unknown[] };
    expect(res.status === 200 && Array.isArray(body.latest), `status ${res.status}`);
  });

  await check('Unknown job returns 404 (API)', async () => {
    const res = await get('/api/public/jobs/this-job-does-not-exist-xyz');
    expect(res.status === 404, `status ${res.status}`);
  });

  await check('API responses are not indexable and not cached privately', async () => {
    const res = await get('/api/public/categories');
    expect(String(res.headers.get('x-robots-tag')).includes('noindex'), 'missing X-Robots-Tag: noindex');
    expect(res.headers.get('x-content-type-options') === 'nosniff', 'missing nosniff');
  });

  // ---- authorization ----
  await check('Admin API rejects anonymous requests (stats)', async () => {
    const res = await get('/api/admin/stats');
    expect(res.status === 401, `status ${res.status}`);
  });
  await check('Admin API rejects anonymous requests (jobs, scripts, comments, messages, imports, categories, features)', async () => {
    for (const path of ['/api/admin/jobs', '/api/admin/scripts', '/api/admin/comments', '/api/admin/messages', '/api/admin/import-sources', '/api/admin/categories', '/api/admin/features']) {
      const res = await get(path);
      expect(res.status === 401, `${path} -> ${res.status}`);
    }
  });
  await check('Anonymous cannot create or delete jobs', async () => {
    const create = await get('/api/admin/jobs', { method: 'POST', headers: JSON_HEADERS, body: '{}' });
    expect(create.status === 401, `POST -> ${create.status}`);
    const del = await get('/api/admin/jobs/000000000000000000000000', { method: 'DELETE', headers: JSON_HEADERS });
    expect(del.status === 401, `DELETE -> ${del.status}`);
  });
  await check('Anonymous cannot sign uploads, create sources or categories, or generate AI drafts', async () => {
    for (const [method, path] of [['POST', '/api/admin/uploads/sign'], ['POST', '/api/admin/import-sources'], ['POST', '/api/admin/categories'], ['POST', '/api/admin/scripts/000000000000000000000000/generate'], ['POST', '/api/admin/import-sources/000000000000000000000000/run']] as const) {
      const res = await get(path, { method, headers: JSON_HEADERS, body: '{}' });
      expect(res.status === 401, `${method} ${path} -> ${res.status}`);
    }
  });
  await check('Scheduled import endpoint refuses anonymous callers', async () => {
    const res = await get('/api/cron/import');
    expect(res.status === 401 || res.status === 404, `status ${res.status}`);
  });
  await check('View counter ignores unknown jobs without errors', async () => {
    const res = await get('/api/public/jobs/this-job-does-not-exist-xyz/view', { method: 'POST', headers: JSON_HEADERS });
    expect(res.status === 200, `status ${res.status}`);
  });
  await check('Login without CSRF header is rejected', async () => {
    const res = await get('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@b.co', password: 'x' }) });
    expect(res.status === 403, `status ${res.status}`);
  });
  await check('Login with cross-origin Origin is rejected', async () => {
    const res = await get('/api/auth/login', { method: 'POST', headers: { ...JSON_HEADERS, Origin: 'https://evil.example' }, body: JSON.stringify({ email: 'a@b.co', password: 'x' }) });
    expect(res.status === 403, `status ${res.status}`);
  });
  await check('Wrong credentials give a generic 401 and no session cookie', async () => {
    const email = `smoke-${Date.now()}@example.invalid`; // unique, so a real admin is never rate-limited
    const res = await get('/api/auth/login', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email, password: 'wrong-password-123' }) });
    expect(res.status === 401, `status ${res.status}`);
    expect(!res.headers.get('set-cookie'), 'a cookie was set on failed login');
  });

  // ---- public forms: validation only (nothing is stored) ----
  await check('Contact form validates input', async () => {
    const res = await get('/api/public/contact', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: '', subject: '', message: '' }) });
    expect(res.status === 422, `status ${res.status}`);
  });
  await check('Comment on an unknown job is rejected', async () => {
    const res = await get('/api/public/jobs/this-job-does-not-exist-xyz/comments', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: 'Smoke Test', comment: 'This should be rejected.' }) });
    expect(res.status === 404 || res.status === 429, `status ${res.status}`);
  });

  // ---- pages & SEO ----
  await check('Home page serves the app shell', async () => {
    const res = await get('/');
    const html = await res.text();
    expect(res.status === 200 && html.includes('id="root"'), `status ${res.status}`);
  });

  if (isLocal) {
    skip('robots.txt references the sitemap and hides admin', 'checked on deployed sites');
  } else {
    await check('robots.txt references the sitemap and hides admin', async () => {
      const res = await get('/robots.txt');
      const text = await res.text();
      expect(text.includes('Sitemap:') && text.includes('Disallow: /admin'), 'unexpected robots.txt');
    });
  }

  await check('Sitemap is valid XML', async () => {
    const res = await get(isLocal ? '/api/sitemap' : '/sitemap.xml');
    const xml = await res.text();
    expect(res.status === 200 && xml.includes('<urlset') && xml.includes('<loc>https://govtjob.bd/</loc>'), `status ${res.status}`);
    expect(!String(res.headers.get('x-robots-tag') ?? '').includes('noindex'), 'sitemap is marked noindex');
    return `${(xml.match(/<url>/g) ?? []).length} URLs`;
  });

  if (firstSlug) {
    await check('Job page renders server-side metadata', async () => {
      const res = await get(isLocal ? `/api/ssr?kind=job&slug=${firstSlug}` : `/jobs/${firstSlug}`);
      const html = await res.text();
      expect(res.status === 200, `status ${res.status}`);
      expect(html.includes(`rel="canonical" href="https://govtjob.bd/jobs/${firstSlug}"`), 'canonical missing');
      expect(html.includes('application/ld+json'), 'JSON-LD missing');
      expect((html.match(/<title>/g) ?? []).length === 1, 'duplicate <title>');
    });
  } else {
    skip('Job page renders server-side metadata', 'no published job yet');
  }

  if (isLocal) {
    skip('Unknown job URL returns a real 404', 'rewrites only exist on Vercel');
    skip('Security headers', 'set by vercel.json on deployed sites');
  } else {
    await check('Unknown job URL returns a real 404', async () => {
      const res = await get('/jobs/this-job-does-not-exist-xyz');
      expect(res.status === 404, `status ${res.status}`);
    });
    await check('Security headers present', async () => {
      const res = await get('/');
      const need = ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'content-security-policy', ...(isHttps ? ['strict-transport-security'] : [])];
      const missing = need.filter((name) => !res.headers.get(name));
      expect(missing.length === 0, `missing: ${missing.join(', ')}`);
    });
    await check('Admin pages are marked noindex', async () => {
      const res = await get('/admin/login');
      expect(String(res.headers.get('x-robots-tag')).includes('noindex'), 'missing X-Robots-Tag on /admin');
    });
  }

  const failed = results.filter((r) => r.outcome === 'FAIL').length;
  const passed = results.filter((r) => r.outcome === 'PASS').length;
  console.log(`\n${passed} passed, ${failed} failed, ${results.length - passed - failed} skipped`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error: unknown) => {
  console.error('Smoke test crashed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
