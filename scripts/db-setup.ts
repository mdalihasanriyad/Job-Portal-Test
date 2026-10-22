import './loadEnv.js';
import { closeDb, col, getDb } from '../api/_lib/db.js';
import { normalizeUrl } from '../api/_lib/importParse.js';
import { ensureIndexes } from '../api/_lib/indexes.js';
import { seedCategories } from '../api/_lib/seed.js';

async function main(): Promise<void> {
  const db = await getDb();
  console.log(`Connected to database "${db.databaseName}".`);
  const indexes = await ensureIndexes(db);
  indexes.forEach((name) => console.log(`  index ok: ${name}`));
  const inserted = await seedCategories(db);
  console.log(`Categories seeded (new: ${inserted}).`);
  // Phase 7: jobs created earlier have no normalized source URL yet (used for duplicate detection).
  const missing = await col.jobs(db).find({ sourceUrl: { $exists: true }, sourceUrlKey: { $exists: false } }).toArray();
  let backfilled = 0;
  for (const job of missing) {
    const key = normalizeUrl(String(job.sourceUrl));
    if (!key) continue;
    await col.jobs(db).updateOne({ _id: job._id }, { $set: { sourceUrlKey: key } });
    backfilled += 1;
  }
  console.log(`Source URL keys backfilled: ${backfilled}.`);
  console.log('Database setup complete.');
}

main()
  .catch((error: unknown) => {
    console.error('Database setup failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
