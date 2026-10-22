import type { Db } from 'mongodb';
import { col } from './db.js';
import { HttpError, readJsonBody, type Req } from './http.js';
import { cleanString } from './validate.js';

function parseCategory(body: unknown, requireSlug: boolean): { name: string; slug: string; description: string } {
  const raw = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const name = cleanString(raw.name, false);
  if (name.length < 2 || name.length > 80) errors.name = 'নাম ২–৮০ অক্ষরের হতে হবে।';
  const description = cleanString(raw.description, false);
  if (description.length > 200) errors.description = 'বিবরণ সর্বোচ্চ ২০০ অক্ষরের হতে পারবে।';
  const slug = cleanString(raw.slug, false).toLowerCase();
  if (requireSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.slug = 'স্লাগে শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা ও হাইফেন ব্যবহার করুন।';
  else if (requireSlug && (slug.length < 2 || slug.length > 40)) errors.slug = 'স্লাগ ২–৪০ অক্ষরের হতে হবে।';
  if (Object.keys(errors).length > 0) throw new HttpError(422, 'validation', 'ফর্মে কিছু ত্রুটি আছে।', errors);
  return { name, slug, description };
}

/** Categories with job counts (also used by the job form dropdown). */
export async function listAdminCategories(db: Db): Promise<unknown> {
  const [categories, counts] = await Promise.all([
    col.categories(db).find({}).sort({ name: 1 }).toArray(),
    col.jobs(db).aggregate([{ $group: { _id: '$categorySlug', count: { $sum: 1 } } }]).toArray(),
  ]);
  const countMap = new Map(counts.map((row) => [String(row._id), Number(row.count)]));
  return {
    categories: categories.map((category) => ({
      slug: String(category.slug),
      name: String(category.name),
      description: String(category.description ?? ''),
      jobCount: countMap.get(String(category.slug)) ?? 0,
    })),
  };
}

export async function createCategory(db: Db, req: Req): Promise<{ status: number; body: unknown }> {
  const input = parseCategory(await readJsonBody(req), true);
  try {
    await col.categories(db).insertOne({ ...input, createdAt: new Date() });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new HttpError(409, 'duplicate_slug', 'এই স্লাগে ক্যাটাগরি আছে।', { slug: 'এই স্লাগটি ইতিমধ্যে ব্যবহৃত হয়েছে।' });
    }
    throw error;
  }
  return { status: 201, body: { ok: true } };
}

/** Name and description can change; the slug never does (public URLs depend on it). */
export async function updateCategory(db: Db, req: Req, slug: string | undefined): Promise<unknown> {
  const input = parseCategory(await readJsonBody(req), false);
  const updated = await col.categories(db).findOneAndUpdate({ slug: slug ?? '' }, { $set: { name: input.name, description: input.description } }, { returnDocument: 'after' });
  if (!updated) throw new HttpError(404, 'not_found', 'ক্যাটাগরিটি পাওয়া যায়নি।');
  await col.jobs(db).updateMany({ categorySlug: slug }, { $set: { category: input.name } });
  return { ok: true };
}

export async function deleteCategory(db: Db, slug: string | undefined): Promise<unknown> {
  const used = await col.jobs(db).countDocuments({ categorySlug: slug ?? '' });
  if (used > 0) throw new HttpError(409, 'in_use', `এই ক্যাটাগরিতে ${used}টি চাকরি আছে। আগে সেগুলো অন্য ক্যাটাগরিতে সরান।`);
  const sources = await col.importSources(db).countDocuments({ defaultCategorySlug: slug ?? '' });
  if (sources > 0) throw new HttpError(409, 'in_use', 'কোনো আমদানি সোর্স এই ক্যাটাগরি ব্যবহার করছে। আগে সোর্স বদলান।');
  const result = await col.categories(db).deleteOne({ slug: slug ?? '' });
  if (result.deletedCount === 0) throw new HttpError(404, 'not_found', 'ক্যাটাগরিটি পাওয়া যায়নি।');
  return { ok: true };
}
