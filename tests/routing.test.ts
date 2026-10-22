import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleRequest, resolveApiPath } from '../api/_lib/router.js';
import type { Req } from '../api/_lib/http.js';

// Router tests that need no database: path resolution, health, unknown routes, wrong methods.

function call(method: string, url: string): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    const req = { method, url, headers: { host: 'localhost' }, socket: { remoteAddress: '127.0.0.1' } } as unknown as Req;
    const res = {
      statusCode: 200,
      setHeader(name: string, value: string | number) {
        headers[name.toLowerCase()] = String(value);
      },
      end(body?: string) {
        resolve({ status: this.statusCode, headers, body: body ?? '' });
      },
    };
    void handleRequest(req, res as never);
  });
}

describe('resolveApiPath', () => {
  const parse = (value: string) => resolveApiPath(new URL(value, 'http://x'));

  it('uses the original path when Vercel passes it through', () => {
    assert.deepEqual(parse('/api/public/home'), { path: 'public/home', via: 'url' });
    assert.deepEqual(parse('/api/health?deep=1'), { path: 'health', via: 'url' });
    assert.deepEqual(parse('/api/admin/jobs/abc/status'), { path: 'admin/jobs/abc/status', via: 'url' });
  });

  it('uses ?route= when the function sees the rewritten URL', () => {
    assert.deepEqual(parse('/api?route=public/home&page=2'), { path: 'public/home', via: 'rewrite' });
    assert.deepEqual(parse('/api/index?route=auth/login'), { path: 'auth/login', via: 'rewrite' });
  });

  it('uses ?route= for SSR/sitemap rewrites even if the original non-API path is shown', () => {
    assert.deepEqual(parse('/jobs/my-job?route=ssr&kind=job&slug=my-job'), { path: 'ssr', via: 'rewrite' });
    assert.deepEqual(parse('/sitemap.xml?route=sitemap'), { path: 'sitemap', via: 'rewrite' });
  });

  it('returns an empty path when there is nothing to route', () => {
    assert.equal(parse('/api').path, '');
    assert.equal(parse('/api/').path, '');
  });
});

describe('handleRequest (no database needed)', () => {
  it('GET /api/health works for both URL shapes', async () => {
    for (const url of ['/api/health', '/api?route=health']) {
      const res = await call('GET', url);
      assert.equal(res.status, 200, url);
      assert.match(res.headers['content-type'], /application\/json/);
      assert.equal(JSON.parse(res.body).ok, true);
    }
  });

  it('unknown nested routes return JSON 404 from the application, not an HTML page', async () => {
    for (const url of ['/api/does/not/exist', '/api?route=does/not/exist', '/api']) {
      const res = await call('GET', url);
      assert.equal(res.status, 404, url);
      assert.match(res.headers['content-type'], /application\/json/, url);
      assert.equal(JSON.parse(res.body).error, 'not_found');
      assert.ok(!res.body.includes('<html'));
    }
  });

  it('unsupported methods return 405 with an Allow header', async () => {
    const res = await call('POST', '/api/health');
    assert.equal(res.status, 405);
    assert.equal(res.headers.allow, 'GET');
    assert.match(res.headers['content-type'], /application\/json/);
  });

  it('API responses carry noindex and nosniff headers and are not cached', async () => {
    const res = await call('GET', '/api/health');
    assert.equal(res.headers['x-robots-tag'], 'noindex');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['cache-control'], 'no-store');
  });

  it('rejects a malformed percent-encoded path with 400 instead of crashing', async () => {
    const res = await call('GET', '/api/public/%E0%A4%A');
    assert.equal(res.status, 400);
  });
});
