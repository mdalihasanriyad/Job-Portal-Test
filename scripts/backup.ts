import './loadEnv.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { closeDb, getDb } from '../api/_lib/db.js';

// Usage: npm run backup
// Writes one NDJSON file per collection into backups/<timestamp>/ (git-ignored).
// MongoDB Atlas FREE (M0) clusters have NO automated backups, so run this regularly.
// Files contain personal data and admin password hashes: keep them private.

const COLLECTIONS = ['jobs', 'categories', 'comments', 'contactMessages', 'scripts', 'admins'];

/** Extended-JSON-style replacer so ObjectIds and Dates survive the round trip. */
function replacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
  const raw = this[key] as { _bsontype?: string; toHexString?: () => string } | Date | undefined;
  if (raw instanceof Date) return { $date: raw.toISOString() };
  if (raw && typeof raw === 'object' && (raw as { _bsontype?: string })._bsontype === 'ObjectId') {
    return { $oid: (raw as { toHexString: () => string }).toHexString() };
  }
  return value;
}

async function main(): Promise<void> {
  const db = await getDb();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(process.cwd(), 'backups', stamp);
  await mkdir(dir, { recursive: true });

  for (const name of COLLECTIONS) {
    const docs = await db.collection(name).find({}).toArray();
    const lines = docs.map((doc) => JSON.stringify(doc, replacer));
    await writeFile(join(dir, `${name}.ndjson`), lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
    console.log(`  ${name}: ${docs.length} document(s)`);
  }
  console.log(`Backup written to ${dir}`);
}

main()
  .catch((error: unknown) => {
    console.error('Backup failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
