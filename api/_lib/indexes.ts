import type { Db } from 'mongodb';
import { col } from './db.js';

/** Creates all indexes. Safe to run repeatedly. */
export async function ensureIndexes(db: Db): Promise<string[]> {
  const done: string[] = [];
  const track = async (name: string, run: Promise<unknown>) => {
    await run;
    done.push(name);
  };

  await track('admins.email (unique)', col.admins(db).createIndex({ email: 1 }, { unique: true }));
  await track('sessions.tokenHash (unique)', col.sessions(db).createIndex({ tokenHash: 1 }, { unique: true }));
  await track('sessions.expiresAt (TTL)', col.sessions(db).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }));
  await track('rateLimits.key (unique)', col.rateLimits(db).createIndex({ key: 1 }, { unique: true }));
  await track('rateLimits.resetAt (TTL)', col.rateLimits(db).createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 }));
  await track('categories.slug (unique)', col.categories(db).createIndex({ slug: 1 }, { unique: true }));

  const jobs = col.jobs(db);
  await track('jobs.slug (unique)', jobs.createIndex({ slug: 1 }, { unique: true }));
  await track('jobs.status+publishedAt', jobs.createIndex({ status: 1, publishedAt: -1 }));
  await track('jobs.status+updatedAt', jobs.createIndex({ status: 1, updatedAt: -1 }));
  await track('jobs.categorySlug+status', jobs.createIndex({ categorySlug: 1, status: 1 }));
  await track('jobs.organizationSlug+status', jobs.createIndex({ organizationSlug: 1, status: 1 }));
  await track('jobs.deadline', jobs.createIndex({ deadline: 1 }));
  await track(
    'jobs text (title, organization, category, positions)',
    jobs.createIndex(
      { title: 'text', organization: 'text', category: 'text', 'positions.name': 'text' },
      { name: 'jobs_text', default_language: 'none' },
    ),
  );

  await track('comments.jobSlug+status+createdAt', col.comments(db).createIndex({ jobSlug: 1, status: 1, createdAt: -1 }));
  await track('comments.status+createdAt', col.comments(db).createIndex({ status: 1, createdAt: -1 }));
  await track('comments.jobId', col.comments(db).createIndex({ jobId: 1 }));
  await track('contactMessages.status+createdAt', col.messages(db).createIndex({ status: 1, createdAt: -1 }));
  await track('scripts.jobId+updatedAt', col.scripts(db).createIndex({ jobId: 1, updatedAt: -1 }));
  await track('scripts.status+format+updatedAt', col.scripts(db).createIndex({ status: 1, format: 1, updatedAt: -1 }));
  await track('jobs.sourceUrlKey', jobs.createIndex({ sourceUrlKey: 1 }, { sparse: true }));
  await track(
    'jobs.import.itemKey (unique, partial)',
    jobs.createIndex({ 'import.itemKey': 1 }, { unique: true, partialFilterExpression: { 'import.itemKey': { $exists: true } } }),
  );
  await track('importSources.enabled+lastRunAt', col.importSources(db).createIndex({ enabled: 1, lastRunAt: 1 }));
  await track('importRuns.sourceId+startedAt', col.importRuns(db).createIndex({ sourceId: 1, startedAt: -1 }));
  await track('importSeen.itemKey (unique)', col.importSeen(db).createIndex({ itemKey: 1 }, { unique: true }));
  await track('jobViews.jobId+date (unique)', col.jobViews(db).createIndex({ jobId: 1, date: 1 }, { unique: true }));
  await track('jobViews.date', col.jobViews(db).createIndex({ date: 1 }));
  return done;
}
