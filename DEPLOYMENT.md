# GovtJob.bd — Deployment guide (Windows 10 + Vercel + MongoDB Atlas)

Follow the steps in order. Commands are for **PowerShell** (or CMD) unless noted.

## 0. What you need

| Tool | Notes |
|---|---|
| Node.js **20 LTS** (64-bit) | https://nodejs.org — check with `node -v` |
| Git for Windows | https://git-scm.com — check with `git --version` |
| GitHub account | a **private** repository is recommended |
| Vercel account | sign in with GitHub |
| MongoDB Atlas cluster | you already have one |

**Costs to know about**
- Atlas **M0 (free)**: 512 MB, shared, **no automated backups** (see step 9).
- Vercel **Hobby (free)** is for **non-commercial** use. If the site earns money (ads, sponsored content, monetized YouTube traffic), Vercel's terms require the **Pro** plan (about USD 20/month). Decide before launch.
- The `.bd` domain is renewed through your registrar.

## 1. Verify locally first

```powershell
cd C:\path\to\govtjob-bd
npm install
npm run build
```
`npm run build` must finish without errors (it type-checks the whole project). Then:

```powershell
npm run db:setup        # indexes + categories (safe to repeat)
npm run create-admin    # first administrator (password: 12+ chars, letters + digits)
npm run dev             # http://localhost:5173  -> /admin/login
```
In a **second** PowerShell window while `npm run dev` is running:
```powershell
npm run smoke           # automated checks against http://localhost:5173
```

## 2. MongoDB Atlas settings

1. **Database Access** → your database user needs *Read and write to any database* (or to your database only).
2. **Network Access** → add `0.0.0.0/0` (allow from anywhere). Vercel uses changing IP addresses, so Atlas cannot be limited to one IP. Your protection is a long, unique database password — keep it secret.
3. **Rotate the password** if it was ever pasted into chat, email or screenshots: Database Access → Edit user → *Edit Password*, then update `.env` and the Vercel variables (steps 1 and 5).
4. **Region:** note your cluster region (Cluster → Overview). In Vercel (step 5) set *Settings → Functions → Function Region* to the nearest region (for AWS Singapore choose `sin1`) to cut latency.
5. Passwords with special characters (`@ : / ? # %`) must be URL-encoded inside `MONGODB_URI`.

## 3. Secrets — where they go

- Local: the file `.env` in the project root (already listed in `.gitignore`).
- Vercel: *Project → Settings → Environment Variables* (step 5).
- **Never** commit `.env`, never put secrets in files that start with `VITE_` (those go into the public browser bundle).

Required variables:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-host>/
MONGODB_DB=<database name>
```

### Optional features (Phase 7) — all OFF until you add their variables

| Feature | Variables (add in `.env` and in Vercel) | Cost |
|---|---|---|
| Scheduled job import | `CRON_SECRET` (16+ random characters) | free (Vercel Hobby allows one cron per day) |
| File uploads (images, PDFs) | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary has a free tier (no card). PDF delivery may need enabling in Cloudinary → Settings → Security → "PDF and ZIP files delivery". |
| AI script drafts | `ANTHROPIC_API_KEY`, optional `AI_MODEL`, `AI_DAILY_LIMIT` | **Paid per use** (Anthropic API billing). Set a spend limit in the Anthropic console. |

After adding variables in Vercel, **Redeploy**. The AI feature can take up to a minute per script, so the function time limit is set to 60 seconds in `vercel.json`.

## 4. Git and GitHub

```powershell
git init
git add .
git status                    # make sure .env is NOT listed
git check-ignore -v .env      # should print the .gitignore rule
git commit -m "GovtJob.bd initial version"
git branch -M main
```
Create an empty **private** repository on GitHub (no README), then:
```powershell
git remote add origin https://github.com/<your-user>/govtjob-bd.git
git push -u origin main
```

## 5. Import into Vercel

1. vercel.com → **Add New… → Project** → import the GitHub repository.
2. Framework preset: **Vite** (auto-detected). Build command `npm run build`, output directory `dist` (both already set in `vercel.json`).
3. **Environment Variables:** add `MONGODB_URI` and `MONGODB_DB` for *Production*, *Preview* and *Development*.
4. *Settings → General → Node.js Version* → **20.x**.
5. Click **Deploy**. Every `git push` to `main` redeploys automatically.

## 6. Check the first deployment (before the domain)

Use the `*.vercel.app` address Vercel gives you:
```powershell
npm run smoke -- https://your-project.vercel.app
```
Then open these in a browser:
- `/api/health` → `{"ok":true,...}`; `/api/health?deep=1` → `"database":true`
- `/admin/login` → sign in with the admin you created
- Create a category-matched job with an official source link and **publish** it
- `/` and `/jobs/<your-slug>` → the job shows; "view source" shows the real `<title>`, canonical link and JSON-LD
- `/sitemap.xml` and `/robots.txt`

If `/api/health?deep=1` says `"database":false`, see *Troubleshooting*.

## 7. Connect the domain `govtjob.bd`

Do not assume DNS is already pointing to Vercel.

1. Vercel → Project → **Settings → Domains** → add `govtjob.bd` and `www.govtjob.bd`. Make `govtjob.bd` the primary; `www` redirects to it (also enforced in `vercel.json`).
2. Vercel shows the exact DNS records to create. Use **those values**. They are normally:

   | Type | Name | Value |
   |---|---|---|
   | A | `@` (govtjob.bd) | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |

3. Create them in the DNS panel of whoever manages `govtjob.bd` (your registrar). Remove old A/AAAA/CNAME records for the same names first.
4. Wait for propagation (minutes to 48 hours). Check:
   ```powershell
   nslookup govtjob.bd
   nslookup www.govtjob.bd
   ```
5. In Vercel, the domain turns to **Valid Configuration**. The HTTPS certificate is issued automatically.

## 8. Verify HTTPS and the live site

```powershell
curl.exe -I http://govtjob.bd          # expect a redirect (308) to https://
curl.exe -I https://govtjob.bd         # expect 200 and Strict-Transport-Security, Content-Security-Policy
curl.exe -I https://www.govtjob.bd     # expect 308 to https://govtjob.bd
npm run smoke -- https://govtjob.bd
```
In the browser: padlock shown, no mixed-content warnings, DevTools Console has **no CSP violations**.

Then register the site: Google Search Console (add `govtjob.bd`, verify with the DNS TXT record) → *Sitemaps* → submit `https://govtjob.bd/sitemap.xml`. Optionally Bing Webmaster Tools.

## 9. Backups (Atlas free tier has none)

```powershell
npm run backup
```
Writes one `.ndjson` file per collection into `backups\<timestamp>\` (git-ignored). Run it weekly and after bulk edits; copy the folder to a private place (not GitHub). The files contain personal data and admin password hashes.

For a full-fidelity dump, install *MongoDB Database Tools* and run:
```powershell
mongodump --uri "<your MONGODB_URI>" --db <your db name> --out backups\dump
```
Upgrading the cluster to M10+ enables Atlas continuous backups.

## 10. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Vercel build fails at `tsc -b` | Run `npm run build` locally, read the first error, fix, push. |
| Vercel's own **404 page** on `/api/public/...` or `/api/admin/...`, but `/api/health` works | Fixed in the audit release: the API entry is `api/index.ts` plus a `/api/:path+` rewrite in `vercel.json` (Vercel only matches one segment for catch-all files outside Next.js). Check with `curl.exe -i https://govtjob.bd/api/public/categories`: JSON = the app answered; an HTML page with `X-Vercel-Error: NOT_FOUND` = the request never reached the function (check `vercel.json` and that `api/index.ts` was deployed). |
| `server_misconfigured` / "কনফিগারেশন সম্পূর্ণ নয়" | `MONGODB_URI` or `MONGODB_DB` missing/invalid in Vercel. Add them, then **Redeploy** (variables apply only to new deployments). |
| `database:false`, timeouts | Atlas *Network Access* does not allow `0.0.0.0/0`, wrong password, or special characters not URL-encoded. |
| `querySrv ECONNREFUSED` (local) | Your DNS blocks SRV lookups. Switch Windows DNS to 8.8.8.8 / 1.1.1.1, or use Atlas's non-SRV connection string. |
| Admin login works locally but not on the site | Open the site via **https**. Cookies are `Secure`; check DevTools → Application → Cookies for `gj_session`. |
| Job page returns 503 | The SEO function could not read `dist/index.html`. Check Vercel build logs and *Functions* logs; as a quick fix remove the `/api/ssr` rewrites in `vercel.json` and redeploy (the site keeps working as a plain SPA). |
| Unpublished/edited job still visible for a few minutes | Edge cache (5 min). Wait, or redeploy to purge. |
| Blank page or CSP errors in Console | Note the blocked URL in the console and tell me; the policy is in `vercel.json` (`Content-Security-Policy`). |
| Old tab shows errors after a deploy | Expected once; the app reloads itself to the new version. |
| Import says "robots.txt যাচাই করা যায়নি" | The source site's robots.txt could not be fetched. Try later; do not work around it. |
| `429` on login | Rate limit (5 tries per 15 min per IP+email). Wait 15 minutes. |

## 11. Rollback

Vercel → Project → **Deployments** → pick the last good deployment → *Promote to Production*. Database data is not rolled back.
