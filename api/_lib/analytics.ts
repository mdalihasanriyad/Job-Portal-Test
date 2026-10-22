import type { Db } from 'mongodb';
import { col } from './db.js';
import { getIp, type Req } from './http.js';
import { hit } from './rateLimit.js';

/**
 * Privacy-friendly, first-party page-view counting: no cookies, no IP or user-agent stored,
 * no third-party scripts. Only (job, day) counters are kept.
 */

const BOT_PATTERN = /bot|crawl|spider|slurp|bing|facebookexternalhit|preview|headless|lighthouse|monitor|curl|wget|python|node-fetch|axios/i;

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
}

function daysAgoISO(days: number): string {
  return new Date(Date.parse(`${todayISO()}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

export async function recordView(db: Db, req: Req, slug: string): Promise<void> {
  const agent = String(req.headers['user-agent'] ?? '');
  if (!agent || BOT_PATTERN.test(agent)) return; // ignore bots and tools
  const limit = await hit(db, `view:ip:${getIp(req)}`, 120, 3600);
  if (!limit.allowed) return;
  const job = await col.jobs(db).findOne({ slug, status: 'published' }, { projection: { _id: 1 } });
  if (!job) return;
  await col.jobViews(db).updateOne({ jobId: job._id, date: todayISO() }, { $inc: { count: 1 } }, { upsert: true });
}

export async function getAnalytics(db: Db): Promise<unknown> {
  const today = todayISO();
  const since = daysAgoISO(6); // today + previous 6 days
  const rows = await col.jobViews(db).aggregate([{ $match: { date: { $gte: since } } }, { $group: { _id: '$jobId', views: { $sum: '$count' } } }, { $sort: { views: -1 } }, { $limit: 10 }]).toArray();
  const totals = await col.jobViews(db).aggregate([{ $match: { date: { $gte: since } } }, { $group: { _id: '$date', views: { $sum: '$count' } } }]).toArray();

  const jobs = rows.length
    ? await col.jobs(db).find({ _id: { $in: rows.map((row) => row._id) } }, { projection: { title: 1, slug: 1 } }).toArray()
    : [];
  const titleById = new Map(jobs.map((job) => [String(job._id), { title: String(job.title), slug: String(job.slug) }]));

  const byDay = new Map(totals.map((row) => [String(row._id), Number(row.views)]));
  const daily: { date: string; views: number }[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = daysAgoISO(offset);
    daily.push({ date, views: byDay.get(date) ?? 0 });
  }
  return {
    today: byDay.get(today) ?? 0,
    last7Days: daily.reduce((sum, day) => sum + day.views, 0),
    daily,
    topJobs: rows.map((row) => ({ id: String(row._id), views: Number(row.views), ...(titleById.get(String(row._id)) ?? { title: '(মুছে ফেলা চাকরি)', slug: '' }) })),
  };
}
