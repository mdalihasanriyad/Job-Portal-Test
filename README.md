# GovtJob.bd

React + TypeScript + Vite + Tailwind CSS on Vercel, with MongoDB Atlas.

```
npm install
copy .env.example .env      # then edit .env (never commit it)
npm run db:setup            # creates/updates indexes + seeds categories (re-run after updates)
npm run create-admin        # creates an admin (prompts for password)
npm run dev                 # site + API at http://localhost:5173  (admin: /admin/login)
npm run build               # type-check + production build
npm run smoke -- <url>      # automated API/SEO/security checks (default http://localhost:5173)
npm run backup              # JSON backup of all collections into backups/
```

- Public pages read published jobs from MongoDB through `/api/public/*`.
- Admin (`/admin`): jobs, YouTube script prompts, comment moderation, contact messages.
- YouTube scripts are API-free: the app builds a Bengali prompt from a job; you run it in an external AI and paste the result back.
- All API routes live in one serverless function: `api/index.ts` (code in `api/_lib/`). `vercel.json` rewrites every `/api/<anything>` request to it (`/api?route=<anything>`), because on Vercel a catch-all file such as `api/[...path].ts` only matches ONE segment outside Next.js. Do not rename it back. `npm test` guards this.
- The public site is empty until you publish jobs from the admin.

## SEO (Phase 5)

- `/sitemap.xml` is generated from MongoDB (`api/_lib/sitemap.ts`); `robots.txt` points to it.
- Job, category, organization and list pages are served through `/api/ssr` (see `vercel.json`):
  the built `index.html` with real `<title>`, description, canonical, Open Graph, JSON-LD and a plain-HTML
  content snapshot. React replaces the snapshot on load. If the function fails, the normal SPA shell is served.
- To switch the server-rendered layer off, delete the rewrites whose destination starts with `/api/ssr` in `vercel.json`
  (keep the final `/((?!api/).*)` rewrite).

## Deploying

See `DEPLOYMENT.md` (step-by-step for Windows + Vercel + Atlas + the govtjob.bd domain) and `PRODUCTION_CHECKLIST.md`.

## Phase 7 (optional features)

- Authorized job import with duplicate detection: see `IMPORTING.md`.
- Optional Cloudinary uploads, optional paid AI drafts, first-party view counts, category management: see `DEPLOYMENT.md` ("Optional features").
# Job-Portal-Test
