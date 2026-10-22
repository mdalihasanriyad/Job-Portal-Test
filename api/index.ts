import type { ServerResponse } from 'node:http';
import { handleRequest } from './_lib/router.js';
import type { Req } from './_lib/http.js';

// Single serverless function for the whole API (keeps within Vercel Hobby function limits).
//
// This file is api/index.ts (it serves "/api"), NOT api/[...path].ts: outside Next.js a catch-all file
// only matches ONE extra path segment on Vercel, so /api/public/home returned the platform 404.
// vercel.json rewrites every /api/<anything> request to this function; the router reads the original
// path (or the "route" query parameter set by the rewrite). See tests/vercel-config.test.ts.
export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  await handleRequest(req, res);
}
