import type { Db } from 'mongodb';
import { col } from './db.js';

export interface RateResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * MongoDB-backed fixed-window rate limiter. Serverless-safe (no in-memory state).
 * Counts this attempt and reports whether it is within the limit.
 */
export async function hit(db: Db, key: string, limit: number, windowSeconds: number): Promise<RateResult> {
  const collection = col.rateLimits(db);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const now = new Date();
    const updated = await collection.findOneAndUpdate(
      { key, resetAt: { $gt: now } },
      { $inc: { count: 1 } },
      { returnDocument: 'after' },
    );
    if (updated) {
      const count = Number(updated.count ?? 0);
      const resetAt = updated.resetAt as Date;
      return {
        allowed: count <= limit,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
      };
    }
    try {
      await collection.updateOne(
        { key },
        { $set: { count: 1, resetAt: new Date(now.getTime() + windowSeconds * 1000) } },
        { upsert: true },
      );
      return { allowed: true, retryAfterSeconds: windowSeconds };
    } catch (error) {
      // Concurrent upsert race on the unique key: retry once through the update path.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  return { allowed: true, retryAfterSeconds: windowSeconds };
}

export async function reset(db: Db, key: string): Promise<void> {
  await col.rateLimits(db).deleteOne({ key });
}
