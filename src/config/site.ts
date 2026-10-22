export const SITE = {
  name: 'GovtJob.bd',
  url: 'https://govtjob.bd',
  tagline: 'বাংলাদেশের সরকারি চাকরির বিজ্ঞপ্তি এক জায়গায়',
  description:
    'বাংলাদেশের সরকারি চাকরির সর্বশেষ বিজ্ঞপ্তি, আবেদনের শেষ তারিখ ও আবেদন পদ্ধতি এক জায়গায়।',
  locale: 'bn_BD',
  defaultImage: 'https://govtjob.bd/og-default.png',
  /** Jobs expired longer than this are marked noindex (must match api/_lib/seoShared.ts). */
  longExpiredDays: 180,
} as const;
