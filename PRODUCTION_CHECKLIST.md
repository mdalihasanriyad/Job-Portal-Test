# GovtJob.bd — Production checklist

Tick each line before announcing the site. "How" is what to do; run `npm run smoke -- <url>` for the automated part.

## A. Build and configuration
- [ ] `npm run build` passes locally and the Vercel build is green
- [ ] `MONGODB_URI`, `MONGODB_DB` set in Vercel (Production + Preview)
- [ ] `.env` is not in Git (`git check-ignore -v .env`); no secret appears in the repository
- [ ] Atlas password rotated if it was ever shared; Atlas Network Access reviewed
- [ ] `npm run db:setup` run against the production database; admin created with `npm run create-admin`
- [ ] Function Region matches the Atlas region

## B. API tests (`npm test` locally, then `npm run smoke -- https://govtjob.bd`)
- [ ] `npm test` passes (routing layout, router and public-data contract tests)
- [ ] `curl.exe -i https://govtjob.bd/api/public/home` returns JSON (not an HTML 404 page)
- [ ] All checks pass (health, database, public lists, 404s, auth rejections, CSRF, forms, sitemap, SSR metadata, headers)
- [ ] Manual: publish a job, see it on `/`, `/jobs`, its category and organization pages
- [ ] Manual: unpublish it → 404 within about 5 minutes; delete it → comments and scripts removed

## C. Authentication and security
- [ ] Anonymous requests to every `/api/admin/*` route return 401 (smoke test covers a sample)
- [ ] Wrong password → generic message; 6th attempt within 15 min → 429
- [ ] Cookie `gj_session` is HttpOnly + Secure + SameSite=Strict (DevTools → Application)
- [ ] Logout deletes the session (back button shows no admin data)
- [ ] Response headers on `/`: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- [ ] No console CSP violations on home, job page, admin pages, contact page
- [ ] Contact/comment honeypot works (hidden field not visible, tab skips it)
- [ ] Try `<script>alert(1)</script>` in a job description, comment and contact message → displayed as plain text, never executed
- [ ] `/admin` and `/search` are `noindex`; `/api/admin/` and `/api/auth/` disallowed in robots.txt

## D. Mobile and responsive (Chrome DevTools → device toolbar, then a real phone)
Test at **360×640**, **390×844**, **768×1024**, **1280×800**.
- [ ] No horizontal scrolling on any public page (tables scroll inside their own box)
- [ ] Header menu opens/closes; links reachable by keyboard (Tab / Enter / Esc in dialogs)
- [ ] Job cards, filters, pagination usable with one thumb
- [ ] Job form and script editor usable on a phone (sticky action bar does not hide fields)
- [ ] Bengali text renders with the intended font; line wrapping looks natural

## E. Accessibility
- [ ] Skip link appears on first Tab press
- [ ] Every form field has a visible label; errors are announced
- [ ] Focus ring visible; colour contrast adequate (Lighthouse Accessibility ≥ 90)

## F. SEO
- [ ] View source of a job page shows title, description, canonical, Open Graph, JSON-LD (no JavaScript needed)
- [ ] Rich Results Test: open job → JobPosting detected; expired job → none
- [ ] `/sitemap.xml` valid and lists only published jobs; submitted in Search Console
- [ ] Facebook/WhatsApp link preview shows title and image
- [ ] Unknown URL returns a real 404 (`curl.exe -I https://govtjob.bd/jobs/nope`)

## G. Error handling
- [ ] Turn off Wi-Fi on a loaded page and click around → friendly Bengali error with retry, no blank page
- [ ] Stop the API (wrong env var on a preview) → pages show the error state; the site shell still loads
- [ ] Throw test: a broken chunk/old tab recovers by itself after a redeploy

## H. Performance
- [ ] Lighthouse (mobile) on `/` and a job page: Performance ≥ 85, SEO ≥ 95, Best Practices ≥ 90
- [ ] Only needed JS chunks load on each page (DevTools → Network → JS)
- [ ] Featured images are WebP/JPEG, ≤ 1200 px wide, ≤ 200 KB

## I. Content and legal
- [ ] About, Privacy, Terms, Disclaimer texts reviewed by you (and a lawyer if you can)
- [ ] Contact page works and you actually read `/admin/messages`
- [ ] Every published job has an official source/apply link and the verified box is ticked only after checking the notice
- [ ] No sample/fake data remains

## J. Data and operations
- [ ] First `npm run backup` completed; copied to a private location; schedule a weekly reminder
- [ ] Vercel and Atlas email alerts enabled
- [ ] A second admin account (or documented recovery) exists
- [ ] Decision made on Vercel plan (Hobby is non-commercial only)

## K. Phase 7 features (only if you enable them)
- [ ] Import: add one authorized source, run it, confirm items arrive as **রিভিউ অপেক্ষমাণ** and cannot be published before **যাচাই করেছি** is ticked
- [ ] Import: a repeated run creates no copies; a deleted item does not come back; a similar title shows **সম্ভাব্য ডুপ্লিকেট**
- [ ] Uploads: image and PDF upload work, the pasted URL opens, the job page shows the image (served resized by Cloudinary)
- [ ] AI: one draft generated, saved as **খসড়া**, usage shown; spend limit set in the Anthropic console; `AI_DAILY_LIMIT` reviewed
- [ ] Analytics: opening a job page twice in one session counts once; bots/curl are not counted; dashboard shows the chart
- [ ] Categories: create, rename, and delete-protection (category with jobs cannot be deleted)
- [ ] `CRON_SECRET` set only if you want the daily import; `/api/cron/import` returns 401 without it

## Known risks (accepted for launch — revisit)
- Admin sign-in is a single factor (password only); there is no 2FA yet.
- Rate-limit counters are per IP; many users behind one shared IP could hit limits together.
- CSP allows inline *styles* (`'unsafe-inline'` in `style-src`) for React/SSR snapshot styling; scripts are restricted to the site itself.
- JobPosting structured data assumes Bangladesh as the location (country level).
- Edge cache can show an unpublished job for up to 5 minutes.
- Imported feed text is stored only as a short admin-only excerpt; you remain responsible for checking each source's terms.
- The AI feature sends job data (public notice information) to a third-party provider when you press the button.
