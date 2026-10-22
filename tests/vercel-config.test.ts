import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

// Regression tests for the production 404 on /api/public/home.
// ROOT CAUSE: outside Next.js, Vercel's file-system catch-all (api/[...path].ts) only matches ONE extra
// segment, so /api/health worked while every nested route (/api/public/*, /api/admin/*, /api/auth/*,
// /api/cron/*) returned the platform 404 before reaching the application.
// These tests describe the layout that avoids it. Set PROJECT_ROOT to test another checkout.

const root = process.env.PROJECT_ROOT ?? process.cwd();
const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as {
  rewrites?: { source: string; destination: string }[];
  crons?: { path: string }[];
};
const rewrites = config.rewrites ?? [];
const apiFiles = existsSync(join(root, 'api')) ? readdirSync(join(root, 'api')) : [];

describe('Vercel API routing layout', () => {
  it('has no catch-all file directly in api/ (it only matches one segment outside Next.js)', () => {
    const catchAll = apiFiles.filter((name) => name.startsWith('[...') || name.startsWith('[['));
    assert.deepEqual(catchAll, [], `catch-all file(s) found: ${catchAll.join(', ')}`);
  });

  it('has api/index.ts, the single function that serves /api', () => {
    assert.ok(apiFiles.includes('index.ts'), 'api/index.ts is missing');
  });

  it('rewrites every nested /api/... path to the function', () => {
    const apiRewrite = rewrites.find((rule) => rule.source === '/api/:path+');
    assert.ok(apiRewrite, 'no rewrite for /api/:path+');
    assert.ok(apiRewrite.destination.startsWith('/api?route='), `unexpected destination ${apiRewrite.destination}`);
  });

  it('puts the API rewrite before the SPA fallback', () => {
    const apiIndex = rewrites.findIndex((rule) => rule.source === '/api/:path+');
    const spaIndex = rewrites.findIndex((rule) => rule.destination === '/index.html');
    assert.ok(apiIndex !== -1 && spaIndex !== -1 && apiIndex < spaIndex);
  });

  it('never rewrites to a function file that does not exist (e.g. /api/ssr)', () => {
    for (const rule of rewrites) {
      if (!rule.destination.startsWith('/api')) continue;
      assert.ok(rule.destination === '/api' || rule.destination.startsWith('/api?'), `"${rule.source}" -> "${rule.destination}" targets a non-existent function`);
    }
  });

  it('scheduled jobs use /api/ paths (covered by the rewrite)', () => {
    for (const cron of config.crons ?? []) assert.ok(cron.path.startsWith('/api/'));
  });
});
