import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { col } from './db.js';
import { HttpError, readJsonBody, type Req } from './http.js';
import { SCRIPT_FORMATS, buildScriptPrompt, type ScriptFormat } from './scriptPrompts.js';
import { aiConfig, generateText } from './aiProvider.js';
import { hit } from './rateLimit.js';
import { cleanString } from './validate.js';

const SITE_URL = 'https://govtjob.bd';
const MAX_SCRIPTS_PER_JOB = 20;
const MAX_CONTENT = 20000;

function toObjectId(value: unknown, message = 'রেকর্ডটি পাওয়া যায়নি।'): ObjectId {
  if (typeof value !== 'string' || !/^[0-9a-f]{24}$/i.test(value)) throw new HttpError(404, 'not_found', message);
  return new ObjectId(value);
}

function iso(value: unknown): string | undefined {
  return value instanceof Date ? value.toISOString() : undefined;
}

function wordCount(text: unknown): number {
  return typeof text === 'string' ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function toScript(doc: Document, withBodies: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: String(doc._id),
    jobId: String(doc.jobId),
    jobSlug: doc.jobSlug,
    jobTitle: doc.jobTitle,
    format: doc.format,
    title: doc.title ?? '',
    aiTool: doc.aiTool ?? '',
    status: doc.status,
    wordCount: wordCount(doc.content),
    generation: doc.generation
      ? {
          by: (doc.generation as Document).by,
          model: (doc.generation as Document).model,
          at: iso((doc.generation as Document).at),
          inputTokens: (doc.generation as Document).inputTokens,
          outputTokens: (doc.generation as Document).outputTokens,
          truncated: Boolean((doc.generation as Document).truncated),
        }
      : undefined,
    promptGeneratedAt: iso(doc.promptGeneratedAt),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
  if (withBodies) {
    out.prompt = doc.prompt ?? '';
    out.content = doc.content ?? '';
  }
  return out;
}

export async function listScripts(db: Db, url: URL): Promise<unknown> {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = 15;
  const and: Filter<Document>[] = [];

  const jobId = url.searchParams.get('jobId');
  if (jobId) and.push({ jobId: toObjectId(jobId, 'চাকরিটি পাওয়া যায়নি।') });
  const format = url.searchParams.get('format');
  if (format === 'short' || format === 'full') and.push({ format });
  const status = url.searchParams.get('status');
  if (status === 'prompt' || status === 'draft' || status === 'final') and.push({ status });
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q) {
    const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    and.push({ $or: [{ jobTitle: pattern }, { title: pattern }] });
  }
  const filter: Filter<Document> = and.length ? { $and: and } : {};

  const [total, docs] = await Promise.all([
    col.scripts(db).countDocuments(filter),
    col.scripts(db).find(filter, { projection: { prompt: 0 } }).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
  ]);
  return { items: docs.map((doc) => toScript(doc, false)), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function createScript(db: Db, req: Req): Promise<{ status: number; body: unknown }> {
  const body = (await readJsonBody(req)) as { jobId?: unknown; format?: unknown } | null;
  const format = body?.format;
  if (typeof format !== 'string' || !(SCRIPT_FORMATS as string[]).includes(format)) {
    throw new HttpError(422, 'validation', 'স্ক্রিপ্টের ধরন সঠিক নয়।', { format: 'শর্ট বা পূর্ণ স্ক্রিপ্ট বেছে নিন।' });
  }
  const jobId = toObjectId(body?.jobId, 'চাকরিটি পাওয়া যায়নি।');
  const job = await col.jobs(db).findOne({ _id: jobId });
  if (!job) throw new HttpError(404, 'not_found', 'চাকরিটি পাওয়া যায়নি।');

  const existing = await col.scripts(db).countDocuments({ jobId });
  if (existing >= MAX_SCRIPTS_PER_JOB) {
    throw new HttpError(409, 'limit', `একটি চাকরির জন্য সর্বোচ্চ ${MAX_SCRIPTS_PER_JOB}টি স্ক্রিপ্ট রাখা যায়। পুরোনো কিছু মুছে ফেলুন।`);
  }

  const now = new Date();
  const doc: Document = {
    jobId,
    jobSlug: job.slug,
    jobTitle: job.title,
    format: format as ScriptFormat,
    title: '',
    aiTool: '',
    prompt: buildScriptPrompt(job, format as ScriptFormat, SITE_URL),
    promptGeneratedAt: now,
    content: '',
    status: 'prompt',
    createdAt: now,
    updatedAt: now,
  };
  const result = await col.scripts(db).insertOne(doc);
  return { status: 201, body: { script: toScript({ ...doc, _id: result.insertedId }, true) } };
}

export async function getScript(db: Db, id: string | undefined): Promise<unknown> {
  const doc = await col.scripts(db).findOne({ _id: toObjectId(id, 'স্ক্রিপ্টটি পাওয়া যায়নি।') });
  if (!doc) throw new HttpError(404, 'not_found', 'স্ক্রিপ্টটি পাওয়া যায়নি।');
  const job = await col.jobs(db).findOne({ _id: doc.jobId as ObjectId }, { projection: { updatedAt: 1, slug: 1, title: 1, status: 1 } });
  return {
    script: toScript(doc, true),
    ai: { enabled: aiConfig().enabled, model: aiConfig().model },
    job: job ? { id: String(job._id), slug: job.slug, title: job.title, status: job.status, updatedAt: iso(job.updatedAt) } : null,
  };
}

export async function updateScript(db: Db, req: Req, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id, 'স্ক্রিপ্টটি পাওয়া যায়নি।');
  const raw = (await readJsonBody(req)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'invalid', 'অনুরোধের তথ্য সঠিক নয়।');

  const errors: Record<string, string> = {};
  const title = cleanString(raw.title, false);
  if (title.length > 150) errors.title = 'শিরোনাম সর্বোচ্চ ১৫০ অক্ষরের হতে পারবে।';
  const aiTool = cleanString(raw.aiTool, false);
  if (aiTool.length > 60) errors.aiTool = 'AI টুলের নাম সর্বোচ্চ ৬০ অক্ষরের হতে পারবে।';
  const content = cleanString(raw.content, true);
  if (content.length > MAX_CONTENT) errors.content = `স্ক্রিপ্ট সর্বোচ্চ ${MAX_CONTENT} অক্ষরের হতে পারবে।`;
  const wantsFinal = raw.final === true;
  if (wantsFinal && !content) errors.content = 'চূড়ান্ত করতে আগে স্ক্রিপ্ট পেস্ট করুন।';
  if (Object.keys(errors).length > 0) throw new HttpError(422, 'validation', 'ফর্মে কিছু ত্রুটি আছে।', errors);

  const status = !content ? 'prompt' : wantsFinal ? 'final' : 'draft';
  const updated = await col.scripts(db).findOneAndUpdate(
    { _id: objectId },
    { $set: { title, aiTool, content, status, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'not_found', 'স্ক্রিপ্টটি পাওয়া যায়নি।');
  return { script: toScript(updated, true) };
}

/** Rebuilds the prompt from the job's CURRENT saved data (e.g. after the job was edited). */
export async function refreshPrompt(db: Db, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id, 'স্ক্রিপ্টটি পাওয়া যায়নি।');
  const script = await col.scripts(db).findOne({ _id: objectId });
  if (!script) throw new HttpError(404, 'not_found', 'স্ক্রিপ্টটি পাওয়া যায়নি।');
  const job = await col.jobs(db).findOne({ _id: script.jobId as ObjectId });
  if (!job) throw new HttpError(404, 'not_found', 'এই স্ক্রিপ্টের চাকরিটি আর নেই।');
  const now = new Date();
  const updated = await col.scripts(db).findOneAndUpdate(
    { _id: objectId },
    { $set: { prompt: buildScriptPrompt(job, script.format as ScriptFormat, SITE_URL), promptGeneratedAt: now, jobTitle: job.title, jobSlug: job.slug, updatedAt: now } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'not_found', 'স্ক্রিপ্টটি পাওয়া যায়নি।');
  return { script: toScript(updated, true) };
}

export async function deleteScript(db: Db, id: string | undefined): Promise<unknown> {
  const result = await col.scripts(db).deleteOne({ _id: toObjectId(id, 'স্ক্রিপ্টটি পাওয়া যায়নি।') });
  if (result.deletedCount === 0) throw new HttpError(404, 'not_found', 'স্ক্রিপ্টটি পাওয়া যায়নি।');
  return { ok: true };
}

/**
 * Optional paid feature: sends the script prompt to the configured AI provider and stores the
 * result as a DRAFT (never final). The admin must still review it against the official notice.
 */
export async function generateScriptWithAi(db: Db, req: Req, id: string | undefined): Promise<unknown> {
  const objectId = toObjectId(id, 'স্ক্রিপ্টটি পাওয়া যায়নি।');
  const config = aiConfig();
  if (!config.enabled) throw new HttpError(501, 'not_configured', 'AI সংযোগ চালু করা হয়নি। প্রম্পট কপি করে বাইরের AI-তে চালান।');

  const body = (await readJsonBody(req).catch(() => ({}))) as { overwrite?: unknown } | null;
  const script = await col.scripts(db).findOne({ _id: objectId });
  if (!script) throw new HttpError(404, 'not_found', 'স্ক্রিপ্টটি পাওয়া যায়নি।');
  if (typeof script.content === 'string' && script.content.trim() && body?.overwrite !== true) {
    throw new HttpError(409, 'would_overwrite', 'এই স্ক্রিপ্টে আগে থেকেই লেখা আছে। নতুন AI খসড়া দিয়ে বদলাতে নিশ্চিত করুন।');
  }
  const job = await col.jobs(db).findOne({ _id: script.jobId as ObjectId });
  if (!job) throw new HttpError(404, 'not_found', 'এই স্ক্রিপ্টের চাকরিটি আর নেই।');

  const limit = await hit(db, 'ai:daily', config.dailyLimit, 86_400);
  if (!limit.allowed) throw new HttpError(429, 'rate_limited', `আজকের AI সীমা (${config.dailyLimit}টি) শেষ। কাল আবার চেষ্টা করুন বা প্রম্পট হাতে চালান।`);

  const format = script.format as ScriptFormat;
  const prompt = buildScriptPrompt(job, format, SITE_URL);
  const result = await generateText(prompt, format === 'short' ? 2000 : 5000);

  const now = new Date();
  const updated = await col.scripts(db).findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        prompt,
        promptGeneratedAt: now,
        content: result.text.slice(0, MAX_CONTENT),
        aiTool: `Claude API (${result.model})`.slice(0, 60),
        status: 'draft',
        generation: { by: 'api', model: result.model, at: now, inputTokens: result.inputTokens, outputTokens: result.outputTokens, truncated: result.truncated },
        updatedAt: now,
      },
    },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'not_found', 'স্ক্রিপ্টটি পাওয়া যায়নি।');
  return { script: toScript(updated, true) };
}
