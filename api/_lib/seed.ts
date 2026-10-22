import type { Db } from 'mongodb';
import { col } from './db.js';

export const SEED_CATEGORIES = [
  { slug: 'bank', name: 'ব্যাংক ও আর্থিক প্রতিষ্ঠান', description: 'রাষ্ট্রায়ত্ত ব্যাংক ও আর্থিক প্রতিষ্ঠানের নিয়োগ বিজ্ঞপ্তি।' },
  { slug: 'education', name: 'শিক্ষা ও গবেষণা', description: 'শিক্ষা প্রতিষ্ঠান, বোর্ড ও বিশ্ববিদ্যালয়ের নিয়োগ বিজ্ঞপ্তি।' },
  { slug: 'health', name: 'স্বাস্থ্য', description: 'স্বাস্থ্য অধিদপ্তর ও হাসপাতাল সংশ্লিষ্ট নিয়োগ বিজ্ঞপ্তি।' },
  { slug: 'engineering', name: 'প্রকৌশল ও কারিগরি', description: 'প্রকৌশল ও কারিগরি পদের নিয়োগ বিজ্ঞপ্তি।' },
  { slug: 'administration', name: 'প্রশাসন ও স্থানীয় সরকার', description: 'মন্ত্রণালয়, বিভাগ ও স্থানীয় সরকার প্রতিষ্ঠানের নিয়োগ।' },
  { slug: 'security', name: 'নিরাপত্তা ও আইন-শৃঙ্খলা', description: 'নিরাপত্তা ও আইন-শৃঙ্খলা বাহিনীর নিয়োগ বিজ্ঞপ্তি।' },
  { slug: 'ict', name: 'আইসিটি', description: 'তথ্যপ্রযুক্তি সংশ্লিষ্ট সরকারি পদের নিয়োগ বিজ্ঞপ্তি।' },
];

/** Inserts missing categories only; never overwrites edits made later. */
export async function seedCategories(db: Db): Promise<number> {
  let inserted = 0;
  for (const category of SEED_CATEGORIES) {
    const result = await col.categories(db).updateOne(
      { slug: category.slug },
      { $setOnInsert: { ...category, createdAt: new Date() } },
      { upsert: true },
    );
    if (result.upsertedCount > 0) inserted += 1;
  }
  return inserted;
}
