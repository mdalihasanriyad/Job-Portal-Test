import { MongoClient, type Collection, type Db, type Document } from 'mongodb';
import { getEnv } from './env.js';

// Reuse one client across warm serverless invocations (and across Vite dev reloads).
const globalCache = globalThis as unknown as { __govtjobMongo?: Promise<MongoClient> };

export async function getDb(): Promise<Db> {
  const env = getEnv();
  if (!globalCache.__govtjobMongo) {
    const client = new MongoClient(env.MONGODB_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
      appName: 'govtjob-bd',
    });
    globalCache.__govtjobMongo = client.connect().catch((error: unknown) => {
      globalCache.__govtjobMongo = undefined;
      throw error;
    });
  }
  const client = await globalCache.__govtjobMongo;
  return client.db(env.MONGODB_DB);
}

/** Used by CLI scripts so the process can exit. */
export async function closeDb(): Promise<void> {
  if (globalCache.__govtjobMongo) {
    const client = await globalCache.__govtjobMongo;
    globalCache.__govtjobMongo = undefined;
    await client.close();
  }
}

export const col = {
  admins: (db: Db): Collection<Document> => db.collection('admins'),
  sessions: (db: Db): Collection<Document> => db.collection('sessions'),
  rateLimits: (db: Db): Collection<Document> => db.collection('rateLimits'),
  categories: (db: Db): Collection<Document> => db.collection('categories'),
  jobs: (db: Db): Collection<Document> => db.collection('jobs'),
  comments: (db: Db): Collection<Document> => db.collection('comments'),
  importSources: (db: Db): Collection<Document> => db.collection('importSources'),
  importRuns: (db: Db): Collection<Document> => db.collection('importRuns'),
  importSeen: (db: Db): Collection<Document> => db.collection('importSeen'),
  jobViews: (db: Db): Collection<Document> => db.collection('jobViews'),
  scripts: (db: Db): Collection<Document> => db.collection('scripts'),
  messages: (db: Db): Collection<Document> => db.collection('contactMessages'),
};
