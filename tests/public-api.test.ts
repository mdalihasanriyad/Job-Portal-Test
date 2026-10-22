import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleRequest } from '../api/_lib/router.js';
import type { Req } from '../api/_lib/http.js';
import { getHome, getPublicJob } from '../api/_lib/publicService.js';

// Homepage/public-data contract tests with an in-memory fake database (no network, no MongoDB).

function fakeDb(data: Record<string, unknown[]>) {
  const cursor = (docs: unknown[]) => ({
    sort() { return this; },
    skip() { return this; },
    limit(n: number) { docs = docs.slice(0, n); return this; },
    toArray: async () => docs,
  });
  return {
    collection: (name: string) => ({
      find: () => cursor([...(data[name] ?? [])]),
      findOne: async () => (data[name] ?? [])[0] ?? null,
      aggregate: () => ({ toArray: async () => data[`${name}:aggregate`] ?? [] }),
      countDocuments: async () => (data[name] ?? []).length,
    }),
  } as never;
}

const HOME_KEYS = ['categories', 'closingSoon', 'featured', 'latest', 'organizations'];

describe('GET /api/public/home contract', () => {
  it('returns all five arrays when the database is empty', async () => {
    const home = (await getHome(fakeDb({}))) as Record<string, unknown>;
    assert.deepEqual(Object.keys(home).sort(), HOME_KEYS);
    for (const key of HOME_KEYS) assert.ok(Array.isArray(home[key]), `${key} must be an array`);
  });

  it('returns categories with a zero count when they have no jobs', async () => {
    const db = fakeDb({ categories: [{ slug: 'bank', name: 'ব্যাংক', description: 'd' }] });
    const home = (await getHome(db)) as { categories: { slug: string; count: number }[] };
    assert.deepEqual(home.categories, [{ slug: 'bank', name: 'ব্যাংক', description: 'd', count: 0 }]);
  });

  it('tolerates jobs with missing optional fields and never leaks internal fields in lists', async () => {
    const job = { _id: 'abc123', slug: 'a-job', title: 'অফিসার', organization: 'নমুনা', organizationSlug: 'o', category: 'ব্যাংক', categorySlug: 'bank', positions: [], publishedAt: '2026-10-01', status: 'published', verified: false, featured: true, import: { itemKey: 'secret' }, createdBy: 'admin-id', sourceUrlKey: 'k' };
    const home = (await getHome(fakeDb({ jobs: [job] }))) as { latest: Record<string, unknown>[] };
    assert.equal(home.latest.length, 1);
    assert.equal(home.latest[0].id, 'abc123');
    assert.ok(!('_id' in home.latest[0]) && !('import' in home.latest[0]) && !('createdBy' in home.latest[0]) && !('sourceUrlKey' in home.latest[0]));
    assert.equal('deadline' in home.latest[0], false); // optional field simply absent
  });
});

describe('GET /api/public/jobs/:slug', () => {
  it('returns only whitelisted fields', async () => {
    const job = { _id: 'x1', slug: 's', title: 'শিরোনাম', organization: 'o', organizationSlug: 'o', category: 'c', categorySlug: 'c', positions: [], publishedAt: '2026-10-01', status: 'published', verified: true, featured: false, import: { excerpt: 'internal' }, createdBy: 'admin', sourceUrlKey: 'k', createdAt: new Date() };
    const result = (await getPublicJob(fakeDb({ jobs: [job] }), 's')) as { job: Record<string, unknown> };
    for (const forbidden of ['import', 'createdBy', 'sourceUrlKey', 'createdAt', '_id']) assert.ok(!(forbidden in result.job), `${forbidden} leaked`);
    assert.equal(result.job.title, 'শিরোনাম');
  });
});

describe('error handling without a database configuration', () => {
  it('returns a JSON 500 that does not reveal environment variable names or stack traces', async () => {
    const saved = { uri: process.env.MONGODB_URI, db: process.env.MONGODB_DB };
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DB;
    try {
      const headers: Record<string, string> = {};
      const result = await new Promise<{ status: number; body: string }>((resolve) => {
        const req = { method: 'GET', url: '/api/public/home', headers: { host: 'localhost' }, socket: { remoteAddress: '127.0.0.1' } } as unknown as Req;
        const res = { statusCode: 200, setHeader(n: string, v: string | number) { headers[n.toLowerCase()] = String(v); }, end(body?: string) { resolve({ status: this.statusCode, body: body ?? '' }); } };
        void handleRequest(req, res as never);
      });
      assert.equal(result.status, 500);
      assert.match(headers['content-type'], /application\/json/);
      const parsed = JSON.parse(result.body);
      assert.equal(parsed.error, 'server_misconfigured');
      assert.ok(!/MONGODB|mongodb\+srv|stack|at .*\.ts/i.test(result.body), 'response leaks internals');
    } finally {
      if (saved.uri !== undefined) process.env.MONGODB_URI = saved.uri;
      if (saved.db !== undefined) process.env.MONGODB_DB = saved.db;
    }
  });
});
