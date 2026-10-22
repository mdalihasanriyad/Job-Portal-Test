# Importing jobs from authorized sources (Phase 7)

GovtJob.bd can collect *leads* from public feeds, but **a human always writes and verifies the job before it is published.**

## What the importer does
- Reads an **RSS/Atom** or **JSON** feed that you register under *Admin → আমদানি*.
- For each new feed item it creates a job with status **রিভিউ অপেক্ষমাণ (pending review)**, never published, containing only:
  title, link to the item, publication date from the feed, your default organization and category, and a short plain-text excerpt kept **for admin reference only**.
- It stores the **source name, the item link and the retrieval date** on the job.
- It does **not** download circular files, images or full articles, and it does not copy third-party text into the public page.

## Rules the code enforces
| Rule | How |
|---|---|
| Authorized sources only | You must write why automated retrieval is allowed and tick a confirmation before a source can be saved. |
| Respect site rules | `robots.txt` of the feed's host is fetched; if it disallows the feed (or cannot be checked) nothing is imported. |
| No access-control bypass | Plain HTTPS GET of a public URL only. No logins, cookies, CAPTCHAs, headless browsers or scraping of HTML pages. |
| Safe fetching | HTTPS only, port 443, no credentials in URLs, private/internal addresses blocked (also after redirects and DNS lookups), 2 MB and 10 s limits. |
| Polite | Identifies itself as `GovtJobBD-Importer/1.0`; at most 50 items per run; a source can be run manually once per 10 minutes. |
| Manual verification | Imported jobs cannot be published until you tick **"যাচাই করেছি"** after checking the official notice (enforced by the server). |
| Duplicates | Same source link, or a title that is ≥ 75 % similar to a recent job, flags the item **সম্ভাব্য ডুপ্লিকেট** with a link to the existing job. Items already imported (even if you deleted them later) are never re-imported. |

## Using it
1. *আমদানি → + নতুন সোর্স*: name, type, feed URL, default organization and category, a note explaining the permission, tick the confirmation.
2. Press **এখনই আনুন**. The result shows how many items were fetched, new, already known and possible duplicates.
3. *রিভিউ অপেক্ষমাণ চাকরি দেখুন* → open an item → read the **official** notice → fill in organization, posts, qualifications, dates, official links → tick **যাচাই করেছি** → **প্রকাশ করুন**.
4. If it is a duplicate, open the linked job, then use **এটি ডুপ্লিকেট নয়** or delete the new item.

## Automatic daily import (optional)
Set `CRON_SECRET` (16+ random characters) in Vercel and redeploy. `vercel.json` already schedules `/api/cron/import` daily at 03:00 UTC; it processes up to 3 enabled sources per run and only creates pending-review items. Without `CRON_SECRET` the endpoint is disabled.

## Not allowed / not supported
Scraping HTML pages, bypassing logins or CAPTCHAs, ignoring `robots.txt`, copying articles or circular files, or publishing without verification. If a government site offers no feed or API, add jobs manually.
